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
`hml-reforma.austercontabil.com.br` a cada push (compose "hml", arquivo
`dokploy-compose.yml`). A `main` só volta a receber código na virada.

O compose antigo "frontend" (portal legado em `reforma-tributaria.austercontabil.com.br`)
está **congelado** até a virada. Não disparar deploy nele: ele buildaria este
código com a configuração velha.

## Testes

- `domain`: Vitest puro. As invariantes do motor rodam sobre 40 mil preenchimentos
  com semente fixa; nenhuma pode falhar.
- `application`: casos de uso com fakes das portas.
- `adapters`: `*.int.test.ts`, contra o Postgres e o MinIO do `docker-compose.yml`
  (`pnpm db:up`).
- `pnpm sweep` e `pnpm sweep:weighted` medem a distribuição das saídas. Os pesos são
  premissa, não dado da carteira.
- Componentes: `*.test.tsx`, projeto `dom` do Vitest (jsdom + Testing Library), `pnpm test:dom`.
- Ponta a ponta: `pnpm test:e2e` (Playwright contra `pnpm dev` e o banco local). O global setup
  só aceita banco em `localhost`, limpa o rate limit e cria ou reativa `e2e-admin`, `e2e-regularization`
  e `e2e-operator` (`tests/e2e/users.ts`). Até 30/10/2026 o formulário de adesão está aberto e os testes
  de `adhesion.spec.ts` dependem disso.
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
compose "frontend", montado em `/legacy`, **só para leitura** e numa única transação: uma fotografia consistente
mesmo com o portal antigo no ar. O arquivo nunca é copiado nem alterado.

Os ids das respostas e das adesões antigas são preservados, e um id que já existe no banco novo com outro
protocolo é **conflito**: qualquer conflito aborta a importação inteira, sem gravar nada. As adesões e as respostas
de teste do hml (verificações à mão, ponta a ponta, quem testou) ocupam os ids 1, 2, 3… — os mesmos das antigas.

- **Na virada:** importe **antes** de abrir o tráfego do app novo. Uma única resposta ou adesão recebida antes
  ocupa um id e faz a importação recusar.

1. No painel do Dokploy, no compose do app (o "hml" no ensaio, o de produção na virada), defina `LEGACY_VOLUME_NAME`
   com o nome do volume `dados` do compose "frontend" e faça o deploy. `ALLOW_TEST_DATA_RESET=true` **só no hml**;
   em produção fica desligado. `LEGACY_DB_PATH` só muda se o arquivo não estiver em `/legacy/portal.db`.
2. Aba Migração: confira o caminho e que o banco aparece como **disponível**.
3. Só no hml: **Apagar dados de teste do hml** — digite `APAGAR`. Apaga rascunhos, adesões e respostas (nessa ordem);
   inscrições que apontem para uma resposta ficam sem ela (`SET NULL`). A Auditoria fica, com a linha
   "dados de teste apagados" e as contagens.
4. **Simular.** Confira as contagens, os avisos (protocolos com `-2`, convites órfãos, autores inexistentes,
   ações sem equivalente, papéis sem equivalente, adesões com diagnóstico órfão, campo em branco ou versão do termo
   fora do sistema) e se há **conflitos**. Com conflito, o Importar fica fechado.
5. **Importar** (pede confirmação). Importe de novo: tudo deve vir como pulado.
6. Aba Usuários: defina a senha de cada usuário migrado (eles chegam sem senha; o resumo antigo é incompatível).
   Confira a aba Respostas e a linha "migração do portal antigo" na Auditoria, com quem importou.

Localmente, contra um arquivo: `pnpm migrate:legacy <caminho> [--dry-run]` (o `node:sqlite` não pede flag a partir
do Node 22.13).
