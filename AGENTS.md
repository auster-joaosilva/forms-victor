# Regras do projeto

Portal da Auster sobre a opção do Simples Nacional na Reforma Tributária:
diagnóstico, termo de adesão, eventos e backoffice. Um repositório, um app.

## Stack

TanStack Start (React 19, SSR) · TanStack Router · TanStack Query ·
Prisma 7 + PostgreSQL · MinIO (S3) · better-auth · Tailwind 4 + shadcn/ui ·
Zod · Vitest · pnpm.

## Estrutura — sempre, sem exceção

Front no padrão **bullet-proof**:

- `src/app/routes` — rotas por arquivo. Rota só compõe feature; não tem regra.
- `src/features/<feature>/{api,components,hooks,types}` — uma pasta por funcionalidade.
  `api/` guarda as server functions e os hooks do TanStack Query.
- `src/components`, `src/lib`, `src/hooks`, `src/config` — só o que é compartilhado.
- Feature não importa outra feature.

Back no padrão **hexagonal**, um módulo por contexto em `src/server/<módulo>`:

- `domain/` — regra pura em TS. Sem `node:*`, sem `process`, sem IO. Isomórfico.
- `application/` — casos de uso. Dependem só de `domain` e `ports`.
- `ports/` — interfaces do que o caso de uso precisa do mundo.
- `adapters/` — Prisma, MinIO, BrasilAPI, better-auth. Implementam `ports`.
- `composition.ts` — liga adaptadores aos casos de uso e exporta os casos prontos.

O front chega ao servidor só por `features/*/api`, que chama `server/*/composition.ts`.
`server/*/domain` pode ser importado pelo front (é por isso que é puro).
As fronteiras estão no `eslint.config.js`. Lint quebrado não entra.

## Código

- Identificadores em **inglês**: funções, variáveis, tipos, propriedades, arquivos,
  rotas, tabelas, colunas, enums.
- Texto de tela em **português**.
- **Valor de domínio fica como está**: chaves e valores das perguntas
  (`receitaPorCliente`, `nao_sei`), ids de gatilho, códigos de saída, chaves de
  posição, ids de ação, níveis (`ALTA`/`MÉDIA`/`BAIXA`). É dado gravado no `payload`.
- **O termo de adesão é prova.** O objeto de `server/adhesion/domain/term.ts` não se
  edita: o hash SHA-256 das adesões já registradas é calculado sobre ele, chave por
  chave. Texto novo é versão nova, em objeto novo.
- Sem comentário desnecessário. Comente só o porquê que o código não diz:
  fundamento legal, armadilha medida.
- TypeScript `strict`, sem `any`.

## Nada local

- Proibido `localStorage`, `sessionStorage`, IndexedDB e escrita em disco pelo app.
- Estado vai para o Postgres. Arquivo vai para o MinIO.
- No navegador, só cookies `httpOnly` que carregam identificador (sessão, rascunho).
- Não usar `authClient.signOut` nem `useSession`: o cliente do better-auth grava
  `localStorage`. Sair é pela server function `signOutCurrentUser`.

## Segurança

- Nenhum segredo no repositório. Variáveis validadas por Zod em `server/shared/env.ts`.
- O QSA da consulta de CNPJ nunca é exibido nem gravado.
- O hash do termo e o diagnóstico gravado são calculados pelo servidor, nunca aceitos do navegador.
- Os endpoints `/api/auth/admin/*` são fechados ao navegador. Gestão de usuário passa por `server/identity`.
- O envio de imagem dos eventos no backoffice é `POST /backoffice/event-images` (corpo bruto, `manage_events`, Origin
  conferido): a única rota com limite de corpo de 6 MiB; todas as outras ficam em 256 KiB.
- **Débitos conhecidos**, deixados de fora pelo usuário na Etapa 5: trocar os segredos que foram colados no chat; ler o
  IP real atrás da Cloudflare; conferir o `Sec-Fetch-Site` no GET das planilhas.

## Git — em toda implementação (durante a reescrita)

1. `git switch teste && git pull --ff-only && git switch -c <tipo>/<assunto>`
2. Commits pequenos, Conventional Commits, descrição em português:
   `feat(diagnostico): …`, `fix(backoffice): …`. **Sem `Co-Authored-By`.**
3. `pnpm db:up && pnpm lint && pnpm typecheck && pnpm test` — tudo limpo.
   Mudou fluxo de tela? Rode também `pnpm test:e2e`.
4. `git switch teste && git merge --no-ff <branch> -m "merge: <assunto>" && git branch -d <branch>`
5. `git push origin teste`.
6. **Nunca** tocar nem enviar a `main`, e nunca enviar outra branch ao remoto.

**Push na `teste` é deploy.** O Dokploy publica a `teste` em
`hml-reforma.austercontabil.com.br` a cada push (compose "full", arquivo
`dokploy-compose.yml`). A `main` só volta a receber código na virada.

O compose antigo "frontend" (portal legado em `reforma-tributaria.austercontabil.com.br`) tem
**deploy automático ligado na `main`**: o Victor ainda corrige o portal antigo por ela. Não envie nada à `main`
e não dispare deploy no "frontend" fora de uma queda da produção.

Painel do Dokploy: `http://10.10.30.232:3000` (rede interna). A VPS (`86.48.5.53`) é servidor remoto dele. Se
um reinício da VPS derrubar os sites (Cloudflare 521): `compose.redeploy` do compose que sumiu e, se faltar o
Traefik, "Setup Server" da VPS — sem SSH.

## Testes

- `domain`: Vitest puro. As invariantes do motor rodam sobre 40 mil preenchimentos
  com semente fixa; nenhuma pode falhar.
- `application`: casos de uso com fakes das portas.
- `adapters`: `*.int.test.ts`, contra o Postgres e o MinIO do `docker-compose.yml`
  (`pnpm db:up`).
  O `pg-dump.int.test.ts` precisa do `pg_dump` e do `pg_restore` no PATH (cliente 17 ou mais novo); sem eles, pula com aviso.
- `pnpm sweep` e `pnpm sweep:weighted` medem a distribuição das saídas. Os pesos são
  premissa, não dado da carteira.
- Componentes: `*.test.tsx`, projeto `dom` do Vitest (jsdom + Testing Library), `pnpm test:dom`.
- Ponta a ponta: `pnpm test:e2e` (Playwright contra `pnpm dev` e o banco local). O global setup
  só aceita banco em `localhost`, limpa o rate limit e cria ou reativa `e2e-admin`, `e2e-regularization`
  e `e2e-operator` (`tests/e2e/users.ts`). Até 30/10/2026 o formulário de adesão está aberto e os testes
  de `adhesion.spec.ts` dependem disso. Os de `events.spec.ts` criam o próprio evento, com data 45 dias à frente,
  e não vencem.
  Porta 3000 ocupada? `E2E_PORT=3100 pnpm test:e2e` sobe o `pnpm dev` nessa porta.

## Rodar

```bash
pnpm install
cp .env.example .env    # valores de desenvolvimento
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm auth:bootstrap-admin   # antes, preencha BOOTSTRAP_ADMIN_* no .env
pnpm dev                # http://localhost:3000
pnpm exec playwright install chromium   # uma vez, para o ponta a ponta
pnpm test:e2e
```

O banco de teste (`forms_victor_test`, usado por `pnpm test`) é criado sozinho por
`docker/postgres-init/`, que o Postgres só roda com o volume novo. Se o volume já
existia antes disso, crie uma vez depois do `pnpm db:up`:

```bash
docker compose exec postgres psql -U app -d forms_victor_dev -c "CREATE DATABASE forms_victor_test"
```

## Migração do portal antigo (SQLite → Postgres)

Roda pela aba **Migração** do backoffice (só administrador), sem SSH. O app lê o `portal.db` do volume `dados` do
compose "frontend", montado em `/legacy` com `:ro`, numa única transação: uma fotografia consistente
mesmo com o portal antigo no ar. O arquivo nunca é copiado nem alterado. Sem o `portal.db-wal` e o `portal.db-shm`
ao lado (portal antigo parado, ou só o `portal.db` restaurado), o SQLite precisaria criar o `-shm` num diretório
que o app não grava: a aba mostra "o portal antigo precisa estar no ar" e não importa.

Os ids das respostas e das adesões antigas são preservados, e um id que já existe no banco novo com outro
protocolo é **conflito**: qualquer conflito aborta a importação inteira, sem gravar nada. As adesões e as respostas
de teste do hml (verificações à mão, ponta a ponta, quem testou) ocupam os ids 1, 2, 3… — os mesmos das antigas.

A aba Migração traz usuários, convites, respostas, adesões, **eventos, encontros, inscrições e as imagens dos eventos**
(as que estavam em base64 no `conteudo` vão para o MinIO como `event_cover`/`speaker_photo`; `/imagens/<nome>` vira a
foto da casa de mesmo nome) e a auditoria. As fotos da casa entram pelo `pnpm db:seed`: rode-o no container do app antes
de importar, ou os eventos que usavam `/imagens/…` ficam sem imagem (a simulação avisa).

- **A virada zera o banco e importa do zero.** O apagar dados de teste leva tudo o que foi criado no app novo
  antes da virada: rascunhos, inscrições, encontros, eventos, adesões e respostas. Ficam só os usuários (com as senhas
  já definidas) e a Auditoria. É por isso que testar no hml depois do ensaio não faz mal: o que o teste criou sai na
  virada, e a importação de um banco limpo traz o estado do portal antigo daquele momento (inclusive status, presença
  e edições feitas depois do ensaio, que uma reimportação por cima pularia).

A importação, no compose "full", na ordem. Os itens 1 a 6 são o passo 7 da seção "Virada", e o 7 é o passo 10 de lá;
o backup do portal antigo, o corte do tráfego, o domínio e a limpeza do volume ficam na "Virada".

1. No painel do Dokploy, defina `LEGACY_VOLUME_NAME` com o nome do volume `dados` do compose "frontend" e
   `ALLOW_TEST_DATA_RESET=true`, e faça o deploy. `LEGACY_DB_PATH` só muda se o arquivo não estiver em `/legacy/portal.db`.
   O container do portal antigo fica **no ar** (ou confira que `portal.db-wal` e `portal.db-shm` existem no volume).
2. Aba Migração: confira o caminho e que o banco aparece como **disponível**.
3. **Apagar dados de teste do hml** — digite `APAGAR`. Apaga rascunhos, inscrições, encontros, eventos, adesões e
   respostas (nessa ordem) — **nunca depois de importar**: apaga também o que a migração trouxe. Os arquivos no MinIO
   ficam: a importação acha as imagens pela chave. A Auditoria fica, com a linha "dados de teste apagados" e as
   contagens.
4. **Simular.** Confira as contagens, os avisos (protocolos com `-2`, convites órfãos, autores inexistentes,
   ações sem equivalente, papéis sem equivalente, adesões com diagnóstico órfão, campo em branco ou versão do termo
   fora do sistema) e se há **conflitos**. Com conflito, o Importar fica fechado.
5. **Importar** (pede confirmação). Importe de novo: tudo deve vir como pulado.
6. No painel, `ALLOW_TEST_DATA_RESET=false` e deploy: a partir daqui o banco tem dado de verdade.
7. Aba Usuários: defina a senha de cada usuário migrado que ainda não tem (eles chegam sem senha; o resumo antigo é
   incompatível). Confira a aba Respostas e a linha "migração do portal antigo" na Auditoria, com quem importou.

Localmente, contra um arquivo: `pnpm migrate:legacy <caminho> [--dry-run]` (o `node:sqlite` não pede flag a partir
do Node 22.13).

## Backup

Um backup por dia no bucket `forms-victor-backups` (variável `BACKUP_BUCKET`), no MinIO da própria VPS. Protege contra
erro humano e dado corrompido, não contra perder a VPS. As datas das chaves são de Brasília.

- `postgres/<banco>-AAAA-MM-DDTHHmm.dump`: `pg_dump -Fc`, do processo ao MinIO em stream, sem disco. Ficam os 7 mais
  recentes e o mais recente de cada domingo das 4 últimas semanas; o resto é apagado no fim de cada backup. Um backup
  cujo dump falha para antes de apagar qualquer coisa.
- `files/<chave>`: cópia incremental do bucket do app, do lado do servidor. Nunca é apagada.
- `legacy/AAAA-MM-DDTHHmm/<nome>`: `portal.db`, `portal.db-wal` e `portal.db-shm`, os que existirem, só com `--legacy`.

```bash
pnpm backup                                                  # local, com o .env
pnpm backup --legacy                                         # também o portal antigo
pnpm backup:restore <chave> <url-de-destino> [--overwrite]
```

No container do "full" (terminal do Dokploy) não há pnpm: rode `node_modules/.bin/tsx scripts/backup.ts [--legacy]` e
`node_modules/.bin/tsx scripts/restore-backup.ts <chave> <url-de-destino> [--overwrite]`.

**Restaurar.** O banco de destino precisa existir. O `pg_restore --clean --if-exists --no-owner` apaga e recria os
objetos dele. O banco do app (mesmo host, porta e nome do `DATABASE_URL`) é recusado sem `--overwrite`. Ensaio:

1. No Postgres da VPS: `CREATE DATABASE forms_victor_restore`.
2. No container do app: `node_modules/.bin/tsx scripts/restore-backup.ts postgres/forms_victor-<data>.dump <DATABASE_URL com o banco trocado por forms_victor_restore>`.
3. Nos dois bancos, compare as contagens:
   ```sql
   SELECT table_name,
          (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I', table_name), false, true, '')))[1]::text::int AS rows
   FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
   ```
4. `DROP DATABASE forms_victor_restore`.

**Schedule.** No Dokploy, compose "full" → Schedules: todo dia às 03:00 de Brasília (`0 3 * * *`; se o painel não tiver
fuso, o cron é UTC e fica `0 6 * * *`), serviço `app`, comando `node_modules/.bin/tsx scripts/backup.ts`. Uma falha
aparece como erro na Schedule; não há alerta.

**MinIO.** A chave do `S3_ACCESS_KEY` precisa de permissão no bucket novo. No console do MinIO, na política da chave do
app, acrescente `arn:aws:s3:::forms-victor-backups` e `arn:aws:s3:::forms-victor-backups/*` com as mesmas ações que ela
tem no bucket do app (ler, gravar, listar, apagar), mais `s3:CreateBucket`; ou crie o bucket no console. A cópia dos
arquivos lê do bucket do app e grava no de backup com a mesma chave.

**Versão do cliente.** O `Dockerfile` instala o `postgresql17-client`. O `pg_dump --version` do container precisa ter a
mesma versão maior do `SHOW server_version` do Postgres da VPS; se o servidor mudar de versão maior, troque o pacote.

## Virada

O app novo vira a produção em `reforma-tributaria.austercontabil.com.br`. O compose "full" (banco `forms_victor`,
bucket `forms-victor`) passa a ser a produção, e não há hml depois disso. No container do "full", `pnpm backup` é
`node_modules/.bin/tsx scripts/backup.ts` (seção "Backup").

**Antes, em qualquer dia:**

1. O usuário aprova as checagens do hml.
2. Backup no ar:
   - a Schedule diária está criada;
   - um `pnpm backup` manual passou;
   - uma restauração em `forms_victor_restore` foi feita, com as contagens conferidas;
   - o banco temporário foi apagado.
3. Deploy automático do compose "frontend" desligado. O Victor sabe que a `main` congela a partir dali.
4. Na `teste`: `git merge -s ours origin/main -m "merge: main do portal antigo, sem o código"`, e push. Registra os
   commits do portal antigo sem trazer o código, para a `main` avançar sem force push.

**No dia:** os passos 6 a 8 são a janela fora do ar: o site cai quando o domínio sai do "frontend" e só volta
quando o "full" responde nele. Avise antes, mantenha a janela curta e não pare entre esses passos.

5. `pnpm backup --legacy` no container do "full", pelo terminal do Dokploy. Salva o dump do Postgres, os arquivos novos
   do bucket do app e o `portal.db` com o `-wal` e o `-shm`. Confere-se `legacy/<data>/` no bucket.
6. Tira-se o domínio `reforma-tributaria` do compose "frontend". O container continua no ar.
7. No "full" (detalhes em "Migração do portal antigo", itens 1 a 6):
   - `ALLOW_TEST_DATA_RESET=true` e deploy;
   - Apagar, Simular, Importar, e Importar de novo, que tem que vir toda como pulada;
   - `ALLOW_TEST_DATA_RESET=false` e deploy. Mesmo que a importação falhe, volte para `false` e faça o deploy antes de
     parar.
8. Domínio no "full":
   - adicionar `reforma-tributaria.austercontabil.com.br` e tirar o `hml-reforma`;
   - `APP_PUBLIC_URL` e `BETTER_AUTH_URL` no domínio novo;
   - deploy.
9. Conferências:
   - `/`, `/events`, `/health`, `/imagens/recepcao.jpg` respondem 200 e `/backoffice` responde 307;
   - o login entra;
   - as contagens da aba Respostas batem com a importação;
   - o IP do login na Auditoria é o de quem acessou, não o de um servidor da Cloudflare (se for, avisar: o limite por
     IP vira global).
10. Senha de cada usuário migrado, na aba Usuários.
11. Git:
    - `git push origin teste:main`;
    - a branch do "full" passa para `main`;
    - o fluxo git do `AGENTS.md` volta para `main` (sai a `teste`), e as notas sobre o compose "frontend" saem.
12. Para o compose "frontend", sem apagar. Depois de 30 dias:
    - apaga o volume do portal antigo;
    - tira a montagem `legacy-data:/legacy:ro` e o bloco `volumes:` do topo do `dokploy-compose.yml`;
    - tira o `LEGACY_VOLUME_NAME` do painel.

    Primeiro saem a montagem e o bloco, com um deploy; só depois o volume e a variável. Com o volume apagado e a
    montagem ainda no arquivo, todo deploy do "full" falha com "external volume not found".

**Volta atrás:**

- **Até o fim do passo 7, antes de pôr o domínio no "full" (passo 8):** devolve o domínio ao "frontend". O portal antigo
  está intacto.
- **A partir do passo 8:** o que entrou no app novo se perde ao voltar. A decisão de voltar sai nas primeiras horas.
