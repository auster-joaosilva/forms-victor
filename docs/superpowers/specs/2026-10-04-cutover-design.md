# Etapa 5 — Backup, limite do CNPJ e virada

Data: 2026-10-04 · Status: aprovado pelo usuário, seção por seção

Base: Etapas 0 a 3, no ar em `hml-reforma.austercontabil.com.br` pela branch `teste`. A `origin/main` não mudou desde
`10f5a4c`, a referência da Etapa 3: não há nada do portal antigo a portar.

Com esta etapa, o app novo vira a produção em `reforma-tributaria.austercontabil.com.br`, assim que as checagens no hml
forem aprovadas, com folga antes de 30/10/2026.

## Decisões

| # | Decisão |
|---|---|
| C1 | **Backup diário no MinIO da própria VPS**, num bucket `forms-victor-backups`. Protege contra erro humano e dado corrompido, não contra perder a VPS. Escolha do usuário. |
| C2 | **O backup é um script do app, agendado por uma Schedule do Dokploy** no compose "full", às 03:00 de Brasília. Sem container extra e sem depender do backup nativo de banco do Dokploy. |
| C3 | **O dump vai do `pg_dump` ao MinIO em stream**, por upload em partes, sem disco (o `AGENTS.md` proíbe escrita em disco pelo app). |
| C4 | **Retenção:** os 7 dumps diários mais recentes e os dumps de domingo das 4 últimas semanas. Os arquivos do bucket do app são copiados de forma incremental e nunca apagados do backup. |
| C5 | **Limite nas consultas de CNPJ**, as três públicas (diagnóstico, adesão, inscrição), com uma rota só, `cnpj-lookup`, no `rate-limit` que já existe (5 por minuto, 30 por hora, por IP). Estourado, a consulta responde `indisponível`, como a BrasilAPI fora do ar. Sem texto novo. |
| C6 | **Ficam de fora**, a pedido do usuário: troca dos segredos colados no chat, IP real atrás da Cloudflare, `Sec-Fetch-Site` no GET das planilhas. Ficam registrados como débito. |
| C7 | **Sem hml depois da virada.** O compose "full", com o banco `forms_victor` e o bucket `forms-victor`, vira a produção. O domínio `hml-reforma` sai dele. |
| C8 | **A virada zera o banco e importa do zero** (Etapa 3): reset, simulação, importação com o portal antigo no ar. |
| C9 | **A `main` avança sem force push.** Um `git merge -s ours origin/main` na `teste` registra os 3 commits do portal antigo sem trazer o código; depois `git push origin teste:main`. |
| C10 | **Sem alerta de falha do backup.** A falha aparece como erro na Schedule do Dokploy. Alerta por e-mail fica para quando fizer falta. |

## 1. Backup — módulo `backup`

**`domain/retention.ts`** (puro): `dumpsToDelete(dumps: { key: string; takenAt: Date }[], now: Date): string[]`.
- Guarda os 7 mais recentes, e o mais recente de cada domingo (data de Brasília) das 4 últimas semanas. Apaga o resto.
- Lista vazia ou com menos de 7 não apaga nada.
- A data sai da chave; uma chave fora do formato nunca é apagada.

**`domain/keys.ts`** (puro): `dumpKey(database, takenAt)`, que dá `postgres/<banco>-AAAA-MM-DDTHHmm.dump` com a data de Brasília; o
inverso, `parseDumpKey`; `fileKey(sourceKey)`, que dá `files/<chave>`; e `legacyKey(takenAt, name)`, que dá `legacy/AAAA-MM-DDTHHmm/<nome>`.

**`ports/`:**
- `DatabaseDumper`: `dump(): { stream: Readable; done: Promise<void> }`, em que `done` rejeita se o processo sair com código diferente de zero;
  `restore(stream, targetUrl): Promise<void>`.
- `BackupStore`:
  - `put(key, stream)` e `get(key)`, os dois em stream;
  - `list(prefix)`, que devolve as chaves;
  - `delete(keys)`.
- `SourceFiles`: `list()`, as chaves do bucket do app, e `copyTo(key, backupKey)`, cópia do lado do servidor.
- `LegacyFiles`: `open(name)` devolve um stream ou `null`, para `portal.db`, `portal.db-wal` e `portal.db-shm`.

**`application/`:**
- `run-backup.ts`, `runBackup({ legacy })`:
  1. grava o dump;
  2. copia para `files/` só as chaves do bucket do app que ainda não estão lá;
  3. com `legacy`, grava os três arquivos do portal antigo que existirem;
  4. aplica a retenção nos dumps.
  - Devolve um resumo: chave do dump, bytes, arquivos copiados, dumps apagados.
  - Um erro no dump aborta antes da retenção. Nada é apagado num dia sem dump novo.
- `restore-backup.ts`, `restoreBackup({ key, targetUrl, appUrl, overwrite })`:
  - recusa quando `targetUrl` aponta para o mesmo banco que `appUrl` (mesmo host, porta e nome) e `overwrite` é falso;
  - lê o dump em stream e entrega ao `pg_restore --clean --if-exists --no-owner`.

**`adapters/`:**
- `pg-dump.ts`: `spawn('pg_dump', ['-Fc', url])` e `spawn('pg_restore', […, '-d', target])`.
- `s3-backup-store.ts`: S3 com o `@aws-sdk/client-s3` que já existe, mais o `@aws-sdk/lib-storage` para o upload em partes de stream de
  tamanho desconhecido. É a única dependência nova.
- `legacy-files.ts`: lê de `dirname(LEGACY_DB_PATH)`, só leitura.

**`composition.ts`** e scripts:
- `scripts/backup.ts`, com `pnpm backup` e `pnpm backup --legacy`. Imprime o resumo e sai com 1 em erro.
- `scripts/restore-backup.ts`, com `pnpm backup:restore <chave> <url-de-destino> [--overwrite]`.

**Ambiente:** `BACKUP_BUCKET`, com padrão `forms-victor-backups`, validado no `env.ts`. O bucket é criado pelo `ensureBucket` que já existe.
A chave do MinIO precisa de permissão nele (ajuste no console do MinIO, descrito no `AGENTS.md`).

**Imagem:** o `Dockerfile` instala `postgresql17-client` no estágio de runtime. No ensaio, `pg_dump --version` precisa bater com o
`SHOW server_version` do Postgres da VPS. Se o servidor for de outra versão maior, troca-se o pacote.

**Testes:**
- `retention.test.ts` e `keys.test.ts`: os casos de borda de data e de domingo em Brasília.
- `run-backup.test.ts` e `restore-backup.test.ts`, com fakes das portas:
  - o dump falha e nada é apagado;
  - a cópia é incremental;
  - o `legacy` funciona sem o `-wal`;
  - a restauração no banco do app é recusada.
- `s3-backup-store.int.test.ts`, contra o MinIO do `docker-compose.yml`.
- `pg-dump.int.test.ts`: dump e restauração do `forms_victor_test` num banco temporário, comparando as contagens. Pula com aviso quando não há
  `pg_dump` na máquina.

## 2. Limite nas consultas de CNPJ — módulo `company-lookup`

- `makeLookupCompany(registry, rateLimiter)`. A entrada ganha `origin: string`. O limite é conferido antes do registry, na rota `cnpj-lookup`.
  Bloqueado, devolve `{ ok: false, reason: 'indisponível' }`, e a BrasilAPI não é chamada.
- `ports/rate-limiter.ts`, igual ao dos outros módulos. A `composition.ts` liga o `checkRateLimit`.
- As três server functions, `lookupCnpj`, `lookupAdhesionCompany` e `lookupRegistrationCompany`, passam `origin: requestClientIp()` até o
  caso de uso.
- **Testes:**
  - `lookup-company.test.ts`: com o limitador bloqueando, sai `indisponível` e o registry não é chamado;
  - os casos de uso de diagnóstico, adesão e eventos repassam a origem;
  - os testes de tela continuam iguais.

## 3. Roteiro da virada — `AGENTS.md`

Uma seção "Virada", que substitui o "Na virada" da migração. Os passos vêm abaixo.

**Antes, em qualquer dia:**
1. O usuário aprova as checagens do hml.
2. Backup no ar:
   - a Schedule diária está criada;
   - um `pnpm backup` manual passou;
   - uma restauração em `forms_victor_restore` foi feita, com as contagens conferidas;
   - o banco temporário foi apagado.
3. Deploy automático do compose "frontend" desligado. O Victor sabe que a `main` congela a partir dali.
4. Na `teste`: `git merge -s ours origin/main -m "merge: main do portal antigo, sem o código"`, e push.

**No dia:**

5. `pnpm backup --legacy` no container do "full", pelo terminal do Dokploy. Confere-se `legacy/<data>/` no bucket.
6. Tira-se o domínio `reforma-tributaria` do compose "frontend". O container continua no ar.
7. No "full":
   - `ALLOW_TEST_DATA_RESET=true` e deploy;
   - Apagar, Simular, Importar, e Importar de novo, que tem que vir toda como pulada;
   - `ALLOW_TEST_DATA_RESET=false` e deploy.
8. Domínio no "full":
   - adicionar `reforma-tributaria.austercontabil.com.br` e tirar o `hml-reforma`;
   - `APP_PUBLIC_URL` e `BETTER_AUTH_URL` no domínio novo;
   - deploy.
9. Conferências:
   - `/`, `/events`, `/health`, `/imagens/recepcao.jpg` respondem 200 e `/backoffice` responde 307;
   - o login entra;
   - as contagens da aba Respostas batem com a importação;
   - o IP do login na Auditoria é o de quem acessou, não o de um servidor da Cloudflare (se for, avisar: o limite por IP vira global).
10. Senha de cada usuário migrado, na aba Usuários.
11. Git:
    - `git push origin teste:main`;
    - a branch do "full" passa para `main`;
    - o fluxo git do `AGENTS.md` volta para `main` (sai a `teste`), e as notas sobre o compose "frontend" saem.
12. Para o compose "frontend", sem apagar. Depois de 30 dias:
    - apaga o volume do portal antigo;
    - tira a montagem `legacy-data` e o bloco `volumes:` do `dokploy-compose.yml`;
    - tira o `LEGACY_VOLUME_NAME` do painel.

**Volta atrás:**
- **Até o passo 8:** devolve o domínio ao "frontend". O portal antigo está intacto.
- **Depois do passo 8:** o que entrou no app novo se perde ao voltar. A decisão de voltar sai nas primeiras horas.

## Critério de pronto

1. `pnpm backup` grava um dump, copia os arquivos e aplica a retenção, no hml.
2. A restauração em `forms_victor_restore` traz as mesmas contagens do banco de origem.
3. A Schedule das 03:00 roda sozinha uma vez e aparece como sucesso.
4. A 31ª consulta de CNPJ na mesma hora, do mesmo IP, responde como indisponível e não chega à BrasilAPI.
5. `pnpm lint && pnpm typecheck && pnpm test` limpos. O ponta a ponta continua passando.
6. A seção "Virada" do `AGENTS.md` está escrita e foi revisada pelo usuário.

## Fora do escopo

- C6, os débitos de segurança que o usuário deixou de fora.
- Cópia do backup fora da VPS.
- Alerta de falha do backup.
- Um hml novo, com banco próprio.
- O conteúdo pendente do Victor (data 10/12 do termo V5, sobras de "20/11", título do fechamento de novembro).
