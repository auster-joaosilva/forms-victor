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

## Segurança

- Nenhum segredo no repositório. Variáveis validadas por Zod em `server/shared/env.ts`.
- O QSA da consulta de CNPJ nunca é exibido nem gravado.
- O hash do termo e o diagnóstico gravado são calculados pelo servidor, nunca aceitos do navegador.
- Os endpoints `/api/auth/admin/*` são fechados ao navegador. Gestão de usuário passa por `server/identity`.

## Git — em toda implementação

1. `git switch main && git switch -c <tipo>/<assunto>`
2. Commits pequenos, Conventional Commits, descrição em português:
   `feat(diagnostico): …`, `fix(adesao): …`. **Sem `Co-Authored-By`.**
3. `pnpm db:up` e depois `pnpm lint && pnpm typecheck && pnpm test` — tudo limpo.
4. `git switch main && git merge --no-ff <branch> -m "merge: <assunto>"`
5. `git push origin main` e `git branch -d <branch>`.
6. **Nunca** enviar outra branch ao remoto.

**Push na `main` é deploy.** O Dokploy publica a `main` em
`hml-reforma.austercontabil.com.br` a cada push (compose "hml", arquivo
`dokploy-compose.yml`). Depois da virada, é produção.

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

## Rodar

```bash
pnpm install
cp .env.example .env    # valores de desenvolvimento
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm auth:bootstrap-admin
pnpm dev                # http://localhost:3000
```
