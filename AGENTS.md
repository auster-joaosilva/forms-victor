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

## Git — em toda implementação

1. `git switch main && git pull --ff-only && git switch -c <tipo>/<assunto>`
2. Commits pequenos, Conventional Commits, descrição em português:
   `feat(diagnostico): …`, `fix(backoffice): …`. **Sem `Co-Authored-By`.**
3. `pnpm db:up && pnpm lint && pnpm typecheck && pnpm test` — tudo limpo.
   Mudou fluxo de tela? Rode também `pnpm test:e2e`.
4. `git switch main && git merge --no-ff <branch> -m "merge: <assunto>" && git branch -d <branch>`
5. `git push origin main`.
6. Nunca envie outra branch ao remoto.

**Push na `main` é deploy em produção.** O Dokploy publica a `main` em `reforma-tributaria.austercontabil.com.br`
a cada push (compose "full", arquivo `dokploy-compose.yml`). Não há hml: o banco `forms_victor` e o bucket
`forms-victor` são os de produção. A virada foi em 04/10/2026.

O compose antigo "frontend" (portal legado) ficou sem domínio e com o deploy automático desligado; ele é parado no
passo 14 da "Virada" e não volta a ser ligado.

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

## Depois da virada

A virada foi em 04/10/2026: o compose "full" (banco `forms_victor`, bucket `forms-victor`) é a produção em
`reforma-tributaria.austercontabil.com.br`, observando a `main`. Não há hml. Falta:

1. Parar o compose "frontend", sem apagar.
2. Depois de 30 dias, nesta ordem:
   - tirar a montagem `legacy-data:/legacy:ro` e o bloco `volumes:` do topo do `dokploy-compose.yml`, e fazer o deploy;
   - só então apagar o volume do portal antigo e tirar o `LEGACY_VOLUME_NAME` do painel.

   Com o volume apagado e a montagem ainda no arquivo, todo deploy do "full" falha com "external volume not found".