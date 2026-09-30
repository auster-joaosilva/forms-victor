# Fundação da reescrita — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir a base do projeto novo (TanStack Start + Prisma/Postgres + MinIO + better-auth, bullet-proof no front e hexagonal no back) com o motor de decisão portado para TypeScript sem mudar nenhuma recomendação, e publicar em `hml-reforma.austercontabil.com.br`.

**Architecture:** App único. `src/app` (rotas) e `src/features` (bullet-proof) no front; `src/server/<módulo>/{domain,application,ports,adapters}` + `composition.ts` no back. O front fala com o back só por server functions de `features/*/api`. O motor antigo fica em `legacy/` até o teste de paridade provar que o novo devolve o mesmo resultado, e então é apagado.

**Tech Stack:** TanStack Start 1.168 / Router 1.170 / Query 5.104, React 19, Vite 8, Prisma 7.10 + `@prisma/adapter-pg`, PostgreSQL 17, MinIO via `@aws-sdk/client-s3` 3, better-auth 1.7 (`username`, `admin`), Tailwind 4 + shadcn 4, Zod 4, Vitest 5, ESLint 10 + `typescript-eslint` + `eslint-plugin-boundaries` 7, TypeScript 6.0, pnpm 12, srvx 1.

**Spec:** `docs/superpowers/specs/2026-09-30-foundation-design.md`

## Global Constraints

- Identificadores em inglês: funções, variáveis, tipos, propriedades de objeto, arquivos, rotas, tabelas, colunas, valores de enum do Prisma.
- Texto de tela em português.
- **Valores de domínio ficam como estão** (são dado gravado ou prova jurídica): chaves e valores das perguntas (`receitaPorCliente`, `nao_sei`, `de_20_40`), ids de gatilho (`gate_margem_critica`), códigos de saída (`A`…`ESPECIAL-MEI`), chaves de posição (`hibrido_a_confirmar`), ids de ação, níveis (`ALTA`, `MÉDIA`, `BAIXA`), `certeza` (`fechada`/`aberta`), famílias (`padrao`, `hibrido`, `a_definir`, `nao_se_aplica`) e **o objeto do termo V4 inteiro, com as chaves em português**.
- Sem comentário desnecessário. Comentário só para um porquê que o código não diz (regra de lei, armadilha medida). Ao portar, os comentários longos do código antigo viram, no máximo, uma linha com a referência legal.
- TypeScript `strict`, sem `any`.
- Nada local: proibidos `localStorage`, `sessionStorage`, IndexedDB e escrita em disco pelo app. Estado no Postgres, arquivo no MinIO. No navegador, só cookies `httpOnly` de identificador.
- Nenhum segredo no repositório. `.env.test` e `docker-compose.yml` só carregam credenciais de desenvolvimento local.
- `TZ=America/Sao_Paulo` em teste e em produção.
- Git em toda tarefa: `git switch -c <tipo>/<assunto>` a partir da `main`; Conventional Commits com descrição em português; **sem `Co-Authored-By`**; antes do merge, `pnpm lint && pnpm typecheck && pnpm test`; depois `git switch main && git merge --no-ff <branch> -m "merge: <assunto>"` e `git branch -d <branch>`. Nunca mandar outra branch ao remoto.
- **Push bloqueado até a Tarefa I-4** (compose antigo com `autoDeploy` desligado). Antes disso, qualquer push na `main` rebuilda a produção atual.
- Tarefas marcadas **[INFRA]** são executadas em sessão separada, pelo MCP `dokploy-vps`. Nada por SSH.

## Fronteiras (travadas por lint na Tarefa 1)

| De | Pode importar |
|---|---|
| `src/app/**` | `features/**`, `components/**`, `lib/**`, `hooks/**`, `config/**`, `server/*/domain/**`, `server/shared/domain/**`, e, só em arquivos de rota com `server.handlers`, `server/*/composition.ts` e `server/shared/http/**` |
| `src/features/<f>/api/**` | `server/*/composition.ts`, `server/shared/http/**`, `server/*/domain/**`, `server/shared/domain/**`, `lib/**`, a própria feature |
| `src/features/<f>/**` (fora de `api`) | a própria feature, `components/**`, `lib/**`, `hooks/**`, `config/**`, `server/*/domain/**`, `server/shared/domain/**` |
| `src/components/**`, `src/lib/**`, `src/hooks/**` | entre si, `config/**` |
| `src/server/<m>/domain/**` | o próprio `domain`, `server/shared/domain/**` |
| `src/server/<m>/application/**` | o próprio `domain`, o próprio `ports` |
| `src/server/<m>/ports/**` | o próprio `domain` |
| `src/server/<m>/adapters/**` | o próprio `ports`, o próprio `domain`, `server/shared/**` |
| `src/server/<m>/composition.ts` | o próprio módulo inteiro, `server/shared/**`, `server/*/composition.ts` |
| `src/server/shared/**` | `server/shared/**` e, só em `shared/auth`, `server/audit/composition.ts` |

`server/*/domain` e `server/shared/domain` são isomórficos: TS puro, sem `node:*`, sem `process`, sem IO.

## Mapa de arquivos

```
AGENTS.md  CLAUDE.md  README.md  .gitattributes  .gitignore  .env.example  .env.test
package.json  pnpm-workspace.yaml  tsconfig.json  vite.config.ts  vitest.config.ts
eslint.config.js  prettier.config.js  components.json  prisma.config.ts
Dockerfile  .dockerignore  dokploy-compose.yml  docker-compose.yml  server.ts
prisma/schema.prisma  prisma/migrations/**  prisma/seed.ts  prisma/seed-assets/house-photos/*.jpg
scripts/bootstrap-admin.ts  scripts/sweep.ts  scripts/sweep-weighted.ts
docs/legacy/README.md  docs/legacy/IMPLANTACAO.md
legacy/**                                   (removido na Tarefa 20)
src/router.tsx  src/start.ts
src/app/routeTree.gen.ts                    (gerado)
src/app/routes/__root.tsx  index.tsx  health.ts  login.tsx  logout.tsx
src/app/routes/api/auth/$.ts  files/$fileId.ts  backoffice/route.tsx  backoffice/index.tsx
src/app/legacy-redirects.ts
src/styles/app.css
src/components/ui/*                         (shadcn)
src/components/brand/auster-mark.tsx
src/lib/utils.ts  src/lib/auth-client.ts  src/lib/query-client.ts
src/features/auth/api/session.ts  src/features/auth/components/login-form.tsx
src/server/shared/env.ts  src/server/shared/prisma/client.ts  src/server/shared/prisma/generated/** (gerado)
src/server/shared/auth/auth.ts  src/server/shared/http/session-middleware.ts  src/server/shared/http/request-origin.ts
src/server/shared/domain/validation.ts
src/server/diagnosis/domain/{simples-rates,questions,question-types,thresholds,derived-metrics,confidence,outcomes,deadline,radar,diagnose,action-plan,company}.ts
src/server/diagnosis/domain/testing/fill-generator.ts
src/server/adhesion/domain/term.ts
src/server/audit/{domain,application,ports,adapters}/**  composition.ts
src/server/rate-limit/{domain,application,ports,adapters}/**  composition.ts
src/server/storage/{domain,application,ports,adapters}/**  composition.ts
src/server/identity/{domain,application,ports,adapters}/**  composition.ts
src/server/company-lookup/{domain,application,ports,adapters}/**  composition.ts
src/server/health/{application,ports,adapters}/**  composition.ts
tests/setup.ts  tests/integration/global-setup.ts  tests/integration/db.ts
```

---

### Task 1: Esqueleto, regras do projeto e código antigo em `legacy/`

**Files:**
- Move: `servidor.mjs construir.mjs testes.mjs testes_servidor.mjs varredura.mjs varredura_pesos.mjs modelo*.html backoffice.html entrar.html Dockerfile docker-compose.yml .dockerignore ferramentas/ ativos/ src/*.js src/*.mjs` → `legacy/` (mesma estrutura: `legacy/src/motor.js` etc.)
- Move: `README.md`, `IMPLANTACAO.md` → `docs/legacy/`
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `prettier.config.js`, `.gitattributes`, `.gitignore`, `tests/setup.ts`, `src/router.tsx`, `src/app/routes/__root.tsx`, `src/app/routes/index.tsx`, `src/lib/query-client.ts`, `src/styles/app.css`, `AGENTS.md`, `CLAUDE.md`, `README.md`

**Interfaces:**
- Produces: scripts `pnpm dev | build | start | lint | typecheck | test | test:unit | test:int | db:up | db:down | db:migrate | db:seed | auth:bootstrap-admin | sweep | sweep:weighted`; alias `@/` → `src/`; `getRouter()` em `src/router.tsx`; `queryClient` em `src/lib/query-client.ts`.

- [ ] **Step 1: Branch e mover o código antigo**

```bash
git switch main
git switch -c chore/foundation-skeleton
mkdir -p legacy/src docs/legacy
git mv servidor.mjs construir.mjs testes.mjs testes_servidor.mjs varredura.mjs varredura_pesos.mjs legacy/
git mv modelo.html modelo_adesao.html modelo_evento.html modelo_principal.html backoffice.html entrar.html legacy/
git mv Dockerfile docker-compose.yml .dockerignore legacy/
git mv ferramentas ativos legacy/
git mv src/acoes.js src/banco.mjs src/consulta_cnpj.js src/motor.js src/perguntas.js src/simples.js src/termo.js src/validacao.js legacy/src/
git mv README.md IMPLANTACAO.md docs/legacy/
git mv package.json legacy/package.json
mkdir -p prisma/seed-assets/house-photos
cp legacy/ativos/imagens/*.jpg prisma/seed-assets/house-photos/
```

`legacy/package.json` mantém `"type": "module"`, e é isso que deixa o Vitest importar `legacy/src/*.js` como ESM.

- [ ] **Step 2: `package.json`**

```json
{
  "name": "forms-victor",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.6.0",
  "engines": { "node": ">=22.12" },
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "node --experimental-strip-types server.ts",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:int": "vitest run --project integration",
    "db:up": "docker compose up -d --wait",
    "db:down": "docker compose down",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:seed": "tsx prisma/seed.ts",
    "auth:bootstrap-admin": "tsx scripts/bootstrap-admin.ts",
    "sweep": "tsx scripts/sweep.ts",
    "sweep:weighted": "tsx scripts/sweep-weighted.ts"
  }
}
```

- [ ] **Step 3: Dependências**

```bash
pnpm add tsx @tanstack/react-start@1.168.59 @tanstack/react-router@1.170.40 @tanstack/react-query@5.104.0 react@19.3.0 react-dom@19.3.0 better-auth@1.7.6 @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0 pg @aws-sdk/client-s3@3 zod@4.6.5 srvx@1.0.5 clsx tailwind-merge class-variance-authority lucide-react
pnpm add -D prisma@7.10.0 typescript@6.0.3 vite@8.3.1 @vitejs/plugin-react@6.1.1 vite-tsconfig-paths@6.1.1 tailwindcss@4.3.3 @tailwindcss/vite@4.3.3 vitest@5.0.3 eslint@10.11.0 typescript-eslint eslint-plugin-boundaries@7.2.0 prettier @types/node@22 @types/react @types/react-dom @types/pg
```

O `tsx` fica em `dependencies` (não em dev): os scripts de seed e bootstrap rodam dentro do container de produção, e só o `tsx` resolve o alias `@/` e os imports sem extensão.

`pnpm-workspace.yaml` (o pnpm 12 bloqueia scripts de build sem lista explícita):

```yaml
allowBuilds:
  - prisma
  - "@prisma/engines"
  - esbuild
```

Rodar `pnpm install` de novo e conferir que não sobra aviso "Ignored build scripts".

- [ ] **Step 4: `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `tests/setup.ts`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowJs": true,
    "checkJs": false,
    "types": ["node", "vite/client"],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "tests", "scripts", "prisma", "*.ts"],
  "exclude": ["legacy", "node_modules", "dist"]
}
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      router: { routesDirectory: 'app/routes', generatedRouteTree: 'app/routeTree.gen.ts' },
    }),
    viteReact(),
  ],
})
```

Se o plugin recusar as opções de `router`, os nomes válidos estão em `node_modules/@tanstack/start-plugin-core/dist/esm/schema.d.ts`; os caminhos são relativos a `srcDirectory` (padrão `src`).

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    setupFiles: ['tests/setup.ts'],
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'], exclude: ['**/*.int.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.int.test.ts'],
          globalSetup: ['tests/integration/global-setup.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
})
```

```ts
// tests/setup.ts
process.env.TZ = 'America/Sao_Paulo'
```

Até a Tarefa 4 existir, crie `tests/integration/global-setup.ts` com `export default async function setup() {}` para o projeto `integration` não falhar.

- [ ] **Step 5: Rotas mínimas, router e estilo base**

```ts
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })
}
```

```tsx
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './app/routeTree.gen'
import { createQueryClient } from './lib/query-client'

export function getRouter() {
  const queryClient = createQueryClient()
  const router = createRouter({ routeTree, context: { queryClient }, scrollRestoration: true, defaultPreload: 'intent' })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
```

Adicione `pnpm add @tanstack/react-router-ssr-query@1.170.40`.

```tsx
// src/app/routes/__root.tsx
import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import appCss from '@/styles/app.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'robots', content: 'noindex, nofollow' },
      { title: 'Auster Inteligência Contábil' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Kanit:wght@200;300;400;500;600&display=swap' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

```tsx
// src/app/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  return (
    <main className="mx-auto max-w-[820px] px-6 py-16">
      <h1 className="text-[28px] font-normal text-auster-dark">Auster Inteligência Contábil</h1>
      <p className="mt-2 text-sm text-auster-gray">Ambiente de homologação.</p>
    </main>
  )
}
```

```css
/* src/styles/app.css */
@import 'tailwindcss';

@theme {
  --font-sans: Kanit, Montserrat, Raleway, Arial, sans-serif;
  --color-auster-dark: #052c47;
  --color-auster-light: #71cfeb;
  --color-auster-accent: #007e99;
  --color-auster-ink: #052c47;
  --color-auster-gray: #5b6b78;
  --color-auster-background: #f1f5f8;
  --color-auster-border: #cfd9e0;
  --color-auster-border-strong: #8496a5;
  --color-auster-high: #b63b32;
  --color-auster-medium: #9a6608;
  --color-auster-low: #2f7d52;
  --color-auster-unknown: #7a5200;
  --color-auster-unknown-bg: #fdf4e3;
}

body {
  background: var(--color-auster-background);
  color: var(--color-auster-ink);
  font-family: var(--font-sans);
  font-weight: 300;
  line-height: 1.55;
}
```

- [ ] **Step 6: ESLint com fronteiras e Prettier**

```js
// eslint.config.js
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'

export default tseslint.config(
  { ignores: ['legacy/**', 'dist/**', '.output/**', 'src/app/routeTree.gen.ts', 'src/server/shared/prisma/generated/**', 'src/components/ui/**'] },
  ...tseslint.configs.strict,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**', mode: 'full' },
        { type: 'entry', pattern: ['src/router.tsx', 'src/start.ts'], mode: 'full' },
        { type: 'feature-api', pattern: 'src/features/*/api/**', capture: ['feature'], mode: 'full' },
        { type: 'feature', pattern: 'src/features/*/**', capture: ['feature'], mode: 'full' },
        { type: 'shared-ui', pattern: ['src/components/**', 'src/lib/**', 'src/hooks/**', 'src/config/**', 'src/styles/**'], mode: 'full' },
        { type: 'shared-domain', pattern: 'src/server/shared/domain/**', mode: 'full' },
        { type: 'server-shared', pattern: 'src/server/shared/**', mode: 'full' },
        { type: 'domain', pattern: 'src/server/*/domain/**', capture: ['module'], mode: 'full' },
        { type: 'application', pattern: 'src/server/*/application/**', capture: ['module'], mode: 'full' },
        { type: 'ports', pattern: 'src/server/*/ports/**', capture: ['module'], mode: 'full' },
        { type: 'adapters', pattern: 'src/server/*/adapters/**', capture: ['module'], mode: 'full' },
        { type: 'composition', pattern: 'src/server/*/composition.ts', capture: ['module'], mode: 'full' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'app', allow: ['app', 'feature', 'feature-api', 'shared-ui', 'domain', 'shared-domain', 'composition', 'server-shared'] },
            { from: 'entry', allow: ['app', 'shared-ui'] },
            { from: 'feature-api', allow: [['feature', { feature: '${from.feature}' }], ['feature-api', { feature: '${from.feature}' }], 'composition', 'server-shared', 'domain', 'shared-domain', 'shared-ui'] },
            { from: 'feature', allow: [['feature', { feature: '${from.feature}' }], ['feature-api', { feature: '${from.feature}' }], 'shared-ui', 'domain', 'shared-domain'] },
            { from: 'shared-ui', allow: ['shared-ui'] },
            { from: 'shared-domain', allow: ['shared-domain'] },
            { from: 'domain', allow: [['domain', { module: '${from.module}' }], 'shared-domain'] },
            { from: 'application', allow: [['domain', { module: '${from.module}' }], ['ports', { module: '${from.module}' }], ['application', { module: '${from.module}' }], 'shared-domain'] },
            { from: 'ports', allow: [['domain', { module: '${from.module}' }], 'shared-domain'] },
            { from: 'adapters', allow: [['ports', { module: '${from.module}' }], ['domain', { module: '${from.module}' }], ['adapters', { module: '${from.module}' }], 'server-shared', 'shared-domain'] },
            { from: 'composition', allow: [['domain', { module: '${from.module}' }], ['application', { module: '${from.module}' }], ['ports', { module: '${from.module}' }], ['adapters', { module: '${from.module}' }], 'composition', 'server-shared', 'shared-domain'] },
            { from: 'server-shared', allow: ['server-shared', 'shared-domain', 'composition'] },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'localStorage', 'sessionStorage', 'indexedDB'],
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[property.name=/^(localStorage|sessionStorage|indexedDB)$/]", message: 'Nada local: estado vai para o Postgres.' },
      ],
    },
  },
  {
    files: ['src/server/*/domain/**', 'src/server/shared/domain/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['node:*', '@prisma/*', '@aws-sdk/*', 'better-auth*'] }],
      'no-restricted-globals': ['error', 'process', 'fetch', 'localStorage', 'sessionStorage', 'indexedDB'],
    },
  },
)
```

Adicione `pnpm add -D eslint-import-resolver-typescript`. O `app`, quando importa `composition`, só pode fazer isso em arquivo de rota com `server.handlers`. Essa parte é regra de revisão, não de lint: está no `AGENTS.md`.

```js
// prettier.config.js
export default { semi: false, singleQuote: true, trailingComma: 'all', printWidth: 110 }
```

- [ ] **Step 7: `.gitattributes`, `.gitignore`**

```
# .gitattributes
* text=auto
*.sh text eol=lf
*.jpg binary
```

```
# .gitignore
node_modules/
dist/
.output/
.tanstack/
.vinxi/
.env
.env.local
src/app/routeTree.gen.ts
src/server/shared/prisma/generated/
*.log
.claude/
```

- [ ] **Step 8: `CLAUDE.md`, `AGENTS.md`, `README.md`**

`CLAUDE.md`:

```markdown
Leia e siga o AGENTS.md.
```

`AGENTS.md`:

````markdown
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
````

`README.md`:

```markdown
# Portal Auster — Simples Nacional e Reforma Tributária

Regras de código, estrutura e fluxo de trabalho: [AGENTS.md](AGENTS.md).
Especificações e planos: `docs/superpowers/`. Histórico do portal anterior: `docs/legacy/`.
```

- [ ] **Step 9: Verificar**

Run: `pnpm dev` e abrir `http://localhost:3000`
Expected: a página "Auster Inteligência Contábil / Ambiente de homologação" em Kanit, sem erro no console; `src/app/routeTree.gen.ts` gerado.

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: lint e typecheck limpos; o Vitest diz "No test files found" nos dois projetos e sai com 0. Se sair com 1, acrescente `passWithNoTests: true` a `test` no `vitest.config.ts`.

- [ ] **Step 10: Commit e merge**

```bash
git add -A
git commit -m "chore(base): esqueleto TanStack Start, regras do projeto e código antigo em legacy/"
git switch main && git merge --no-ff chore/foundation-skeleton -m "merge: esqueleto da fundação" && git branch -d chore/foundation-skeleton
```

---

### Task 2: Ambiente validado

**Files:**
- Create: `src/server/shared/env.ts`, `src/server/shared/env.test.ts`, `.env.example`, `.env.test`

**Interfaces:**
- Produces: `parseEnv(source: Record<string, string | undefined>): Env`, `getEnv(): Env`, `type Env`.

- [ ] **Step 1: Teste que falha**

```ts
// src/server/shared/env.test.ts
import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

const valid = {
  DATABASE_URL: 'postgresql://app:app@localhost:5432/forms_victor_dev',
  S3_ENDPOINT: 'localhost:9000',
  S3_BUCKET: 'forms-victor-dev',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  APP_PUBLIC_URL: 'http://localhost:3000',
}

describe('parseEnv', () => {
  it('accepts a complete environment and applies defaults', () => {
    const env = parseEnv(valid)
    expect(env.PORT).toBe(3000)
    expect(env.S3_USE_SSL).toBe(false)
    expect(env.ADHESION_WINDOW_END).toBe('2026-09-30')
  })

  it('rejects an S3 endpoint written as URL', () => {
    expect(() => parseEnv({ ...valid, S3_ENDPOINT: 'http://minio:9000' })).toThrow(/S3_ENDPOINT/)
  })

  it('rejects a short auth secret', () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: 'short' })).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('rejects a missing database url', () => {
    const { DATABASE_URL: _omit, ...rest } = valid
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/server/shared/env.test.ts`
Expected: FAIL, `Cannot find module './env'`.

- [ ] **Step 3: Implementar**

```ts
// src/server/shared/env.ts
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  S3_ENDPOINT: z.string().regex(/^[a-z0-9.-]+:\d+$/, 'S3_ENDPOINT é host:porta, sem protocolo'),
  S3_USE_SSL: z.stringbool().default(false),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(3),
  S3_SECRET_KEY: z.string().min(8),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  APP_PUBLIC_URL: z.url(),
  ADHESION_WINDOW_END: z.iso.date().default('2026-09-30'),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    throw new Error(`Ambiente inválido — ${problems.join('; ')}`)
  }
  return result.data
}

let cached: Env | undefined

export function getEnv(): Env {
  cached ??= parseEnv(process.env)
  return cached
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/server/shared/env.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 5: `.env.example` e `.env.test`**

```bash
# .env.example — copie para .env. Em produção os valores ficam no painel do Dokploy.
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://app:app@localhost:5432/forms_victor_dev
S3_ENDPOINT=localhost:9000
S3_USE_SSL=false
S3_BUCKET=forms-victor-dev
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
BETTER_AUTH_SECRET=troque-por-32-caracteres-aleatorios-ou-mais
BETTER_AUTH_URL=http://localhost:3000
APP_PUBLIC_URL=http://localhost:3000
ADHESION_WINDOW_END=2026-09-30
# Só para pnpm auth:bootstrap-admin; apague depois de usar.
BOOTSTRAP_ADMIN_USERNAME=
BOOTSTRAP_ADMIN_PASSWORD=
```

`.env.test` tem o mesmo conteúdo, com `NODE_ENV=test`, `DATABASE_URL=postgresql://app:app@localhost:5432/forms_victor_test`, `S3_BUCKET=forms-victor-test` e `BETTER_AUTH_SECRET=test-secret-test-secret-test-secret-00`.

Em `tests/setup.ts`, acrescente o carregamento do `.env.test` (o Node 22 lê arquivo de env nativamente):

```ts
process.env.TZ = 'America/Sao_Paulo'
process.loadEnvFile('.env.test')
```

- [ ] **Step 6: Commit e merge**

```bash
git switch -c feat/env
git add src/server/shared/env.ts src/server/shared/env.test.ts .env.example .env.test tests/setup.ts
git commit -m "feat(config): variáveis de ambiente validadas na subida"
pnpm lint && pnpm typecheck && pnpm test
git switch main && git merge --no-ff feat/env -m "merge: ambiente validado" && git branch -d feat/env
```

(Nas próximas tarefas o bloco de branch, commit e merge segue esta mesma forma: a branch é criada **antes** do Step 1.)

---

### Task 3: Banco — schema completo, Postgres e MinIO locais

**Files:**
- Create: `docker-compose.yml`, `prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/**`, `src/server/shared/prisma/client.ts`, `tests/integration/global-setup.ts`, `tests/integration/db.ts`, `src/server/shared/prisma/client.int.test.ts`

**Interfaces:**
- Produces: `prisma` (instância única de `PrismaClient`) em `@/server/shared/prisma/client`; tipos gerados em `@/server/shared/prisma/generated/client`; `resetDatabase(): Promise<void>` em `tests/integration/db.ts`.

- [ ] **Step 1: `docker-compose.yml` de desenvolvimento**

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: forms_victor_dev
      TZ: America/Sao_Paulo
    ports: ['5432:5432']
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U app']
      interval: 2s
      retries: 20
  minio:
    image: pgsty/minio:RELEASE.2026-06-18T00-00-00Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ['9000:9000', '9001:9001']
    volumes: [miniodata:/data]
    healthcheck:
      test: ['CMD', 'mc', 'ready', 'local']
      interval: 2s
      retries: 20
volumes:
  pgdata:
  miniodata:
```

Run: `pnpm db:up`
Expected: os dois serviços `healthy`. (O Docker Desktop precisa estar aberto.)

Run: `docker compose exec postgres psql -U app -d forms_victor_dev -c "CREATE DATABASE forms_victor_test"`
Expected: `CREATE DATABASE`.

- [ ] **Step 2: `prisma.config.ts` e `schema.prisma`**

```ts
// prisma.config.ts
import { defineConfig, env } from 'prisma/config'

process.loadEnvFile?.('.env')

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: env('DATABASE_URL') },
})
```

Se `.env` não existir, o `loadEnvFile` lança erro. Envolva em `try { process.loadEnvFile('.env') } catch {}`: em produção as variáveis vêm do ambiente.

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../src/server/shared/prisma/generated"
}

datasource db {
  provider = "postgresql"
}

enum UserRole {
  admin
  team
}

enum ResponseStatus {
  new
  in_review
  validated
  discarded
}

enum AdhesionModality {
  standard
  hybrid
}

enum WithoutManifestation {
  cancel
  keep
}

enum AdhesionStatus {
  received
  filed
  cancelled
}

enum EventStatus {
  draft
  published
  closed
}

enum RegistrationWindow {
  open
  closed
}

enum SessionFormat {
  in_person
  online
}

enum RegistrationStatus {
  registered
  confirmed
  present
  absent
  cancelled
}

enum FileKind {
  house_photo
  event_cover
  speaker_photo
}

model User {
  id              String    @id
  name            String
  email           String    @unique
  emailVerified   Boolean   @default(false) @map("email_verified")
  image           String?
  username        String?   @unique
  displayUsername String?   @map("display_username")
  role            String    @default("team")
  banned          Boolean   @default(false)
  banReason       String?   @map("ban_reason")
  banExpires      DateTime? @map("ban_expires") @db.Timestamptz
  lastLoginAt     DateTime? @map("last_login_at") @db.Timestamptz
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  sessions            Session[]
  accounts            Account[]
  invitationsCreated  Invitation[]   @relation("InvitationCreatedBy")
  responsesHandled    Response[]     @relation("ResponseHandledBy")
  adhesionsHandled    Adhesion[]     @relation("AdhesionHandledBy")
  eventsCreated       Event[]        @relation("EventCreatedBy")
  eventsUpdated       Event[]        @relation("EventUpdatedBy")
  registrationsHandled Registration[] @relation("RegistrationHandledBy")
  filesCreated        StoredFile[]
  auditEntries        AuditLog[]

  @@map("users")
}

model Session {
  id             String   @id
  expiresAt      DateTime @map("expires_at") @db.Timestamptz
  token          String   @unique
  ipAddress      String?  @map("ip_address")
  userAgent      String?  @map("user_agent")
  impersonatedBy String?  @map("impersonated_by")
  userId         String   @map("user_id")
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@index([userId])
  @@map("sessions")
}

model Account {
  id                    String    @id
  accountId             String    @map("account_id")
  providerId            String    @map("provider_id")
  userId                String    @map("user_id")
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?   @map("access_token")
  refreshToken          String?   @map("refresh_token")
  idToken               String?   @map("id_token")
  accessTokenExpiresAt  DateTime? @map("access_token_expires_at") @db.Timestamptz
  refreshTokenExpiresAt DateTime? @map("refresh_token_expires_at") @db.Timestamptz
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  @@index([userId])
  @@map("accounts")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime @map("expires_at") @db.Timestamptz
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@index([identifier])
  @@map("verifications")
}

model RateLimit {
  id          String @id
  key         String @unique
  count       Int
  lastRequest BigInt @map("last_request")

  @@map("auth_rate_limits")
}

model Invitation {
  token        String     @id
  companyName  String?    @map("company_name")
  cnpj         String?
  email        String?
  note         String?
  openCount    Int        @default(0) @map("open_count")
  lastOpenedAt DateTime?  @map("last_opened_at") @db.Timestamptz
  createdAt    DateTime   @default(now()) @map("created_at") @db.Timestamptz
  createdById  String?    @map("created_by_id")
  createdBy    User?      @relation("InvitationCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  responses    Response[]
  adhesions    Adhesion[]

  @@map("invitations")
}

model DiagnosisDraft {
  id        String   @id @default(uuid()) @db.Uuid
  step      Int      @default(1)
  payload   Json
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  expiresAt DateTime @map("expires_at") @db.Timestamptz

  @@index([expiresAt])
  @@map("diagnosis_drafts")
}

model Response {
  id              Int            @id @default(autoincrement())
  protocol        String         @unique
  invitationToken String?        @map("invitation_token")
  invitation      Invitation?    @relation(fields: [invitationToken], references: [token], onDelete: SetNull)
  receivedAt      DateTime       @default(now()) @map("received_at") @db.Timestamptz
  companyName     String?        @map("company_name")
  cnpj            String?
  cnpjDigits      String?        @map("cnpj_digits")
  requester       String?
  email           String?
  phone           String?
  formVersion     String?        @map("form_version")
  outcome         String?
  position        String?
  certainty       String?
  urgency         String?
  confidence      String?
  requesterInQsa  Boolean?       @map("requester_in_qsa")
  payload         Json
  status          ResponseStatus @default(new)
  internalNote    String?        @map("internal_note")
  handledById     String?        @map("handled_by_id")
  handledBy       User?          @relation("ResponseHandledBy", fields: [handledById], references: [id], onDelete: SetNull)
  handledAt       DateTime?      @map("handled_at") @db.Timestamptz
  adhesions       Adhesion[]
  registrations   Registration[]

  @@index([status])
  @@index([receivedAt])
  @@index([cnpjDigits])
  @@map("responses")
}

model Adhesion {
  id                   Int                   @id @default(autoincrement())
  protocol             String                @unique
  responseId           Int?                  @map("response_id")
  response             Response?             @relation(fields: [responseId], references: [id], onDelete: SetNull)
  invitationToken      String?               @map("invitation_token")
  invitation           Invitation?           @relation(fields: [invitationToken], references: [token], onDelete: SetNull)
  acceptedAt           DateTime              @map("accepted_at") @db.Timestamptz
  companyName          String                @map("company_name")
  cnpj                 String
  cnpjDigits           String                @map("cnpj_digits")
  representative       String
  cpf                  String
  representativeRole   String                @map("representative_role")
  email                String
  phone                String?
  modality             AdhesionModality
  withoutManifestation WithoutManifestation? @map("without_manifestation")
  wantsProposal        Boolean               @default(false) @map("wants_proposal")
  termVersion          String                @map("term_version")
  termHash             String                @map("term_hash")
  originIp             String?               @map("origin_ip")
  originSource         String?               @map("origin_source")
  forwardedChain       String?               @map("forwarded_chain")
  userAgent            String?               @map("user_agent")
  payload              Json
  status               AdhesionStatus        @default(received)
  internalNote         String?               @map("internal_note")
  handledById          String?               @map("handled_by_id")
  handledBy            User?                 @relation("AdhesionHandledBy", fields: [handledById], references: [id], onDelete: SetNull)
  handledAt            DateTime?             @map("handled_at") @db.Timestamptz

  @@index([acceptedAt])
  @@index([status])
  @@index([modality])
  @@index([cnpjDigits])
  @@map("adhesions")
}

model Event {
  id            Int                @id @default(autoincrement())
  slug          String             @unique
  title         String
  status        EventStatus        @default(draft)
  registrations RegistrationWindow @default(open)
  content       Json
  createdAt     DateTime           @default(now()) @map("created_at") @db.Timestamptz
  createdById   String?            @map("created_by_id")
  createdBy     User?              @relation("EventCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  updatedAt     DateTime?          @map("updated_at") @db.Timestamptz
  updatedById   String?            @map("updated_by_id")
  updatedBy     User?              @relation("EventUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)
  sessions      EventSession[]
  entries       Registration[]

  @@map("events")
}

model EventSession {
  id            Int            @id @default(autoincrement())
  eventId       Int            @map("event_id")
  event         Event          @relation(fields: [eventId], references: [id], onDelete: Cascade)
  order         Int            @default(0)
  date          DateTime       @db.Date
  time          String
  format        SessionFormat  @default(in_person)
  title         String
  description   String?
  location      String?
  seats         Int?
  registrations Registration[]

  @@index([eventId])
  @@map("event_sessions")
}

model Registration {
  id             Int                @id @default(autoincrement())
  protocol       String             @unique
  eventId        Int                @map("event_id")
  event          Event              @relation(fields: [eventId], references: [id])
  sessionId      Int                @map("session_id")
  session        EventSession       @relation(fields: [sessionId], references: [id])
  responseId     Int?               @map("response_id")
  response       Response?          @relation(fields: [responseId], references: [id], onDelete: SetNull)
  createdAt      DateTime           @default(now()) @map("created_at") @db.Timestamptz
  name           String
  email          String
  phone          String?
  company        String?
  cnpj           String?
  cnpjDigits     String?            @map("cnpj_digits")
  jobTitle       String?            @map("job_title")
  privacyConsent Boolean            @default(false) @map("privacy_consent")
  originIp       String?            @map("origin_ip")
  userAgent      String?            @map("user_agent")
  payload        Json
  status         RegistrationStatus @default(registered)
  internalNote   String?            @map("internal_note")
  handledById    String?            @map("handled_by_id")
  handledBy      User?              @relation("RegistrationHandledBy", fields: [handledById], references: [id], onDelete: SetNull)
  handledAt      DateTime?          @map("handled_at") @db.Timestamptz

  @@index([eventId])
  @@index([sessionId])
  @@index([cnpjDigits])
  @@index([email])
  @@map("registrations")
}

model StoredFile {
  id           String   @id @default(uuid()) @db.Uuid
  bucket       String
  key          String   @unique
  originalName String?  @map("original_name")
  contentType  String   @map("content_type")
  size         Int
  sha256       String
  kind         FileKind
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  createdById  String?  @map("created_by_id")
  createdBy    User?    @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@index([kind])
  @@map("stored_files")
}

model AuditLog {
  id            Int      @id @default(autoincrement())
  occurredAt    DateTime @default(now()) @map("occurred_at") @db.Timestamptz
  actorId       String?  @map("actor_id")
  actor         User?    @relation(fields: [actorId], references: [id], onDelete: SetNull)
  actorUsername String?  @map("actor_username")
  action        String
  reference     String?
  detail        Json?

  @@index([occurredAt])
  @@map("audit_logs")
}

model RateLimitHit {
  key         String
  windowStart DateTime @map("window_start") @db.Timestamptz
  count       Int      @default(0)

  @@id([key, windowStart])
  @@index([windowStart])
  @@map("rate_limit_hits")
}
```

- [ ] **Step 3: Migração inicial com as regras que o Prisma não expressa**

Acrescente ao `package.json` o script `"postinstall": "prisma generate"` (agora o schema existe).

Run: `pnpm prisma migrate dev --name init --create-only`
Expected: `prisma/migrations/<timestamp>_init/migration.sql` criado.

Acrescente ao fim desse `migration.sql`:

```sql
CREATE UNIQUE INDEX "registrations_session_email_active_key"
  ON "registrations" ("session_id", lower("email"))
  WHERE "status" <> 'cancelled';

CREATE OR REPLACE FUNCTION audit_logs_block_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs aceita só inserção';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_changes();
```

Run: `pnpm prisma migrate dev`
Expected: migração `init` aplicada e cliente gerado em `src/server/shared/prisma/generated`.

- [ ] **Step 4: Cliente único**

```ts
// src/server/shared/prisma/client.ts
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client'
import { getEnv } from '../env'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) })

if (getEnv().NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Se o gerador escrever o ponto de entrada com outro nome, use o que estiver em `generated/` (`client.ts`).

- [ ] **Step 5: Setup de integração**

```ts
// tests/integration/global-setup.ts
import { execSync } from 'node:child_process'

export default async function setup() {
  process.loadEnvFile('.env.test')
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit', env: process.env })
}
```

```ts
// tests/integration/db.ts
import { prisma } from '@/server/shared/prisma/client'

const tables = [
  'registrations', 'event_sessions', 'events', 'adhesions', 'responses', 'diagnosis_drafts',
  'invitations', 'stored_files', 'rate_limit_hits', 'auth_rate_limits', 'verifications',
  'sessions', 'accounts', 'users',
]

export async function resetDatabase() {
  await prisma.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_update')
  await prisma.$executeRawUnsafe(`TRUNCATE ${['audit_logs', ...tables].map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`)
  await prisma.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_update')
}
```

- [ ] **Step 6: Teste de integração que prova as duas regras em SQL**

```ts
// src/server/shared/prisma/client.int.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from './client'
import { resetDatabase } from '../../../../tests/integration/db'

describe('database rules', () => {
  beforeEach(resetDatabase)

  it('refuses to update an audit entry', async () => {
    const entry = await prisma.auditLog.create({ data: { action: 'probe' } })
    await expect(prisma.auditLog.update({ where: { id: entry.id }, data: { action: 'changed' } })).rejects.toThrow(
      /só inserção/,
    )
  })

  it('refuses a second active registration with the same e-mail in a session', async () => {
    const event = await prisma.event.create({ data: { slug: 'probe', title: 'Probe', content: {} } })
    const session = await prisma.eventSession.create({
      data: { eventId: event.id, date: new Date('2026-10-20'), time: '19:00', title: 'Encontro' },
    })
    const base = { eventId: event.id, sessionId: session.id, name: 'Ana', payload: {} }
    await prisma.registration.create({ data: { ...base, protocol: 'INS-1', email: 'ana@x.com' } })
    await expect(
      prisma.registration.create({ data: { ...base, protocol: 'INS-2', email: 'ANA@x.com' } }),
    ).rejects.toThrow()
    await prisma.registration.update({ where: { protocol: 'INS-1' }, data: { status: 'cancelled' } })
    await expect(
      prisma.registration.create({ data: { ...base, protocol: 'INS-3', email: 'ana@x.com' } }),
    ).resolves.toBeTruthy()
  })
})
```

Run: `pnpm test:int`
Expected: PASS, 2 testes.

- [ ] **Step 7: Commit e merge** (`feat/database`, mensagem `feat(banco): schema completo, migração inicial e ambiente local`).

---

### Task 4: Validação compartilhada portada

Porte fiel de `legacy/src/validacao.js`. A lógica, as regex e as mensagens de erro ficam idênticas; só os nomes mudam.

**Files:**
- Create: `src/server/shared/domain/validation.ts`, `src/server/shared/domain/validation.test.ts`

**Interfaces:**
- Produces:
  - `maskCnpj(raw: string): string`, `isValidCnpj(raw: string): boolean`
  - `maskPhone(raw: string): string`, `isValidPhone(raw: string): boolean`
  - `isValidEmail(raw: string): boolean`, `isValidName(raw: string, minimum?: number): boolean`
  - `VALIDATORS: Record<'cnpj' | 'phone' | 'email' | 'companyName' | 'personName', { mask?: (raw: string) => string; validate: (raw: string) => boolean; error: string }>`

| Antigo | Novo |
|---|---|
| `mascararCnpj` | `maskCnpj` |
| `cnpjValido` | `isValidCnpj` |
| `mascararTelefone` | `maskPhone` |
| `telefoneValido` | `isValidPhone` |
| `emailValido` | `isValidEmail` |
| `nomeValido` | `isValidName` |
| `VALIDADORES` (`cnpj`, `telefone`, `email`, `nomeEmpresa`, `nomePessoa`; `mascara`, `valida`, `erro`) | `VALIDATORS` (`cnpj`, `phone`, `email`, `companyName`, `personName`; `mask`, `validate`, `error`) |

- [ ] **Step 1: Teste de paridade que falha**

```ts
// src/server/shared/domain/validation.test.ts
import { describe, expect, it } from 'vitest'
import * as legacy from '../../../../legacy/src/validacao.js'
import { VALIDATORS, isValidCnpj, isValidEmail, isValidName, isValidPhone, maskCnpj, maskPhone } from './validation'

const cnpjs = ['12.ABC.345/01DE-35', '11.222.333/0001-81', '11.111.111/1111-11', '12ABC34501DE3', 'ab.cde.fgh/ijkl-00', '']
const phones = ['(34) 99999-1234', '3432101234', '1199999123', '(00) 91234-5678', '34 2345-6789', '12']
const emails = ['a@b.co', 'a..b@c.com', '.a@b.com', 'a@b', 'nome.sobrenome+tag@empresa.com.br', 'a b@c.com']
const names = ['Ana', 'Jo', 'Ângela Souza', '---', 'A1']

describe('validation parity with legacy', () => {
  it.each(cnpjs)('cnpj %s', (value) => {
    expect(maskCnpj(value)).toBe(legacy.mascararCnpj(value))
    expect(isValidCnpj(value)).toBe(legacy.cnpjValido(value))
  })
  it.each(phones)('phone %s', (value) => {
    expect(maskPhone(value)).toBe(legacy.mascararTelefone(value))
    expect(isValidPhone(value)).toBe(legacy.telefoneValido(value))
  })
  it.each(emails)('email %s', (value) => expect(isValidEmail(value)).toBe(legacy.emailValido(value)))
  it.each(names)('name %s', (value) => {
    expect(isValidName(value)).toBe(legacy.nomeValido(value))
    expect(isValidName(value, 5)).toBe(legacy.nomeValido(value, 5))
  })
  it('keeps error messages', () => {
    expect(VALIDATORS.cnpj.error).toBe(legacy.VALIDADORES.cnpj.erro)
    expect(VALIDATORS.phone.error).toBe(legacy.VALIDADORES.telefone.erro)
    expect(VALIDATORS.email.error).toBe(legacy.VALIDADORES.email.erro)
    expect(VALIDATORS.companyName.error).toBe(legacy.VALIDADORES.nomeEmpresa.erro)
    expect(VALIDATORS.personName.error).toBe(legacy.VALIDADORES.nomePessoa.erro)
  })
  it('accepts the official alphanumeric example', () => expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(true))
})
```

- [ ] **Step 2:** Run `pnpm vitest run src/server/shared/domain/validation.test.ts`. Expected: FAIL, módulo não existe.
- [ ] **Step 3:** Copie `legacy/src/validacao.js` para `src/server/shared/domain/validation.ts`, tipe os parâmetros e os retornos, e renomeie pela tabela (inclusive variáveis internas, para o inglês). Remova os comentários que não explicam porquê; mantenha em uma linha a referência à IN RFB 2.229/2024 no `isValidCnpj`.
- [ ] **Step 4:** Run o mesmo teste. Expected: PASS.
- [ ] **Step 5: Commit e merge** (`feat/shared-validation`, `feat(dominio): validação de CNPJ, telefone, e-mail e nome em TS`).

---

### Task 5: Alíquota do Simples e perguntas portadas

**Files:**
- Create: `src/server/diagnosis/domain/simples-rates.ts`, `src/server/diagnosis/domain/question-types.ts`, `src/server/diagnosis/domain/questions.ts`, `src/server/diagnosis/domain/questions.test.ts`

**Interfaces:**
- Consumes: `VALIDATORS`, `isValid*` (Task 4).
- Produces:
  - `simples-rates.ts`: `SIMPLES_TABLES`, `REVENUE_BAND_LIMITS`, `estimateDasRate(annex: string, revenueBand: string): DasEstimate | null` com `DasEstimate = { min: number; max: number; average: number; issIcmsOutsideDas: boolean; source: string }`, `canEstimateDas(answers: Answers): boolean`, `DECLARED_DAS_BANDS`, `checkDeclaredDasRate(answers: Answers): { status: 'nao_declarada' | 'sem_tabela_conferida' | 'coerente' | 'fora_do_intervalo'; declared: [number, number] | null; estimate: DasEstimate | null }`
  - `question-types.ts`: `type Answers = Record<string, unknown>`, `type MatrixAnswer = Record<string, string>`, `type QuestionType = 'single' | 'select' | 'matrix' | 'text' | 'email' | 'phone' | 'cnpj' | 'textarea' | 'consent'`, `type Feeds = 'modality' | 'eligibility' | 'action' | 'radar' | 'registry'`, `interface Option { value: string; label: string; score?: number | null; description?: string }`, `interface MatrixRow { key: string; label: string }`, `interface MatrixColumn { value: string; label: string; midpoint: number | null }`, `interface Question { key: string; block: number; prompt: string; type: QuestionType; origin: 'registry' | 'client'; required: 'always' | 'conditional' | 'never'; feeds: Feeds[]; essential?: boolean; condition?: (answers: Answers) => boolean; unknownValue?: string; gapLabel?: string; gapFilled?: (answers: Answers) => boolean; axes?: number[]; order?: number; validator?: keyof typeof VALIDATORS; hint?: string | ((answers: Answers) => string); options?: Option[]; rows?: MatrixRow[]; columns?: MatrixColumn[] }`, `interface Block { number: number; title: string; notice?: string; glossary?: { term: string; meaning: string }[] }`, `interface RadarAxis { number: number; title: string }`
  - `questions.ts`: `PERCENT_BANDS`, `CUSTOMER_TYPES`, `BLOCKS: Block[]`, `RADAR_AXES: RadarAxis[]`, `QUESTIONS: Question[]`, `ENGINE_FIELDS: string[]`, `bandMidpoint(value: string): number | null`, `isProductOperation(a)`, `isOperationWithoutLabor(a)`, `isServiceOperation(a)`, `hasLegalEntityCustomer(a)`, `unansweredMatrixRows(question, answers): string[]`, `visibleQuestions(answers): Question[]`, `isShortPath(answers): boolean`, `optionLabel(key, value): string | null`, `matrixRowLabel(key, row, answers): string | null`

| Antigo | Novo |
|---|---|
| `TABELAS_SIMPLES`, `LIMITES_DA_FAIXA`, `FAIXA_DAS_DECLARADA` | `SIMPLES_TABLES`, `REVENUE_BAND_LIMITS`, `DECLARED_DAS_BANDS` |
| `estimarAliquotaDas` (`min`, `max`, `medio`, `issIcmsForaDoDas`, `fonte`) | `estimateDasRate` (`min`, `max`, `average`, `issIcmsOutsideDas`, `source`) |
| `daParaEstimarDas`, `conferirAliquotaDeclarada` (`situacao`, `declarada`, `estimativa`) | `canEstimateDas`, `checkDeclaredDasRate` (`status`, `declared`, `estimate`) — os valores de `status` ficam como estão |
| tabela interna `{ate, aliq, pd}` | `{ upTo, rate, deduction }` |
| `FAIXAS_PERCENTUAIS` (`pm`), `TIPOS_CLIENTE`, `BLOCOS` (`numero`, `titulo`, `aviso`, `glossario`), `EIXOS_RADAR`, `PERGUNTAS`, `CAMPOS_DO_MOTOR` | `PERCENT_BANDS` (`midpoint`), `CUSTOMER_TYPES`, `BLOCKS` (`number`, `title`, `notice`, `glossary`), `RADAR_AXES`, `QUESTIONS`, `ENGINE_FIELDS` |
| campos de pergunta `chave, bloco, enunciado, tipo, origem, obrigatoria, alimenta, essencial, cond, naoSei, lacuna, lacunaSuprida, eixos, ordem, validador, dica, opcoes, linhas, colunas` | `key, block, prompt, type, origin, required, feeds, essential, condition, unknownValue, gapLabel, gapFilled, axes, order, validator, hint, options, rows, columns` |
| `o(valor, rotulo, nota, descricao)` → `{valor, rotulo, nota, descricao}` | `option(value, label, score, description)` → `{ value, label, score, description }` |
| `tipo`: `unica, select, matriz, texto, email, telefone, cnpj, textarea, consentimento` | `type`: `single, select, matrix, text, email, phone, cnpj, textarea, consent` |
| `origem`: `base, cliente` · `obrigatoria`: `sempre, condicional, nunca` · `alimenta`: `modalidade, elegibilidade, acao, radar, cadastro` | `registry, client` · `always, conditional, never` · `modality, eligibility, action, radar, registry` |
| `validador: 'telefone' / 'nomeEmpresa' / 'nomePessoa'` | `validator: 'phone' / 'companyName' / 'personName'` |
| `pontoMedioFaixa`, `ehOperacaoComProduto`, `ehOperacaoSemMaoDeObra`, `ehOperacaoDeServico`, `temClientePessoaJuridica`, `linhasMatrizSemResposta`, `perguntasVisiveis`, `ehCaminhoCurto`, `rotuloDaOpcao`, `rotuloDaLinhaMatriz` | `bandMidpoint`, `isProductOperation`, `isOperationWithoutLabor`, `isServiceOperation`, `hasLegalEntityCustomer`, `unansweredMatrixRows`, `visibleQuestions`, `isShortPath`, `optionLabel`, `matrixRowLabel` |

Ficam **iguais**: o valor de `key` de cada pergunta, os `value` de opção, linha e coluna, os rótulos, enunciados, dicas e descrições (texto de tela), e a **ordem** das perguntas e opções. As `import` vão para o topo do arquivo (no antigo estão na linha 53).

- [ ] **Step 1: Teste de paridade que falha**

```ts
// src/server/diagnosis/domain/questions.test.ts
import { describe, expect, it } from 'vitest'
import * as legacyQuestions from '../../../../legacy/src/perguntas.js'
import * as legacyRates from '../../../../legacy/src/simples.js'
import { QUESTIONS, BLOCKS, visibleQuestions, isShortPath, bandMidpoint, optionLabel } from './questions'
import { estimateDasRate, checkDeclaredDasRate, REVENUE_BAND_LIMITS } from './simples-rates'
import { generateFills } from './testing/fill-generator'

const legacyTypes: Record<string, string> = {
  unica: 'single', select: 'select', matriz: 'matrix', texto: 'text', email: 'email',
  telefone: 'phone', cnpj: 'cnpj', textarea: 'textarea', consentimento: 'consent',
}

describe('questions parity', () => {
  it('keeps every question key, block, type and option in order', () => {
    expect(QUESTIONS.map((q) => q.key)).toEqual(legacyQuestions.PERGUNTAS.map((q) => q.chave))
    QUESTIONS.forEach((q, i) => {
      const old = legacyQuestions.PERGUNTAS[i]
      expect(q.block).toBe(old.bloco)
      expect(q.prompt).toBe(old.enunciado)
      expect(q.type).toBe(legacyTypes[old.tipo])
      expect(Boolean(q.essential)).toBe(Boolean(old.essencial))
      expect((q.options ?? []).map((o) => [o.value, o.label, o.score ?? null])).toEqual(
        (old.opcoes ?? []).map((o) => [o.valor, o.rotulo, o.nota ?? null]),
      )
    })
    expect(BLOCKS.map((b) => b.title)).toEqual(legacyQuestions.BLOCOS.map((b) => b.titulo))
  })

  it('shows the same questions for 5 000 fills', () => {
    for (const answers of generateFills({ count: 5_000, seed: 20260915 })) {
      expect(visibleQuestions(answers).map((q) => q.key)).toEqual(
        legacyQuestions.perguntasVisiveis(answers).map((q) => q.chave),
      )
      expect(isShortPath(answers)).toBe(legacyQuestions.ehCaminhoCurto(answers))
    }
  })

  it('keeps band midpoints and labels', () => {
    for (const band of ['zero', 'ate_20', 'de_20_40', 'de_40_60', 'de_60_80', 'acima_80', 'nao_sei']) {
      expect(bandMidpoint(band)).toBe(legacyQuestions.pontoMedioFaixa(band))
    }
    expect(optionLabel('segmento', 'comercio')).toBe(legacyQuestions.rotuloDaOpcao('segmento', 'comercio'))
  })

  it('estimates the same DAS interval for every annex and band', () => {
    for (const annex of ['i', 'ii', 'iii', 'iv', 'v', 'mais_de_um', 'nao_sei']) {
      for (const band of [...Object.keys(REVENUE_BAND_LIMITS), 'acima_4_8mi']) {
        const now = estimateDasRate(annex, band)
        const old = legacyRates.estimarAliquotaDas(annex, band)
        expect(now && [now.min, now.max, now.average, now.issIcmsOutsideDas]).toEqual(
          old && [old.min, old.max, old.medio, old.issIcmsForaDoDas],
        )
      }
    }
  })

  it('checks declared DAS the same way for 5 000 fills', () => {
    for (const answers of generateFills({ count: 5_000, seed: 7 })) {
      expect(checkDeclaredDasRate(answers).status).toBe(legacyRates.conferirAliquotaDeclarada(answers).situacao)
    }
  })
})
```

- [ ] **Step 2: Gerador de preenchimentos**

Porte o gerador de `legacy/testes.mjs`: o LCG, o gerador uniforme (até 12 passadas de condicionais, depois apaga o que ficou invisível) e o adversarial (11 campos extremos + modos de matriz `zerada`, `nao_sei`, `concentrada`, `estourada`, `aleatoria`). Ele depende só de `QUESTIONS` e `visibleQuestions`.

```ts
// src/server/diagnosis/domain/testing/fill-generator.ts
import type { Answers } from '../question-types'

export interface FillOptions {
  count: number
  seed: number
  mode?: 'uniform' | 'adversarial' | 'both'
}

export function* generateFills(options: FillOptions): Generator<Answers> {
  // porte de gerarUniforme/gerarAdversarial de legacy/testes.mjs, com os mesmos sorteios na mesma ordem
}
```

O corpo é o porte literal das funções de `legacy/testes.mjs` (mesma sequência de chamadas ao gerador pseudoaleatório, para a mesma semente dar os mesmos preenchimentos). `mode: 'both'` (padrão) alterna 1:1 entre uniforme e adversarial, como o antigo. Durante o porte, o gerador pode importar `QUESTIONS` de `../questions`: é código de teste do próprio domínio.

- [ ] **Step 3:** Run `pnpm vitest run src/server/diagnosis/domain/questions.test.ts`. Expected: FAIL, módulos não existem.
- [ ] **Step 4:** Porte `legacy/src/simples.js` → `simples-rates.ts` e `legacy/src/perguntas.js` → `question-types.ts` + `questions.ts` pela tabela acima. `condition`, `gapFilled` e `hint` função recebem `Answers` e leem as mesmas chaves de antes (`a.segmento === 'servico_saude'`).
- [ ] **Step 5:** Run o teste. Expected: PASS.
- [ ] **Step 6: Commit e merge** (`feat/diagnosis-questions`, `feat(diagnostico): perguntas e estimativa do DAS em TS, com paridade`).

---

### Task 6: Motor de decisão portado

**Files:**
- Create: `src/server/diagnosis/domain/{thresholds,derived-metrics,confidence,outcomes,deadline,radar,diagnose}.ts`
- Test: `src/server/diagnosis/domain/diagnose.parity.test.ts`

**Interfaces:**
- Consumes: Task 5.
- Produces:
  - `thresholds.ts`: `THRESHOLDS`, `APPLY_DENSITY_TEST_ON_HIGH_BRANCH` (= `true`, como está no código), `DEADLINES`, e as tabelas internas `PRESUMPTIONS`, `PIS_COFINS_CUMULATIVE`, `CPP_ON_PAYROLL`, `PAYROLL_MIDPOINTS`, `ESTIMATED_ISS_ICMS`, `DAS_MIDPOINTS`, `OPENS_OPEN_POINT`, `READABLE_OPEN_POINT`, `GAPS_THAT_LOCK_DECISION`, `GATE_CONDITIONS`
  - `derived-metrics.ts`: `deriveMetrics(answers: Answers): DerivedMetrics`
  - `confidence.ts`: `assessConfidence(answers: Answers): Confidence` com `Confidence = { level: 'ALTA' | 'MÉDIA' | 'BAIXA'; gaps: string[]; readableGaps: string[]; shortPath: boolean }`
  - `outcomes.ts`: `OUTCOMES`, `MODALITIES`, `POSITIONS`, `ASYMMETRY`, `positionForRegime(outcome, confidence, triggers, reading): Position`
  - `deadline.ts`: `assessUrgencyAndDeadline(outcome, answers, confidence, today: Date): UrgencyAndDeadline`
  - `radar.ts`: `computeRadar(answers): RadarAxisScore[]`, `radarBand(score: number | null): string`
  - `diagnose.ts`: `diagnose(answers: Answers, today: Date): Diagnosis`

`today` é **obrigatório** no código novo (o antigo tinha `new Date()` como padrão). Quem chama passa a data de Brasília vinda do servidor.

| Antigo | Novo |
|---|---|
| `CORTES` (`receitaCreditavelBaixa`, `receitaCreditavelAlta`, `densidadeCreditoMinima`, `margemMinimaSuporta`, `fatorFolha`, `fatorUsoPessoal`, `fatorPrestadorPJ`) | `THRESHOLDS` (`creditableRevenueLow`, `creditableRevenueHigh`, `minimumCreditDensity`, `minimumSupportingMargin`, `payrollFactor`, `personalUseFactor`, `contractorFactor`) — as chaves internas desses mapas são valores de opção e ficam |
| `APLICAR_TESTE_DENSIDADE_NO_RAMO_ALTO` | `APPLY_DENSITY_TEST_ON_HIGH_BRANCH` |
| `PRAZO` (`fimDaJanela`, `desistenciaAte`, `semestreDeEfeito`, `janelaSeguinte`, `efeitoDaJanelaSeguinte`, `folgaProtocoloDias`) | `DEADLINES` (`windowEnd`, `withdrawalUntil`, `effectSemester`, `nextWindow`, `nextWindowEffect`, `filingSlackDays`) |
| `derivadas()` → `receitaCreditavel, mixIndefinido, carteiraNaoMapeada, vendeParaOrgaoPublico, exporta, densidadeCredito, margemSuporta, margemConhecida, proximoDoTeto, passouDoSublimite, setorComTratamentoProprio, clienteNaoPodeCreditar, receitaMistaNoRegimeEspecifico, natureza, dasEstimado, origemDoDas, intervaloDas, conferenciaDas, cargaPresumidoEstimada, cargaFederalPresumido, fontePresuncao, presuncaoIrpjPct, simplesParecelMaisCaro, margemAbaixoDaPresuncao` | `deriveMetrics()` → `creditableRevenue, undefinedMix, unmappedPortfolio, sellsToPublicSector, exports, creditDensity, marginSupports, marginKnown, nearCeiling, aboveSublimit, sectorWithOwnRegime, customerCannotCredit, mixedRevenueInSpecificRegime, nature, estimatedDas, dasSource, dasRange, dasCheck, estimatedPresumedLoad, federalPresumedLoad, presumptionSource, irpjPresumptionPct, simplesMayBeMoreExpensive, marginBelowPresumption` |
| `confianca()` → `nivel, lacunas, lacunasLegiveis, caminhoCurto` | `assessConfidence()` → `level, gaps, readableGaps, shortPath` |
| `SAIDAS` (chaves `A B C D E E_SEM_DADO SETOR_SEM_CREDITO MEI FORA`; `codigo, titulo, resumo, significa, modalidade`) | `OUTCOMES` (chaves `A B C D E E_NO_DATA SECTOR_WITHOUT_CREDIT MEI OUTSIDE`; `code, title, summary, meaning, modality`) — `code` e `modality` ficam como estão |
| `MODALIDADES` (`rotulo, detalhe`) | `MODALITIES` (`label, detail`) |
| `POSICOES` (chaves `padrao, padrao_a_confirmar, hibrido_definitivo, hibrido_a_confirmar, a_definir, setor_sem_credito, nao_se_aplica`; `familia, certeza, rotulo, qualificador, acaoUnica, detalhe`) | `POSITIONS` (mesmas chaves; `family, certainty, label, qualifier, singleAction, detail`) |
| `posicaoDeRegime()` → `+ pontosEmAberto` | `positionForRegime()` → `{ key, ...position, openPoints }` (o `key` novo carrega a chave de `POSITIONS`) |
| `urgenciaEPrazo()` → `nivel, janelaAberta, uteisAteFim, corridosAteFim, dataLimiteProtocolo, dentroDaAntecedencia` | `assessUrgencyAndDeadline()` → `level, windowOpen, businessDaysToEnd, calendarDaysToEnd, filingDeadline, withinLeadTime` |
| `radar()` → `numero, titulo, score, faixa, campos` · `faixaRadar` | `computeRadar()` → `number, title, score, band, fields` · `radarBand` |
| `ASSIMETRIA` (`titulo, texto, paraQuemFica, fonte`) | `ASYMMETRY` (`title, text, forWhom, source`) |
| `diagnosticar()` → `saida, gatilhos, posicao, modalidade, conflito {conflito, decide, levantar}, assimetria, leituraPreliminar {modalidade, chaveModalidade, condicao, gatilhos}, derivadas, confianca, urgencia, dataLimiteProtocolo, dentroDaAntecedencia, janelaAberta, diasUteisAteFimDaJanela, diasCorridosAteFimDaJanela, antecedenciaOperacionalDias, radar, preliminar` | `diagnose()` → `outcomeKey, outcome, triggers, position, modality, conflict {conflict, decides, gather}, asymmetry, preliminaryReading {modality, modalityKey, condition, triggers}, derived, confidence, urgency, filingDeadline, withinLeadTime, windowOpen, businessDaysToWindowEnd, calendarDaysToWindowEnd, operationalLeadDays, radar, preliminary` |

`outcomeKey` é novo: carrega a chave de `OUTCOMES` (`'E'` ou `'E_NO_DATA'`). É ele que distingue os dois E; o antigo distinguia por identidade de objeto. `simplesParecelMaisCaro` perde o erro de digitação e vira `simplesMayBeMoreExpensive`. Os ids de gatilho (`gate_margem_critica`, `aliquota_fora_do_estimado`…) ficam **iguais**.

- [ ] **Step 1: Teste de paridade que falha**

```ts
// src/server/diagnosis/domain/diagnose.parity.test.ts
import { describe, expect, it } from 'vitest'
import * as legacy from '../../../../legacy/src/motor.js'
import { diagnose } from './diagnose'
import { OUTCOMES } from './outcomes'
import { generateFills } from './testing/fill-generator'

const TODAY = new Date('2026-09-15T10:00:00-03:00')
const legacyOutcomeKey = (saida: object) =>
  Object.entries(legacy.SAIDAS).find(([, value]) => value === saida)?.[0]
const outcomeKeyMap: Record<string, string> = {
  E_SEM_DADO: 'E_NO_DATA', SETOR_SEM_CREDITO: 'SECTOR_WITHOUT_CREDIT', FORA: 'OUTSIDE',
}

describe('engine parity over 40 000 fills', () => {
  it('returns the same decision for every fill', () => {
    let checked = 0
    for (const answers of generateFills({ count: 40_000, seed: 20260915 })) {
      const now = diagnose(answers, TODAY)
      const old = legacy.diagnosticar(answers, TODAY)
      const oldKey = legacyOutcomeKey(old.saida)!
      expect(now.outcomeKey).toBe(outcomeKeyMap[oldKey] ?? oldKey)
      expect(now.outcome.code).toBe(old.saida.codigo)
      expect(now.outcome.meaning).toBe(old.saida.significa)
      expect(now.triggers).toEqual(old.gatilhos)
      expect([now.position.label, now.position.qualifier, now.position.certainty, now.position.family]).toEqual([
        old.posicao.rotulo, old.posicao.qualificador, old.posicao.certeza, old.posicao.familia,
      ])
      expect(now.position.openPoints).toEqual(old.posicao.pontosEmAberto)
      expect([now.confidence.level, now.confidence.gaps, now.confidence.readableGaps]).toEqual([
        old.confianca.nivel, old.confianca.lacunas, old.confianca.lacunasLegiveis,
      ])
      expect(now.urgency.level).toBe(old.urgencia.nivel)
      expect([now.filingDeadline, now.withinLeadTime, now.windowOpen, now.businessDaysToWindowEnd]).toEqual([
        old.dataLimiteProtocolo, old.dentroDaAntecedencia, old.janelaAberta, old.diasUteisAteFimDaJanela,
      ])
      expect(now.radar.map((axis) => axis.score)).toEqual(old.radar.map((axis) => axis.score))
      expect(now.preliminaryReading?.condition ?? null).toBe(old.leituraPreliminar?.condicao ?? null)
      expect(now.conflict && [now.conflict.conflict, now.conflict.decides, now.conflict.gather]).toEqual(
        old.conflito && [old.conflito.conflito, old.conflito.decide, old.conflito.levantar],
      )
      expect([now.derived.creditableRevenue, now.derived.creditDensity, now.derived.estimatedDas]).toEqual([
        old.derivadas.receitaCreditavel, old.derivadas.densidadeCredito, old.derivadas.dasEstimado,
      ])
      expect(now.preliminary).toBe(old.preliminar)
      checked++
    }
    expect(checked).toBe(40_000)
    expect(OUTCOMES.E_NO_DATA.code).toBe('E')
  }, 120_000)
})
```

- [ ] **Step 2:** Run `pnpm vitest run src/server/diagnosis/domain/diagnose.parity.test.ts`. Expected: FAIL, módulos não existem.
- [ ] **Step 3:** Porte `legacy/src/motor.js` nos sete arquivos, pela tabela, nesta ordem de dependência: `thresholds` → `derived-metrics` → `confidence` → `outcomes` → `deadline` → `radar` → `diagnose`. Cada arquivo exporta seus tipos (`DerivedMetrics`, `Outcome`, `Position`, `UrgencyAndDeadline`, `RadarAxisScore`, `Diagnosis`). A contagem de dias úteis continua pelo calendário local (é o `TZ` que o fixa em Brasília). O import de `PERGUNTAS` que o motor antigo não usava não é portado.
- [ ] **Step 4:** Run o teste. Expected: PASS nos 40 000 casos. Se um campo divergir, o `expect` mostra o preenchimento que falhou: corrija o porte, nunca o teste.
- [ ] **Step 5: Commit e merge** (`feat/diagnosis-engine`, `feat(diagnostico): motor de decisão em TS, idêntico ao antigo em 40 mil casos`).

---

### Task 7: Plano de ação e invariantes do motor

**Files:**
- Create: `src/server/diagnosis/domain/action-plan.ts`, `src/server/diagnosis/domain/action-plan.parity.test.ts`, `src/server/diagnosis/domain/diagnose.invariants.test.ts`

**Interfaces:**
- Consumes: `diagnose`, `Diagnosis` (Task 6).
- Produces: `ACTION_RULES: ActionRule[]`, `buildActionPlan(answers: Answers, diagnosis: Diagnosis): ActionPlan` com `ActionItem = { id: string; action: string; reason: string; executor: 'client' | 'auster'; track: 1 | 2; requires?: string; legalBasis?: string }` e `ActionPlan = { clientNow: ActionItem[]; clientLater: ActionItem[]; auster: ActionItem[]; total: number }`.

| Antigo | Novo |
|---|---|
| `REGRAS_ACAO` (`id, quando(r, d), acao, porque, executor 'cliente'/'auster', trilha, precisa, fundamento`) | `ACTION_RULES` (`id, when(answers, diagnosis), action, reason, executor 'client'/'auster', track, requires, legalBasis`) |
| `planoDeAcao()` → `clienteAgora, clienteDepois, auster, total` | `buildActionPlan()` → `clientNow, clientLater, auster, total` |

Os `when` leem `diagnosis.outcome.code`, `diagnosis.position.family` e `diagnosis.derived.*` pelos nomes novos. O `try/catch` que trata exceção de regra como `false` fica. Os `id` de ação ficam iguais.

- [ ] **Step 1: Testes que falham**

```ts
// src/server/diagnosis/domain/action-plan.parity.test.ts
import { describe, expect, it } from 'vitest'
import * as legacyEngine from '../../../../legacy/src/motor.js'
import * as legacyActions from '../../../../legacy/src/acoes.js'
import { diagnose } from './diagnose'
import { buildActionPlan } from './action-plan'
import { generateFills } from './testing/fill-generator'

const TODAY = new Date('2026-09-15T10:00:00-03:00')
const ids = (items: { id: string }[]) => items.map((item) => item.id)

describe('action plan parity over 40 000 fills', () => {
  it('picks the same actions in the same buckets', () => {
    for (const answers of generateFills({ count: 40_000, seed: 20260915 })) {
      const now = buildActionPlan(answers, diagnose(answers, TODAY))
      const old = legacyActions.planoDeAcao(answers, legacyEngine.diagnosticar(answers, TODAY))
      expect(ids(now.clientNow)).toEqual(ids(old.clienteAgora))
      expect(ids(now.clientLater)).toEqual(ids(old.clienteDepois))
      expect(ids(now.auster)).toEqual(ids(old.auster))
      expect(now.clientNow.map((item) => item.action)).toEqual(old.clienteAgora.map((item) => item.acao))
    }
  }, 180_000)
})
```

```ts
// src/server/diagnosis/domain/diagnose.invariants.test.ts
import { describe, expect, it } from 'vitest'
import { diagnose } from './diagnose'
import { buildActionPlan } from './action-plan'
import { POSITIONS } from './outcomes'
import { generateFills } from './testing/fill-generator'

const TODAY = new Date('2026-09-15T10:00:00-03:00')
const positionKeys = new Set(Object.keys(POSITIONS))
const technicalName = /[a-z][A-Z]|_[a-z]/

describe('engine invariants over 40 000 fills', () => {
  it('holds every invariant', () => {
    let producedNoData = false
    let producedPurchaseConflict = false
    for (const answers of generateFills({ count: 40_000, seed: 20260915 })) {
      const d = diagnose(answers, TODAY)
      const plan = buildActionPlan(answers, d)
      if (d.outcomeKey === 'E_NO_DATA') {
        producedNoData = true
        expect(d.conflict).toBeNull()
      }
      if (d.conflict?.conflict.includes('compras')) producedPurchaseConflict = true
      if (d.conflict) expect(d.conflict.conflict).not.toMatch(/compras[^.]*% da receita/)
      if (d.derived.dasCheck?.status === 'fora_do_intervalo') {
        expect(d.position.openPoints.length).toBeGreaterThan(0)
        expect(d.position.certainty).not.toBe('fechada')
      }
      expect(d.outcome.title && d.outcome.summary && d.outcome.meaning && d.outcome.modality).toBeTruthy()
      expect(positionKeys.has(d.position.key)).toBe(true)
      if (d.position.certainty === 'fechada') expect(d.position.openPoints).toHaveLength(0)
      if (d.position.certainty === 'aberta' && d.position.family !== 'a_definir') {
        expect(d.position.openPoints.length).toBeGreaterThan(0)
      }
      if (d.confidence.level === 'ALTA') expect(d.confidence.gaps).toHaveLength(0)
      expect(d.confidence.gaps.length).toBe(d.confidence.readableGaps.length)
      d.confidence.readableGaps.forEach((gap) => expect(gap).not.toMatch(technicalName))
      if (d.derived.creditableRevenue === null) {
        expect(d.triggers.some((t) => t.startsWith('gate_')) || d.outcome.code === 'E').toBe(true)
      }
      d.radar.forEach((axis) => {
        if (axis.score !== null) expect(axis.score).toBeGreaterThanOrEqual(0)
        if (axis.score !== null) expect(axis.score).toBeLessThanOrEqual(100)
      })
      expect(plan.total).toBeGreaterThanOrEqual(1)
      ;[...plan.clientNow, ...plan.clientLater, ...plan.auster].forEach((item) => {
        expect(item.action && item.reason).toBeTruthy()
        expect([1, 2]).toContain(item.track)
      })
      ;[...plan.clientNow, ...plan.clientLater].forEach((item) => expect(item.executor).toBe('client'))
      if (answers.ehSimei === 'sim' || (answers.regimeAtual && answers.regimeAtual !== 'simples')) {
        expect(d.position.key).toBe('nao_se_aplica')
      }
      if (answers.setorDiferenciado === 'bares_restaurantes' && answers.composicaoAlimentacao === 'fora_do_regime') {
        expect(d.outcomeKey).not.toBe('SECTOR_WITHOUT_CREDIT')
      }
    }
    expect(producedNoData).toBe(true)
    expect(producedPurchaseConflict).toBe(true)
  }, 180_000)
})
```

Confira em `legacy/testes.mjs` os literais de cada invariante (o valor exato de `composicaoAlimentacao` para "fora do regime", e as frases e janelas da checagem de mérito econômico) e ajuste os literais acima para os mesmos do antigo. As invariantes 18 a 22 e 25 a 30 dependem da tela e ficam para a etapa 1.

- [ ] **Step 2:** Run `pnpm vitest run src/server/diagnosis/domain/action-plan.parity.test.ts src/server/diagnosis/domain/diagnose.invariants.test.ts`. Expected: FAIL, `action-plan` não existe.
- [ ] **Step 3:** Porte `legacy/src/acoes.js` → `action-plan.ts` pela tabela.
- [ ] **Step 4:** Run os dois testes. Expected: PASS.
- [ ] **Step 5: Commit e merge** (`feat/action-plan`, `feat(diagnostico): plano de ação em TS e as invariantes do motor`).

---

### Task 8: Termo V4 e hash da prova

**Files:**
- Create: `src/server/adhesion/domain/term.ts`, `src/server/adhesion/domain/term.test.ts`

**Interfaces:**
- Produces: `TERM_V4` (o objeto antigo **intacto**, com chaves em português), `CURRENT_TERM = TERM_V4`, `type Term = typeof TERM_V4`, `computeTermHash(term: Term): Promise<string>` (SHA-256 hex de `JSON.stringify(term)`, via `crypto.subtle`, isomórfico).

- [ ] **Step 1: Teste que falha**

```ts
// src/server/adhesion/domain/term.test.ts
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { TERMO } from '../../../../legacy/src/termo.js'
import { CURRENT_TERM, TERM_V4, computeTermHash } from './term'

describe('term V4', () => {
  it('is byte-identical to the legacy object', () => {
    expect(JSON.stringify(TERM_V4)).toBe(JSON.stringify(TERMO))
  })

  it('hashes to the same value stored with every existing adhesion', async () => {
    const legacyHash = createHash('sha256').update(JSON.stringify(TERMO), 'utf8').digest('hex')
    expect(await computeTermHash(TERM_V4)).toBe(legacyHash)
  })

  it('is the current version', () => {
    expect(CURRENT_TERM.versao).toBe('V4')
  })
})
```

- [ ] **Step 2:** Run `pnpm vitest run src/server/adhesion/domain/term.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar**

Copie o literal de `TERMO` de `legacy/src/termo.js` sem mudar nada dentro dele (nem ordem de chave, nem espaço dentro de string) e exporte como `TERM_V4` com `as const`. Depois:

```ts
export const CURRENT_TERM = TERM_V4

export type Term = typeof TERM_V4

export async function computeTermHash(term: Term): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(term)))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
```

No topo do arquivo, uma linha: `// Prova jurídica: o hash das adesões é calculado sobre este objeto. Texto novo = versão nova.`

- [ ] **Step 4:** Run o teste. Expected: PASS.
- [ ] **Step 5: Commit e merge** (`feat/term-v4`, `feat(adesao): termo V4 e hash da prova, idênticos ao antigo`).

---

### Task 9: Auditoria

**Files:**
- Create: `src/server/audit/domain/audit-entry.ts`, `src/server/audit/ports/audit-log-repository.ts`, `src/server/audit/application/record-audit.ts`, `src/server/audit/application/record-audit.test.ts`, `src/server/audit/adapters/prisma-audit-log-repository.ts`, `src/server/audit/adapters/prisma-audit-log-repository.int.test.ts`, `src/server/audit/composition.ts`

**Interfaces:**
- Produces: `recordAudit(entry: AuditEntryInput): Promise<void>`, `listAudit(limit?: number): Promise<AuditEntry[]>`, exportados por `@/server/audit/composition`. `AuditEntryInput = { action: AuditAction; actorId?: string | null; actorUsername?: string | null; reference?: string | null; detail?: Record<string, unknown> | null }`.

- [ ] **Step 1: Domínio e porta**

```ts
// src/server/audit/domain/audit-entry.ts
export const AUDIT_ACTIONS = [
  'access_denied', 'login', 'user_created', 'user_updated', 'admin_bootstrapped',
  'invitation_created', 'invitation_deleted', 'response_received', 'response_handled',
  'adhesion_received', 'adhesion_handled', 'event_created', 'event_updated', 'event_slug_changed',
  'registration_received', 'registration_handled', 'file_stored', 'spreadsheet_exported',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export interface AuditEntryInput {
  action: AuditAction
  actorId?: string | null
  actorUsername?: string | null
  reference?: string | null
  detail?: Record<string, unknown> | null
}

export interface AuditEntry extends AuditEntryInput {
  id: number
  occurredAt: Date
}
```

```ts
// src/server/audit/ports/audit-log-repository.ts
import type { AuditEntry, AuditEntryInput } from '../domain/audit-entry'

export interface AuditLogRepository {
  append(entry: AuditEntryInput): Promise<void>
  latest(limit: number): Promise<AuditEntry[]>
}
```

- [ ] **Step 2: Teste do caso de uso que falha**

```ts
// src/server/audit/application/record-audit.test.ts
import { describe, expect, it } from 'vitest'
import type { AuditEntry, AuditEntryInput } from '../domain/audit-entry'
import type { AuditLogRepository } from '../ports/audit-log-repository'
import { makeListAudit, makeRecordAudit } from './record-audit'

function fakeRepository() {
  const entries: AuditEntryInput[] = []
  const repository: AuditLogRepository = {
    append: async (entry) => void entries.push(entry),
    latest: async (limit) => entries.slice(-limit).map((e, i) => ({ ...e, id: i + 1, occurredAt: new Date(0) }) as AuditEntry),
  }
  return { entries, repository }
}

describe('recordAudit', () => {
  it('stores the entry with detail trimmed of undefined values', async () => {
    const { entries, repository } = fakeRepository()
    await makeRecordAudit(repository)({ action: 'login', actorUsername: 'ana', detail: { ip: '1.1.1.1', extra: undefined } })
    expect(entries).toEqual([{ action: 'login', actorUsername: 'ana', actorId: null, reference: null, detail: { ip: '1.1.1.1' } }])
  })

  it('caps the listing at 500', async () => {
    const { repository } = fakeRepository()
    const listAudit = makeListAudit(repository)
    await expect(listAudit(10_000)).resolves.toEqual([])
  })
})
```

- [ ] **Step 3:** Run `pnpm vitest run src/server/audit`. Expected: FAIL.
- [ ] **Step 4: Implementar caso de uso, adaptador e composição**

```ts
// src/server/audit/application/record-audit.ts
import type { AuditEntryInput } from '../domain/audit-entry'
import type { AuditLogRepository } from '../ports/audit-log-repository'

export const makeRecordAudit = (repository: AuditLogRepository) => async (entry: AuditEntryInput) => {
  const detail = entry.detail
    ? Object.fromEntries(Object.entries(entry.detail).filter(([, value]) => value !== undefined))
    : null
  await repository.append({
    action: entry.action,
    actorId: entry.actorId ?? null,
    actorUsername: entry.actorUsername ?? null,
    reference: entry.reference ?? null,
    detail,
  })
}

export const makeListAudit = (repository: AuditLogRepository) => (limit = 200) =>
  repository.latest(Math.min(Math.max(limit, 1), 500))
```

```ts
// src/server/audit/adapters/prisma-audit-log-repository.ts
import type { Prisma } from '@/server/shared/prisma/generated/client'
import { prisma } from '@/server/shared/prisma/client'
import type { AuditLogRepository } from '../ports/audit-log-repository'
import type { AuditAction } from '../domain/audit-entry'

export const prismaAuditLogRepository: AuditLogRepository = {
  async append(entry) {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId ?? null,
        actorUsername: entry.actorUsername ?? null,
        reference: entry.reference ?? null,
        detail: (entry.detail ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
  },
  async latest(limit) {
    const rows = await prisma.auditLog.findMany({ orderBy: { occurredAt: 'desc' }, take: limit })
    return rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt,
      action: row.action as AuditAction,
      actorId: row.actorId,
      actorUsername: row.actorUsername,
      reference: row.reference,
      detail: row.detail as Record<string, unknown> | null,
    }))
  },
}
```

```ts
// src/server/audit/composition.ts
import { prismaAuditLogRepository } from './adapters/prisma-audit-log-repository'
import { makeListAudit, makeRecordAudit } from './application/record-audit'

export const recordAudit = makeRecordAudit(prismaAuditLogRepository)
export const listAudit = makeListAudit(prismaAuditLogRepository)
export type { AuditAction, AuditEntry, AuditEntryInput } from './domain/audit-entry'
```

```ts
// src/server/audit/adapters/prisma-audit-log-repository.int.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../../../../tests/integration/db'
import { prismaAuditLogRepository } from './prisma-audit-log-repository'

describe('prismaAuditLogRepository', () => {
  beforeEach(resetDatabase)
  it('appends and lists newest first', async () => {
    await prismaAuditLogRepository.append({ action: 'login', actorUsername: 'ana' })
    await prismaAuditLogRepository.append({ action: 'access_denied', actorUsername: 'bia', detail: { reason: 'senha incorreta' } })
    const [first, second] = await prismaAuditLogRepository.latest(10)
    expect(first?.action).toBe('access_denied')
    expect(first?.detail).toEqual({ reason: 'senha incorreta' })
    expect(second?.action).toBe('login')
  })
})
```

- [ ] **Step 5:** Run `pnpm vitest run src/server/audit`. Expected: PASS (unitário e integração).
- [ ] **Step 6: Commit e merge** (`feat/audit`, `feat(auditoria): trilha só de inserção no Postgres`).

---

### Task 10: Rate limit no banco

**Files:**
- Create: `src/server/rate-limit/domain/windows.ts`, `src/server/rate-limit/domain/windows.test.ts`, `src/server/rate-limit/ports/rate-limit-store.ts`, `src/server/rate-limit/application/check-rate-limit.ts`, `src/server/rate-limit/application/check-rate-limit.test.ts`, `src/server/rate-limit/adapters/prisma-rate-limit-store.ts`, `src/server/rate-limit/adapters/prisma-rate-limit-store.int.test.ts`, `src/server/rate-limit/composition.ts`

**Interfaces:**
- Produces: `checkRateLimit({ route, origin, now? }): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }>` em `@/server/rate-limit/composition`. Limites de 5 por minuto e 30 por hora por (rota, origem), como no antigo. As janelas agora são fixas (começam no minuto e na hora cheios), não deslizantes.

- [ ] **Step 1: Testes que falham**

```ts
// src/server/rate-limit/domain/windows.test.ts
import { describe, expect, it } from 'vitest'
import { windowStart, secondsUntilWindowEnds } from './windows'

describe('fixed windows', () => {
  const now = new Date('2026-10-01T12:34:56.789Z')
  it('floors to the minute and to the hour', () => {
    expect(windowStart(now, 60).toISOString()).toBe('2026-10-01T12:34:00.000Z')
    expect(windowStart(now, 3600).toISOString()).toBe('2026-10-01T12:00:00.000Z')
  })
  it('counts the seconds left, at least 1', () => {
    expect(secondsUntilWindowEnds(now, 60)).toBe(4)
    expect(secondsUntilWindowEnds(new Date('2026-10-01T12:34:59.999Z'), 60)).toBe(1)
  })
})
```

```ts
// src/server/rate-limit/application/check-rate-limit.test.ts
import { describe, expect, it } from 'vitest'
import type { RateLimitStore } from '../ports/rate-limit-store'
import { makeCheckRateLimit } from './check-rate-limit'

function memoryStore(): RateLimitStore {
  const counts = new Map<string, number>()
  return {
    async increment(key, start) {
      const id = `${key}|${start.toISOString()}`
      const next = (counts.get(id) ?? 0) + 1
      counts.set(id, next)
      return next
    },
    async purgeBefore() {},
  }
}

describe('checkRateLimit', () => {
  const now = new Date('2026-10-01T12:00:10Z')
  it('allows five per minute and blocks the sixth', async () => {
    const check = makeCheckRateLimit(memoryStore())
    for (let i = 0; i < 5; i++) expect(await check({ route: '/diagnosis', origin: '1.1.1.1', now })).toEqual({ allowed: true })
    expect(await check({ route: '/diagnosis', origin: '1.1.1.1', now })).toEqual({ allowed: false, retryAfterSeconds: 50 })
  })
  it('keeps origins apart', async () => {
    const check = makeCheckRateLimit(memoryStore())
    for (let i = 0; i < 5; i++) await check({ route: '/diagnosis', origin: '1.1.1.1', now })
    expect(await check({ route: '/diagnosis', origin: '2.2.2.2', now })).toEqual({ allowed: true })
  })
  it('blocks after thirty in the hour', async () => {
    const check = makeCheckRateLimit(memoryStore())
    for (let minute = 0; minute < 6; minute++) {
      const at = new Date(Date.UTC(2026, 9, 1, 12, minute, 5))
      for (let i = 0; i < 5; i++) await check({ route: '/r', origin: 'o', now: at })
    }
    const result = await check({ route: '/r', origin: 'o', now: new Date(Date.UTC(2026, 9, 1, 12, 10, 0)) })
    expect(result).toEqual({ allowed: false, retryAfterSeconds: 3000 })
  })
})
```

- [ ] **Step 2:** Run `pnpm vitest run src/server/rate-limit`. Expected: FAIL.
- [ ] **Step 3: Implementar**

```ts
// src/server/rate-limit/domain/windows.ts
export const LIMITS = [
  { seconds: 60, max: 5 },
  { seconds: 3600, max: 30 },
] as const

export function windowStart(now: Date, seconds: number): Date {
  const size = seconds * 1000
  return new Date(Math.floor(now.getTime() / size) * size)
}

export function secondsUntilWindowEnds(now: Date, seconds: number): number {
  const end = windowStart(now, seconds).getTime() + seconds * 1000
  return Math.max(1, Math.ceil((end - now.getTime()) / 1000))
}
```

```ts
// src/server/rate-limit/ports/rate-limit-store.ts
export interface RateLimitStore {
  increment(key: string, windowStart: Date): Promise<number>
  purgeBefore(moment: Date): Promise<void>
}
```

```ts
// src/server/rate-limit/application/check-rate-limit.ts
import { LIMITS, secondsUntilWindowEnds, windowStart } from '../domain/windows'
import type { RateLimitStore } from '../ports/rate-limit-store'

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number }

export const makeCheckRateLimit =
  (store: RateLimitStore) =>
  async ({ route, origin, now = new Date() }: { route: string; origin: string | null; now?: Date }): Promise<RateLimitResult> => {
    const key = `${route}|${origin ?? 'sem-origem'}`
    let blockedFor = 0
    for (const limit of LIMITS) {
      const count = await store.increment(`${key}|${limit.seconds}`, windowStart(now, limit.seconds))
      if (count > limit.max) blockedFor = Math.max(blockedFor, secondsUntilWindowEnds(now, limit.seconds))
    }
    await store.purgeBefore(new Date(now.getTime() - 2 * 3600 * 1000))
    return blockedFor ? { allowed: false, retryAfterSeconds: blockedFor } : { allowed: true }
  }
```

```ts
// src/server/rate-limit/adapters/prisma-rate-limit-store.ts
import { prisma } from '@/server/shared/prisma/client'
import type { RateLimitStore } from '../ports/rate-limit-store'

export const prismaRateLimitStore: RateLimitStore = {
  async increment(key, windowStart) {
    const row = await prisma.rateLimitHit.upsert({
      where: { key_windowStart: { key, windowStart } },
      create: { key, windowStart, count: 1 },
      update: { count: { increment: 1 } },
    })
    return row.count
  },
  async purgeBefore(moment) {
    await prisma.rateLimitHit.deleteMany({ where: { windowStart: { lt: moment } } })
  },
}
```

```ts
// src/server/rate-limit/composition.ts
import { prismaRateLimitStore } from './adapters/prisma-rate-limit-store'
import { makeCheckRateLimit } from './application/check-rate-limit'

export const checkRateLimit = makeCheckRateLimit(prismaRateLimitStore)
```

```ts
// src/server/rate-limit/adapters/prisma-rate-limit-store.int.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../../../../tests/integration/db'
import { prismaRateLimitStore } from './prisma-rate-limit-store'

describe('prismaRateLimitStore', () => {
  beforeEach(resetDatabase)
  it('increments atomically under concurrency', async () => {
    const start = new Date('2026-10-01T12:00:00Z')
    const counts = await Promise.all(Array.from({ length: 10 }, () => prismaRateLimitStore.increment('k', start)))
    expect(counts.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})
```

- [ ] **Step 4:** Run `pnpm vitest run src/server/rate-limit`. Expected: PASS. Se o teste de concorrência falhar por corrida no `upsert`, troque o `increment` por SQL cru: `INSERT … ON CONFLICT ("key","window_start") DO UPDATE SET count = rate_limit_hits.count + 1 RETURNING count`.
- [ ] **Step 5: Commit e merge** (`feat/rate-limit`, `feat(seguranca): limite de envios por origem gravado no banco`).

---

### Task 11: Armazenamento de arquivos no MinIO

**Files:**
- Create: `src/server/storage/domain/file-policy.ts`, `src/server/storage/domain/file-policy.test.ts`, `src/server/storage/ports/{object-storage,stored-file-repository}.ts`, `src/server/storage/application/{store-file,read-file}.ts`, `src/server/storage/application/store-file.test.ts`, `src/server/storage/adapters/{s3-object-storage,prisma-stored-file-repository}.ts`, `src/server/storage/adapters/s3-object-storage.int.test.ts`, `src/server/storage/composition.ts`, `src/app/routes/files/$fileId.ts`

**Interfaces:**
- Produces: `storeFile({ kind, contentType, bytes, originalName?, createdById? }): Promise<StoredFileRecord>`, `readFile(id: string): Promise<{ file: StoredFileRecord; body: Uint8Array } | null>`, `ensureBucket(): Promise<void>` em `@/server/storage/composition`. `StoredFileRecord = { id: string; key: string; contentType: string; size: number; sha256: string; kind: FileKind; originalName: string | null }`. Rota `GET /files/:fileId`.

- [ ] **Step 1: Política e testes que falham**

```ts
// src/server/storage/domain/file-policy.ts
export const FILE_KINDS = ['house_photo', 'event_cover', 'speaker_photo'] as const
export type FileKind = (typeof FILE_KINDS)[number]

export const ALLOWED_CONTENT_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const
export type AllowedContentType = keyof typeof ALLOWED_CONTENT_TYPES

export const MAX_FILE_BYTES = 5 * 1024 * 1024

export type FilePolicyViolation = 'content_type_not_allowed' | 'file_too_large' | 'file_empty'

export function checkFile(contentType: string, size: number): FilePolicyViolation | null {
  if (!(contentType in ALLOWED_CONTENT_TYPES)) return 'content_type_not_allowed'
  if (size === 0) return 'file_empty'
  if (size > MAX_FILE_BYTES) return 'file_too_large'
  return null
}

export function objectKeyFor(kind: FileKind, id: string, contentType: AllowedContentType): string {
  return `${kind}/${id}.${ALLOWED_CONTENT_TYPES[contentType]}`
}
```

```ts
// src/server/storage/domain/file-policy.test.ts
import { describe, expect, it } from 'vitest'
import { checkFile, objectKeyFor, MAX_FILE_BYTES } from './file-policy'

describe('file policy', () => {
  it('accepts images up to 5 MB', () => expect(checkFile('image/jpeg', MAX_FILE_BYTES)).toBeNull())
  it('refuses svg, empty and large files', () => {
    expect(checkFile('image/svg+xml', 10)).toBe('content_type_not_allowed')
    expect(checkFile('image/png', 0)).toBe('file_empty')
    expect(checkFile('image/png', MAX_FILE_BYTES + 1)).toBe('file_too_large')
  })
  it('builds keys by kind', () => expect(objectKeyFor('event_cover', 'abc', 'image/webp')).toBe('event_cover/abc.webp'))
})
```

SVG fica fora de propósito: SVG servido do próprio domínio executa script.

```ts
// src/server/storage/ports/object-storage.ts
export interface ObjectStorage {
  ensureBucket(): Promise<void>
  put(key: string, body: Uint8Array, contentType: string): Promise<void>
  get(key: string): Promise<Uint8Array | null>
}
```

```ts
// src/server/storage/ports/stored-file-repository.ts
import type { FileKind } from '../domain/file-policy'

export interface StoredFileRecord {
  id: string
  key: string
  contentType: string
  size: number
  sha256: string
  kind: FileKind
  originalName: string | null
}

export interface StoredFileRepository {
  create(record: StoredFileRecord & { bucket: string; createdById: string | null }): Promise<StoredFileRecord>
  findById(id: string): Promise<StoredFileRecord | null>
  findByOriginalName(kind: FileKind, originalName: string): Promise<StoredFileRecord | null>
}
```

```ts
// src/server/storage/application/store-file.test.ts
import { describe, expect, it } from 'vitest'
import type { ObjectStorage } from '../ports/object-storage'
import type { StoredFileRecord, StoredFileRepository } from '../ports/stored-file-repository'
import { makeStoreFile } from './store-file'
import { makeReadFile } from './read-file'

function fakes() {
  const objects = new Map<string, Uint8Array>()
  const records = new Map<string, StoredFileRecord>()
  const storage: ObjectStorage = {
    ensureBucket: async () => {},
    put: async (key, body) => void objects.set(key, body),
    get: async (key) => objects.get(key) ?? null,
  }
  const repository: StoredFileRepository = {
    create: async (record) => (records.set(record.id, record), record),
    findById: async (id) => records.get(id) ?? null,
    findByOriginalName: async () => null,
  }
  return { objects, storage, repository }
}

describe('storeFile', () => {
  it('stores bytes under a kind-scoped key with a sha256', async () => {
    const { objects, storage, repository } = fakes()
    const storeFile = makeStoreFile({ storage, repository, bucket: 'b', newId: () => 'id-1' })
    const record = await storeFile({ kind: 'event_cover', contentType: 'image/png', bytes: new Uint8Array([1, 2, 3]) })
    expect(record.key).toBe('event_cover/id-1.png')
    expect(record.sha256).toBe('039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81')
    expect(objects.get('event_cover/id-1.png')).toEqual(new Uint8Array([1, 2, 3]))
    const read = await makeReadFile({ storage, repository })('id-1')
    expect(read?.body).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('refuses a disallowed type before touching storage', async () => {
    const { objects, storage, repository } = fakes()
    const storeFile = makeStoreFile({ storage, repository, bucket: 'b', newId: () => 'x' })
    await expect(
      storeFile({ kind: 'event_cover', contentType: 'image/svg+xml', bytes: new Uint8Array([1]) }),
    ).rejects.toThrow('content_type_not_allowed')
    expect(objects.size).toBe(0)
  })
})
```

- [ ] **Step 2:** Run `pnpm vitest run src/server/storage`. Expected: FAIL.
- [ ] **Step 3: Implementar casos de uso**

```ts
// src/server/storage/application/store-file.ts
import { checkFile, objectKeyFor, type AllowedContentType, type FileKind } from '../domain/file-policy'
import type { ObjectStorage } from '../ports/object-storage'
import type { StoredFileRecord, StoredFileRepository } from '../ports/stored-file-repository'

interface Dependencies {
  storage: ObjectStorage
  repository: StoredFileRepository
  bucket: string
  newId: () => string
}

export interface StoreFileInput {
  kind: FileKind
  contentType: string
  bytes: Uint8Array
  originalName?: string | null
  createdById?: string | null
}

export const makeStoreFile =
  ({ storage, repository, bucket, newId }: Dependencies) =>
  async (input: StoreFileInput): Promise<StoredFileRecord> => {
    const violation = checkFile(input.contentType, input.bytes.byteLength)
    if (violation) throw new Error(violation)
    const id = newId()
    const key = objectKeyFor(input.kind, id, input.contentType as AllowedContentType)
    const digest = await crypto.subtle.digest('SHA-256', input.bytes)
    const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
    await storage.put(key, input.bytes, input.contentType)
    return repository.create({
      id,
      key,
      bucket,
      contentType: input.contentType,
      size: input.bytes.byteLength,
      sha256,
      kind: input.kind,
      originalName: input.originalName ?? null,
      createdById: input.createdById ?? null,
    })
  }
```

```ts
// src/server/storage/application/read-file.ts
import type { ObjectStorage } from '../ports/object-storage'
import type { StoredFileRepository } from '../ports/stored-file-repository'

export const makeReadFile =
  ({ storage, repository }: { storage: ObjectStorage; repository: StoredFileRepository }) =>
  async (id: string) => {
    const file = await repository.findById(id)
    if (!file) return null
    const body = await storage.get(file.key)
    return body ? { file, body } : null
  }
```

- [ ] **Step 4: Adaptadores e composição**

```ts
// src/server/storage/adapters/s3-object-storage.ts
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { ObjectStorage } from '../ports/object-storage'

interface S3Settings {
  endpoint: string
  useSsl: boolean
  bucket: string
  accessKey: string
  secretKey: string
}

export function createS3ObjectStorage(settings: S3Settings): ObjectStorage {
  let client: S3Client | undefined
  const s3 = () =>
    (client ??= new S3Client({
      endpoint: `${settings.useSsl ? 'https' : 'http'}://${settings.endpoint}`,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: settings.accessKey, secretAccessKey: settings.secretKey },
    }))

  return {
    async ensureBucket() {
      try {
        await s3().send(new HeadBucketCommand({ Bucket: settings.bucket }))
      } catch {
        await s3().send(new CreateBucketCommand({ Bucket: settings.bucket }))
      }
    },
    async put(key, body, contentType) {
      await s3().send(new PutObjectCommand({ Bucket: settings.bucket, Key: key, Body: body, ContentType: contentType }))
    },
    async get(key) {
      try {
        const result = await s3().send(new GetObjectCommand({ Bucket: settings.bucket, Key: key }))
        return result.Body ? new Uint8Array(await result.Body.transformToByteArray()) : null
      } catch (error) {
        if (error instanceof NoSuchKey) return null
        throw error
      }
    },
  }
}
```

O cliente nasce no primeiro uso (a lição da Loja Auster: endpoint errado não pode derrubar o boot).

```ts
// src/server/storage/adapters/prisma-stored-file-repository.ts
import { prisma } from '@/server/shared/prisma/client'
import type { StoredFileRepository } from '../ports/stored-file-repository'

const select = { id: true, key: true, contentType: true, size: true, sha256: true, kind: true, originalName: true } as const

export const prismaStoredFileRepository: StoredFileRepository = {
  create: (record) => prisma.storedFile.create({ data: record, select }),
  findById: (id) => prisma.storedFile.findUnique({ where: { id }, select }),
  findByOriginalName: (kind, originalName) => prisma.storedFile.findFirst({ where: { kind, originalName }, select }),
}
```

```ts
// src/server/storage/composition.ts
import { getEnv } from '@/server/shared/env'
import { createS3ObjectStorage } from './adapters/s3-object-storage'
import { prismaStoredFileRepository } from './adapters/prisma-stored-file-repository'
import { makeStoreFile } from './application/store-file'
import { makeReadFile } from './application/read-file'

const env = getEnv()
const storage = createS3ObjectStorage({
  endpoint: env.S3_ENDPOINT,
  useSsl: env.S3_USE_SSL,
  bucket: env.S3_BUCKET,
  accessKey: env.S3_ACCESS_KEY,
  secretKey: env.S3_SECRET_KEY,
})

export const ensureBucket = () => storage.ensureBucket()
export const storeFile = makeStoreFile({ storage, repository: prismaStoredFileRepository, bucket: env.S3_BUCKET, newId: () => crypto.randomUUID() })
export const readFile = makeReadFile({ storage, repository: prismaStoredFileRepository })
export const findHousePhoto = (originalName: string) => prismaStoredFileRepository.findByOriginalName('house_photo', originalName)
export type { StoredFileRecord } from './ports/stored-file-repository'
```

- [ ] **Step 5: Teste de integração contra o MinIO local**

```ts
// src/server/storage/adapters/s3-object-storage.int.test.ts
import { describe, expect, it } from 'vitest'
import { createS3ObjectStorage } from './s3-object-storage'

describe('createS3ObjectStorage', () => {
  const storage = createS3ObjectStorage({
    endpoint: process.env.S3_ENDPOINT!,
    useSsl: false,
    bucket: process.env.S3_BUCKET!,
    accessKey: process.env.S3_ACCESS_KEY!,
    secretKey: process.env.S3_SECRET_KEY!,
  })

  it('creates the bucket, writes and reads back', async () => {
    await storage.ensureBucket()
    await storage.put('probe/one.png', new Uint8Array([9, 8, 7]), 'image/png')
    expect(await storage.get('probe/one.png')).toEqual(new Uint8Array([9, 8, 7]))
    expect(await storage.get('probe/missing.png')).toBeNull()
  })
})
```

- [ ] **Step 6: Rota de leitura**

```ts
// src/app/routes/files/$fileId.ts
import { createFileRoute } from '@tanstack/react-router'
import { readFile } from '@/server/storage/composition'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export const Route = createFileRoute('/files/$fileId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!uuid.test(params.fileId)) return new Response('Arquivo não encontrado.', { status: 404 })
        const found = await readFile(params.fileId)
        if (!found) return new Response('Arquivo não encontrado.', { status: 404 })
        return new Response(found.body, {
          headers: {
            'Content-Type': found.file.contentType,
            'Content-Length': String(found.file.size),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      },
    },
  },
})
```

- [ ] **Step 7:** Run `pnpm vitest run src/server/storage`. Expected: PASS.
- [ ] **Step 8: Commit e merge** (`feat/storage`, `feat(arquivos): armazenamento no MinIO com registro no banco`).

---

### Task 12: Seed das fotos da casa

**Files:**
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: `ensureBucket`, `storeFile`, `findHousePhoto` (Task 11).

- [ ] **Step 1: Implementar (idempotente)**

```ts
// prisma/seed.ts
import { readdir, readFile as readBytes } from 'node:fs/promises'
import { join } from 'node:path'
import { ensureBucket, findHousePhoto, storeFile } from '../src/server/storage/composition'

const directory = 'prisma/seed-assets/house-photos'

await ensureBucket()
for (const name of (await readdir(directory)).filter((file) => file.endsWith('.jpg')).sort()) {
  if (await findHousePhoto(name)) {
    console.log(`já existe: ${name}`)
    continue
  }
  const bytes = new Uint8Array(await readBytes(join(directory, name)))
  const record = await storeFile({ kind: 'house_photo', contentType: 'image/jpeg', bytes, originalName: name })
  console.log(`enviada: ${name} -> ${record.id}`)
}
process.exit(0)
```

Ler arquivo do repositório no seed não fere "nada local": é carga inicial de dado para o MinIO, e o app em execução não lê nem escreve disco.

- [ ] **Step 2: Verificar**

Run: `pnpm db:seed` (duas vezes)
Expected: na primeira, 6 linhas `enviada: …`; na segunda, 6 linhas `já existe: …`.

Run: `docker compose exec postgres psql -U app -d forms_victor_dev -c "select original_name, kind, size from stored_files order by 1"`
Expected: as 6 fotos, `kind = house_photo`.

- [ ] **Step 3: Commit e merge** (`feat/seed-house-photos`, `feat(arquivos): seed das fotos da casa no MinIO`).

---

### Task 13: better-auth, sessão e bootstrap do admin

**Files:**
- Create: `src/server/shared/auth/auth.ts`, `src/server/shared/http/session-middleware.ts`, `src/server/shared/http/request-origin.ts`, `src/server/shared/http/request-origin.test.ts`, `src/app/routes/api/auth/$.ts`, `src/lib/auth-client.ts`, `scripts/bootstrap-admin.ts`, `src/server/shared/auth/auth.int.test.ts`

**Interfaces:**
- Consumes: `recordAudit` (Task 9).
- Produces:
  - `auth` (instância do better-auth) em `@/server/shared/auth/auth`; `USERNAME_RULE = /^[a-z][a-z0-9._-]{2,31}$/`; `MINIMUM_PASSWORD = 12`.
  - `sessionMiddleware` (contexto `{ session: { user: { id, username, name, role } } }`) e `adminMiddleware` em `@/server/shared/http/session-middleware`.
  - `requestOrigin(headers: Headers, socketAddress?: string | null): { ip: string | null; source: 'cf-connecting-ip' | 'x-real-ip' | 'x-forwarded-for' | 'socket'; chain: string | null }`.
  - `authClient` em `@/lib/auth-client`.

- [ ] **Step 1: Origem do pedido (teste que falha)**

```ts
// src/server/shared/http/request-origin.test.ts
import { describe, expect, it } from 'vitest'
import { requestOrigin } from './request-origin'

const headers = (entries: Record<string, string>) => new Headers(entries)

describe('requestOrigin', () => {
  it('prefers Cloudflare, then Traefik, then the first forwarded hop, then the socket', () => {
    expect(requestOrigin(headers({ 'cf-connecting-ip': '1.1.1.1', 'x-real-ip': '2.2.2.2' }))).toEqual({ ip: '1.1.1.1', source: 'cf-connecting-ip', chain: null })
    expect(requestOrigin(headers({ 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3, 4.4.4.4' }))).toEqual({ ip: '2.2.2.2', source: 'x-real-ip', chain: '3.3.3.3, 4.4.4.4' })
    expect(requestOrigin(headers({ 'x-forwarded-for': '3.3.3.3, 4.4.4.4' }))).toEqual({ ip: '3.3.3.3', source: 'x-forwarded-for', chain: '3.3.3.3, 4.4.4.4' })
    expect(requestOrigin(headers({}), '::ffff:5.5.5.5')).toEqual({ ip: '5.5.5.5', source: 'socket', chain: null })
  })
})
```

```ts
// src/server/shared/http/request-origin.ts
export type OriginSource = 'cf-connecting-ip' | 'x-real-ip' | 'x-forwarded-for' | 'socket'

const clean = (value: string | null | undefined) => (value ?? '').trim().replace(/^::ffff:/, '')

export function requestOrigin(headers: Headers, socketAddress?: string | null) {
  const chain = headers.get('x-forwarded-for')
  const candidates: [OriginSource, string][] = [
    ['cf-connecting-ip', clean(headers.get('cf-connecting-ip'))],
    ['x-real-ip', clean(headers.get('x-real-ip'))],
    ['x-forwarded-for', clean(chain?.split(',')[0])],
    ['socket', clean(socketAddress)],
  ]
  const found = candidates.find(([, ip]) => ip)
  return { ip: found?.[1] ?? null, source: found?.[0] ?? 'socket', chain: chain || null }
}
```

Run: `pnpm vitest run src/server/shared/http/request-origin.test.ts`. Expected: FAIL, depois PASS com a implementação.

- [ ] **Step 2: Instância do better-auth**

```ts
// src/server/shared/auth/auth.ts
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin, username } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { prisma } from '../prisma/client'
import { getEnv } from '../env'
import { recordAudit } from '@/server/audit/composition'
import { requestOrigin } from '../http/request-origin'

export const USERNAME_RULE = /^[a-z][a-z0-9._-]{2,31}$/
export const MINIMUM_PASSWORD = 12
const SIGN_IN_PATH = '/sign-in/username'

const env = getEnv()

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: MINIMUM_PASSWORD, maxPasswordLength: 128 },
  session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 60 },
  rateLimit: {
    enabled: true,
    storage: 'database',
    modelName: 'rateLimit',
    window: 60,
    max: 60,
    customRules: { [SIGN_IN_PATH]: { window: 60, max: 5 } },
  },
  advanced: { cookiePrefix: 'forms', useSecureCookies: env.NODE_ENV === 'production' },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 32, usernameValidator: (value) => USERNAME_RULE.test(value) }),
    admin({ defaultRole: 'team', adminRoles: ['admin'] }),
    tanstackStartCookies(),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith('/admin/') && ctx.request) throw new APIError('FORBIDDEN')
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) return
      const attempted = String((ctx.body as { username?: string } | undefined)?.username ?? '').toLowerCase()
      const origin = ctx.request ? requestOrigin(ctx.request.headers) : null
      const returned = ctx.context.returned
      if (returned instanceof APIError) {
        await recordAudit({ action: 'access_denied', actorUsername: attempted || null, reference: attempted || null, detail: { reason: returned.message, ip: origin?.ip } })
        return
      }
      const user = ctx.context.newSession?.user
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
        await recordAudit({ action: 'login', actorId: user.id, actorUsername: attempted, detail: { ip: origin?.ip } })
      }
    }),
  },
})
```

- [ ] **Step 3: Conferir o schema contra o gerador do better-auth**

Run: `pnpm dlx @better-auth/cli@latest generate --config src/server/shared/auth/auth.ts --output tmp-auth.prisma -y`
Expected: um schema com `User`, `Session`, `Account`, `Verification` e `RateLimit`. Compare os campos com `prisma/schema.prisma` da Tarefa 3. Se faltar algum campo, acrescente-o ao schema e rode `pnpm prisma migrate dev --name auth-fields`. Depois `rm tmp-auth.prisma`.

- [ ] **Step 4: Rota do handler, middleware e cliente**

```ts
// src/app/routes/api/auth/$.ts
import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/server/shared/auth/auth'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
})
```

```ts
// src/server/shared/http/session-middleware.ts
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '../auth/auth'

export class AuthorizationError extends Error {
  constructor(readonly reason: 'unauthenticated' | 'forbidden') {
    super(reason)
  }
}

export const sessionMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session || session.user.banned) throw new AuthorizationError('unauthenticated')
  const user = {
    id: session.user.id,
    username: session.user.username ?? '',
    name: session.user.name,
    role: session.user.role === 'admin' ? ('admin' as const) : ('team' as const),
  }
  return next({ context: { session: { user } } })
})

export const adminMiddleware = createMiddleware({ type: 'function' })
  .middleware([sessionMiddleware])
  .server(async ({ next, context }) => {
    if (context.session.user.role !== 'admin') throw new AuthorizationError('forbidden')
    return next()
  })
```

```ts
// src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react'
import { usernameClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({ plugins: [usernameClient()] })
```

- [ ] **Step 5: Bootstrap do admin**

```ts
// scripts/bootstrap-admin.ts
import { auth, MINIMUM_PASSWORD, USERNAME_RULE } from '../src/server/shared/auth/auth'
import { prisma } from '../src/server/shared/prisma/client'
import { recordAudit } from '../src/server/audit/composition'

const username = (process.env.BOOTSTRAP_ADMIN_USERNAME ?? '').trim().toLowerCase()
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? ''

if (!USERNAME_RULE.test(username)) throw new Error('BOOTSTRAP_ADMIN_USERNAME inválido (a-z, 3 a 32, começa com letra)')
if (password.length < MINIMUM_PASSWORD) throw new Error(`BOOTSTRAP_ADMIN_PASSWORD precisa de ${MINIMUM_PASSWORD} caracteres ou mais`)

const existing = await prisma.user.findUnique({ where: { username } })
if (existing) {
  await prisma.user.update({ where: { id: existing.id }, data: { role: 'admin', banned: false, banReason: null, banExpires: null } })
  const context = await auth.$context
  const hash = await context.password.hash(password)
  await prisma.account.updateMany({ where: { userId: existing.id, providerId: 'credential' }, data: { password: hash } })
  await prisma.session.deleteMany({ where: { userId: existing.id } })
  await recordAudit({ action: 'admin_bootstrapped', actorUsername: 'bootstrap', reference: username, detail: { mode: 'reactivated' } })
  console.log(`admin reativado: ${username}`)
} else {
  await auth.api.createUser({
    body: { email: `${username}@users.invalid`, password, name: username, role: 'admin', data: { username, displayUsername: username } },
  })
  await recordAudit({ action: 'admin_bootstrapped', actorUsername: 'bootstrap', reference: username, detail: { mode: 'created' } })
  console.log(`admin criado: ${username}`)
}
process.exit(0)
```

- [ ] **Step 6: Teste de integração do fluxo de login**

```ts
// src/server/shared/auth/auth.int.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../../../../tests/integration/db'
import { prisma } from '../prisma/client'
import { auth } from './auth'

const signIn = (username: string, password: string) =>
  auth.handler(
    new Request('http://localhost:3000/api/auth/sign-in/username', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-real-ip': '9.9.9.9' },
      body: JSON.stringify({ username, password }),
    }),
  )

describe('auth', () => {
  beforeEach(async () => {
    await resetDatabase()
    await auth.api.createUser({
      body: { email: 'ana@users.invalid', password: 'senha-bem-longa-1', name: 'Ana', role: 'admin', data: { username: 'ana' } },
    })
  })

  it('signs in by username and records the login', async () => {
    const response = await signIn('ana', 'senha-bem-longa-1')
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toMatch(/forms\.session_token=/)
    const entries = await prisma.auditLog.findMany()
    expect(entries.map((e) => e.action)).toContain('login')
    expect((await prisma.user.findUnique({ where: { username: 'ana' } }))?.lastLoginAt).not.toBeNull()
  })

  it('records a denied access', async () => {
    const response = await signIn('ana', 'errada-errada-errada')
    expect(response.status).toBe(401)
    const denied = await prisma.auditLog.findFirst({ where: { action: 'access_denied' } })
    expect(denied?.reference).toBe('ana')
  })

  it('refuses public sign-up', async () => {
    const response = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ email: 'x@y.com', password: 'senha-bem-longa-1', name: 'X', username: 'xavier' }),
      }),
    )
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(await prisma.user.count()).toBe(1)
  })

  it('closes admin endpoints to HTTP calls', async () => {
    const response = await auth.handler(
      new Request('http://localhost:3000/api/auth/admin/list-users', { headers: { origin: 'http://localhost:3000' } }),
    )
    expect(response.status).toBe(403)
  })
})
```

Run: `pnpm vitest run src/server/shared/auth`
Expected: PASS nos 4. O rate limit de login é de 5 por minuto; o `resetDatabase` limpa `auth_rate_limits` entre os testes.

- [ ] **Step 7: Verificar o bootstrap**

Run: `BOOTSTRAP_ADMIN_USERNAME=joao BOOTSTRAP_ADMIN_PASSWORD=uma-senha-longa-local pnpm auth:bootstrap-admin` (no PowerShell: `$env:BOOTSTRAP_ADMIN_USERNAME='joao'; $env:BOOTSTRAP_ADMIN_PASSWORD='uma-senha-longa-local'; pnpm auth:bootstrap-admin`)
Expected: `admin criado: joao`; rodando de novo, `admin reativado: joao`.

- [ ] **Step 8: Commit e merge** (`feat/auth`, `feat(auth): better-auth por usuário, sessão no banco e bootstrap do admin`).

---

### Task 14: Gestão de usuários (casos de uso de identidade)

**Files:**
- Create: `src/server/identity/domain/user.ts`, `src/server/identity/domain/user-rules.ts`, `src/server/identity/domain/user-rules.test.ts`, `src/server/identity/ports/user-accounts.ts`, `src/server/identity/application/manage-users.ts`, `src/server/identity/application/manage-users.test.ts`, `src/server/identity/adapters/better-auth-user-accounts.ts`, `src/server/identity/composition.ts`

**Interfaces:**
- Consumes: `auth`, `USERNAME_RULE`, `MINIMUM_PASSWORD` (Task 13), `recordAudit` (Task 9).
- Produces em `@/server/identity/composition`: `listUsers()`, `createUser(actor, input)`, `updateUser(actor, username, changes)`. `Actor = { id: string; username: string; role: 'admin' | 'team' }`. `UserChanges = { name?: string; password?: string; role?: 'admin' | 'team'; active?: boolean }`. Os erros são `IdentityError` com `reason: 'invalid_username' | 'weak_password' | 'username_taken' | 'not_found' | 'forbidden' | 'last_admin'` e mensagem em português.

- [ ] **Step 1: Regras de domínio (teste que falha)**

```ts
// src/server/identity/domain/user.ts
export type Role = 'admin' | 'team'

export interface UserAccount {
  id: string
  username: string
  name: string
  role: Role
  active: boolean
  lastLoginAt: Date | null
  createdAt: Date
}

export interface Actor {
  id: string
  username: string
  role: Role
}

export interface UserChanges {
  name?: string
  password?: string
  role?: Role
  active?: boolean
}

export type IdentityErrorReason = 'invalid_username' | 'weak_password' | 'username_taken' | 'not_found' | 'forbidden' | 'last_admin'

const MESSAGES: Record<IdentityErrorReason, string> = {
  invalid_username: 'usuário deve ter de 3 a 32 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado, começando por letra',
  weak_password: 'a senha precisa de pelo menos 12 caracteres',
  username_taken: 'já existe um usuário com esse nome',
  not_found: 'usuário não encontrado',
  forbidden: 'só administrador',
  last_admin: 'não dá para desativar ou rebaixar o único administrador ativo; promova outro antes',
}

export class IdentityError extends Error {
  constructor(readonly reason: IdentityErrorReason) {
    super(MESSAGES[reason])
  }
}
```

```ts
// src/server/identity/domain/user-rules.ts
import { IdentityError, type Actor, type UserAccount, type UserChanges } from './user'

export const USERNAME_RULE = /^[a-z][a-z0-9._-]{2,31}$/
export const MINIMUM_PASSWORD = 12

export function normalizeUsername(raw: string): string {
  const username = raw.trim().toLowerCase()
  if (!USERNAME_RULE.test(username)) throw new IdentityError('invalid_username')
  return username
}

export function assertPassword(password: string): void {
  if (password.length < MINIMUM_PASSWORD) throw new IdentityError('weak_password')
}

export function assertMayChange(actor: Actor, target: UserAccount, changes: UserChanges): void {
  if (actor.role === 'admin') return
  const onlyOwnPassword =
    actor.id === target.id &&
    changes.password !== undefined &&
    changes.role === undefined &&
    changes.active === undefined &&
    changes.name === undefined
  if (!onlyOwnPassword) throw new IdentityError('forbidden')
}

export function assertKeepsAnAdmin(target: UserAccount, changes: UserChanges, activeAdmins: number): void {
  const losesAdmin = target.role === 'admin' && target.active && (changes.role === 'team' || changes.active === false)
  if (losesAdmin && activeAdmins <= 1) throw new IdentityError('last_admin')
}
```

A Tarefa 13 passa a importar `USERNAME_RULE` e `MINIMUM_PASSWORD` daqui? **Não**: `shared` não importa módulo. As duas constantes ficam duplicadas de propósito em `shared/auth/auth.ts` (configuração do better-auth) e aqui (regra de negócio). O teste abaixo trava a igualdade.

```ts
// src/server/identity/domain/user-rules.test.ts
import { describe, expect, it } from 'vitest'
import { MINIMUM_PASSWORD, USERNAME_RULE, assertKeepsAnAdmin, assertMayChange, normalizeUsername } from './user-rules'
import type { UserAccount } from './user'

const admin: UserAccount = { id: 'a', username: 'ana', name: 'Ana', role: 'admin', active: true, lastLoginAt: null, createdAt: new Date(0) }
const team: UserAccount = { ...admin, id: 't', username: 'bia', role: 'team' }

describe('user rules', () => {
  it('normalizes usernames', () => {
    expect(normalizeUsername('  Ana.Souza ')).toBe('ana.souza')
    expect(() => normalizeUsername('1ana')).toThrow(/começando por letra/)
  })
  it('lets team members change only their own password', () => {
    expect(() => assertMayChange({ id: 't', username: 'bia', role: 'team' }, team, { password: 'x'.repeat(12) })).not.toThrow()
    expect(() => assertMayChange({ id: 't', username: 'bia', role: 'team' }, team, { name: 'B' })).toThrow('só administrador')
    expect(() => assertMayChange({ id: 't', username: 'bia', role: 'team' }, admin, { password: 'x'.repeat(12) })).toThrow('só administrador')
  })
  it('refuses to remove the last active admin', () => {
    expect(() => assertKeepsAnAdmin(admin, { active: false }, 1)).toThrow(/único administrador/)
    expect(() => assertKeepsAnAdmin(admin, { role: 'team' }, 2)).not.toThrow()
  })
  it('matches the auth configuration', async () => {
    const shared = await import('@/server/shared/auth/auth')
    expect(USERNAME_RULE.source).toBe(shared.USERNAME_RULE.source)
    expect(MINIMUM_PASSWORD).toBe(shared.MINIMUM_PASSWORD)
  })
})
```

O último teste importa `auth.ts`, que lê o ambiente. Ele roda no projeto `unit` com o `.env.test` carregado e não abre conexão. Se o lint de fronteira reclamar do import dentro do teste, acrescente ao `eslint.config.js` um bloco `files: ['**/*.test.ts']` com `'boundaries/element-types': 'off'`.

- [ ] **Step 2: Porta e caso de uso (teste que falha)**

```ts
// src/server/identity/ports/user-accounts.ts
import type { Role, UserAccount } from '../domain/user'

export interface UserAccounts {
  list(): Promise<UserAccount[]>
  findByUsername(username: string): Promise<UserAccount | null>
  countActiveAdmins(): Promise<number>
  create(input: { username: string; name: string; password: string; role: Role }): Promise<UserAccount>
  rename(id: string, name: string): Promise<void>
  setRole(id: string, role: Role): Promise<void>
  setActive(id: string, active: boolean): Promise<void>
  setPassword(id: string, password: string): Promise<void>
}
```

```ts
// src/server/identity/application/manage-users.test.ts
import { describe, expect, it } from 'vitest'
import type { UserAccount } from '../domain/user'
import type { UserAccounts } from '../ports/user-accounts'
import { makeManageUsers } from './manage-users'

function fakeAccounts(seed: UserAccount[]) {
  const users = new Map(seed.map((u) => [u.username, { ...u }]))
  const byId = (id: string) => [...users.values()].find((u) => u.id === id)!
  const accounts: UserAccounts = {
    list: async () => [...users.values()],
    findByUsername: async (username) => users.get(username) ?? null,
    countActiveAdmins: async () => [...users.values()].filter((u) => u.role === 'admin' && u.active).length,
    create: async ({ username, name, role }) => {
      const user: UserAccount = { id: username, username, name, role, active: true, lastLoginAt: null, createdAt: new Date(0) }
      users.set(username, user)
      return user
    },
    rename: async (id, name) => void (byId(id).name = name),
    setRole: async (id, role) => void (byId(id).role = role),
    setActive: async (id, active) => void (byId(id).active = active),
    setPassword: async () => {},
  }
  return { users, accounts }
}

const ana: UserAccount = { id: 'ana', username: 'ana', name: 'Ana', role: 'admin', active: true, lastLoginAt: null, createdAt: new Date(0) }
const actorAna = { id: 'ana', username: 'ana', role: 'admin' as const }

describe('manage users', () => {
  it('creates a team member and audits it', async () => {
    const audit: string[] = []
    const { accounts } = fakeAccounts([ana])
    const users = makeManageUsers({ accounts, recordAudit: async (e) => void audit.push(e.action) })
    const created = await users.createUser(actorAna, { username: 'Bia', name: 'Bia', password: 'x'.repeat(12), role: 'team' })
    expect(created.username).toBe('bia')
    expect(audit).toEqual(['user_created'])
  })

  it('refuses a duplicate username', async () => {
    const { accounts } = fakeAccounts([ana])
    const users = makeManageUsers({ accounts, recordAudit: async () => {} })
    await expect(users.createUser(actorAna, { username: 'ana', name: 'A', password: 'x'.repeat(12), role: 'team' })).rejects.toThrow('já existe')
  })

  it('refuses to deactivate the last admin', async () => {
    const { accounts } = fakeAccounts([ana])
    const users = makeManageUsers({ accounts, recordAudit: async () => {} })
    await expect(users.updateUser(actorAna, 'ana', { active: false })).rejects.toThrow(/único administrador/)
  })

  it('only admins create users', async () => {
    const { accounts } = fakeAccounts([ana])
    const users = makeManageUsers({ accounts, recordAudit: async () => {} })
    await expect(
      users.createUser({ id: 'bia', username: 'bia', role: 'team' }, { username: 'caio', name: 'C', password: 'x'.repeat(12), role: 'team' }),
    ).rejects.toThrow('só administrador')
  })
})
```

- [ ] **Step 3:** Run `pnpm vitest run src/server/identity`. Expected: FAIL.
- [ ] **Step 4: Implementar**

```ts
// src/server/identity/application/manage-users.ts
import { IdentityError, type Actor, type Role, type UserChanges } from '../domain/user'
import { assertKeepsAnAdmin, assertMayChange, assertPassword, normalizeUsername } from '../domain/user-rules'
import type { UserAccounts } from '../ports/user-accounts'

type AuditRecorder = (entry: { action: 'user_created' | 'user_updated'; actorId: string; actorUsername: string; reference: string; detail: Record<string, unknown> }) => Promise<void>

export function makeManageUsers({ accounts, recordAudit }: { accounts: UserAccounts; recordAudit: AuditRecorder }) {
  return {
    listUsers: () => accounts.list(),

    async createUser(actor: Actor, input: { username: string; name: string; password: string; role: Role }) {
      if (actor.role !== 'admin') throw new IdentityError('forbidden')
      const username = normalizeUsername(input.username)
      assertPassword(input.password)
      if (await accounts.findByUsername(username)) throw new IdentityError('username_taken')
      const created = await accounts.create({ username, name: input.name.trim() || username, password: input.password, role: input.role })
      await recordAudit({ action: 'user_created', actorId: actor.id, actorUsername: actor.username, reference: username, detail: { role: input.role } })
      return created
    },

    async updateUser(actor: Actor, rawUsername: string, changes: UserChanges) {
      const target = await accounts.findByUsername(normalizeUsername(rawUsername))
      if (!target) throw new IdentityError('not_found')
      assertMayChange(actor, target, changes)
      assertKeepsAnAdmin(target, changes, await accounts.countActiveAdmins())
      if (changes.password !== undefined) assertPassword(changes.password)
      if (changes.name !== undefined) await accounts.rename(target.id, changes.name.trim())
      if (changes.role !== undefined) await accounts.setRole(target.id, changes.role)
      if (changes.active !== undefined) await accounts.setActive(target.id, changes.active)
      if (changes.password !== undefined) await accounts.setPassword(target.id, changes.password)
      const changed = Object.keys(changes).filter((key) => changes[key as keyof UserChanges] !== undefined)
      await recordAudit({ action: 'user_updated', actorId: actor.id, actorUsername: actor.username, reference: target.username, detail: { changed } })
    },
  }
}
```

```ts
// src/server/identity/adapters/better-auth-user-accounts.ts
import { auth } from '@/server/shared/auth/auth'
import { prisma } from '@/server/shared/prisma/client'
import type { UserAccount } from '../domain/user'
import type { UserAccounts } from '../ports/user-accounts'

type Row = { id: string; username: string | null; name: string; role: string; banned: boolean; lastLoginAt: Date | null; createdAt: Date }

const toAccount = (row: Row): UserAccount => ({
  id: row.id,
  username: row.username ?? '',
  name: row.name,
  role: row.role === 'admin' ? 'admin' : 'team',
  active: !row.banned,
  lastLoginAt: row.lastLoginAt,
  createdAt: row.createdAt,
})

const select = { id: true, username: true, name: true, role: true, banned: true, lastLoginAt: true, createdAt: true } as const

export const betterAuthUserAccounts: UserAccounts = {
  list: async () => (await prisma.user.findMany({ select, orderBy: { username: 'asc' } })).map(toAccount),
  findByUsername: async (username) => {
    const row = await prisma.user.findUnique({ where: { username }, select })
    return row ? toAccount(row) : null
  },
  countActiveAdmins: () => prisma.user.count({ where: { role: 'admin', banned: false } }),
  async create({ username, name, password, role }) {
    await auth.api.createUser({ body: { email: `${username}@users.invalid`, password, name, role, data: { username, displayUsername: username } } })
    return toAccount((await prisma.user.findUniqueOrThrow({ where: { username }, select })))
  },
  rename: async (id, name) => void (await prisma.user.update({ where: { id }, data: { name } })),
  setRole: async (id, role) => void (await prisma.user.update({ where: { id }, data: { role } })),
  async setActive(id, active) {
    await prisma.user.update({ where: { id }, data: { banned: !active, banReason: active ? null : 'desativado' } })
    if (!active) await prisma.session.deleteMany({ where: { userId: id } })
  },
  async setPassword(id, password) {
    const context = await auth.$context
    await prisma.account.updateMany({ where: { userId: id, providerId: 'credential' }, data: { password: await context.password.hash(password) } })
    await prisma.session.deleteMany({ where: { userId: id } })
  },
}
```

```ts
// src/server/identity/composition.ts
import { recordAudit } from '@/server/audit/composition'
import { betterAuthUserAccounts } from './adapters/better-auth-user-accounts'
import { makeManageUsers } from './application/manage-users'

const manageUsers = makeManageUsers({ accounts: betterAuthUserAccounts, recordAudit })

export const listUsers = manageUsers.listUsers
export const createUser = manageUsers.createUser
export const updateUser = manageUsers.updateUser
export { IdentityError } from './domain/user'
export type { Actor, Role, UserAccount, UserChanges } from './domain/user'
```

- [ ] **Step 5:** Run `pnpm vitest run src/server/identity`. Expected: PASS.
- [ ] **Step 6: Commit e merge** (`feat/identity`, `feat(usuarios): casos de uso com trava do último admin e auditoria`).

---

### Task 15: Tema shadcn e telas de login e logout

**Files:**
- Create: `components.json`, `src/lib/utils.ts`, `src/components/ui/{button,input,label,card,alert}.tsx` (gerados), `src/components/brand/auster-mark.tsx`, `src/features/auth/api/session.ts`, `src/features/auth/components/login-form.tsx`, `src/app/routes/login.tsx`, `src/app/routes/logout.tsx`, `src/app/routes/backoffice/route.tsx`, `src/app/routes/backoffice/index.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `authClient` (Task 13), `sessionMiddleware`, `auth`.
- Produces: `getCurrentUser` (server function → `{ id, username, name, role } | null`), `signOutCurrentUser` (server function), `LoginForm`, `AusterMark`, rota `/backoffice` protegida.

- [ ] **Step 1: shadcn**

```json
// components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/styles/app.css", "baseColor": "slate", "cssVariables": true },
  "aliases": { "components": "@/components", "ui": "@/components/ui", "utils": "@/lib/utils", "lib": "@/lib", "hooks": "@/hooks" },
  "iconLibrary": "lucide"
}
```

Run: `pnpm dlx shadcn@4.21.0 add button input label card alert -y`
Expected: arquivos em `src/components/ui/` e `src/lib/utils.ts` com `cn()`.

- [ ] **Step 2: Tokens Auster nas variáveis do shadcn**

Acrescente a `src/styles/app.css`, depois do bloco `@theme` (substitua o bloco `:root` que o shadcn tiver escrito):

```css
:root {
  --radius: 0.5rem;
  --background: #f1f5f8;
  --foreground: #052c47;
  --card: #ffffff;
  --card-foreground: #052c47;
  --popover: #ffffff;
  --popover-foreground: #052c47;
  --primary: #052c47;
  --primary-foreground: #ffffff;
  --secondary: #e6f5fb;
  --secondary-foreground: #052c47;
  --muted: #f1f5f8;
  --muted-foreground: #5b6b78;
  --accent: #e6f5fb;
  --accent-foreground: #052c47;
  --destructive: #b63b32;
  --border: #cfd9e0;
  --input: #8496a5;
  --ring: #71cfeb;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 4px);
}
```

- [ ] **Step 3: Marca, server functions e formulário**

```tsx
// src/components/brand/auster-mark.tsx
export function AusterMark({ caption }: { caption: string }) {
  return (
    <div className="mb-5 flex items-center gap-[9px]">
      <div className="flex size-[26px] shrink-0 items-center justify-center rounded-md bg-auster-dark">
        <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M8 21l8-11 8 11" stroke="#71CFEB" strokeWidth="3" fill="none" />
        </svg>
      </div>
      <span className="text-xs uppercase tracking-[1.1px] text-auster-gray">{caption}</span>
    </div>
  )
}
```

```ts
// src/features/auth/api/session.ts
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '@/server/shared/auth/auth'

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session || session.user.banned) return null
  return {
    id: session.user.id,
    username: session.user.username ?? '',
    name: session.user.name,
    role: session.user.role === 'admin' ? ('admin' as const) : ('team' as const),
  }
})

export const signOutCurrentUser = createServerFn({ method: 'POST' }).handler(async () => {
  await auth.api.signOut({ headers: getRequest().headers })
})
```

```tsx
// src/features/auth/components/login-form.tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'
import { AusterMark } from '@/components/brand/auster-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    const { error: failure } = await authClient.signIn.username({
      username: String(form.get('username') ?? '').trim().toLowerCase(),
      password: String(form.get('password') ?? ''),
    })
    setPending(false)
    if (failure) {
      setError(failure.status === 429 ? 'Muitas tentativas. Espere um minuto e tente de novo.' : 'Usuário ou senha não conferem. Tente de novo.')
      return
    }
    await navigate({ to: redirectTo })
  }

  return (
    <form onSubmit={submit} className="w-full max-w-[400px] rounded-xl border border-[#e3e9ee] bg-white px-8 py-[34px] shadow-[0_1px_3px_rgba(5,44,71,.08)]">
      <AusterMark caption="auster · uso interno" />
      <h1 className="mb-1.5 text-[21px] font-normal text-auster-dark">Conferência do Diagnóstico</h1>
      <p className="mb-[22px] text-[13px] leading-relaxed text-auster-gray">
        Entre com o seu usuário e a sua senha. É esse nome que fica gravado na auditoria de cada resposta que você validar.
      </p>
      {error ? (
        <Alert variant="destructive" className="mb-[18px] border-[#f0c4c4] bg-[#fdf0f0] text-[#8d2226]">
          <AlertDescription className="text-[13px]">{error}</AlertDescription>
        </Alert>
      ) : null}
      <Label htmlFor="username" className="mb-1.5 block text-xs font-normal uppercase tracking-[.9px] text-auster-gray">Usuário</Label>
      <Input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus className="mb-4 h-auto px-3.5 py-3" />
      <Label htmlFor="password" className="mb-1.5 block text-xs font-normal uppercase tracking-[.9px] text-auster-gray">Senha</Label>
      <Input id="password" name="password" type="password" autoComplete="current-password" required className="mb-4 h-auto px-3.5 py-3" />
      <Button type="submit" disabled={pending} className="h-auto w-full py-[13px] font-medium hover:bg-[#0a3d60]">
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Rotas**

```tsx
// src/app/routes/login.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { getCurrentUser } from '@/features/auth/api/session'
import { LoginForm } from '@/features/auth/components/login-form'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().startsWith('/backoffice').optional() }),
  beforeLoad: async ({ search }) => {
    if (await getCurrentUser()) throw redirect({ to: search.redirect ?? '/backoffice' })
  },
  head: () => ({ meta: [{ title: 'Entrar — Conferência do Diagnóstico' }] }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect: target } = Route.useSearch()
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7f9] p-6">
      <LoginForm redirectTo={target ?? '/backoffice'} />
    </main>
  )
}
```

```tsx
// src/app/routes/logout.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { signOutCurrentUser } from '@/features/auth/api/session'

export const Route = createFileRoute('/logout')({
  beforeLoad: async () => {
    await signOutCurrentUser()
    throw redirect({ to: '/login' })
  },
})
```

```tsx
// src/app/routes/backoffice/route.tsx
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentUser } from '@/features/auth/api/session'

export const Route = createFileRoute('/backoffice')({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
    return { user }
  },
  component: Outlet,
})
```

```tsx
// src/app/routes/backoffice/index.tsx
import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/backoffice/')({ component: BackofficeHome })

function BackofficeHome() {
  const { user } = Route.useRouteContext()
  return (
    <main className="mx-auto max-w-[1180px] px-6 py-10">
      <h1 className="text-[21px] font-normal text-auster-dark">Conferência</h1>
      <p className="mt-2 text-sm text-auster-gray">
        Olá, {user.name}. As áreas do backoffice entram na etapa 4.
      </p>
      <Link to="/logout" className="mt-6 inline-block text-sm text-auster-accent underline">Sair</Link>
    </main>
  )
}
```

- [ ] **Step 5: Verificar no navegador**

Run: `pnpm dev`. Checagens:
1. `http://localhost:3000/backoffice` sem sessão redireciona para `/login?redirect=%2Fbackoffice`.
2. Login com o admin da Tarefa 13: cai em `/backoffice` com "Olá, joao".
3. Senha errada: mostra "Usuário ou senha não conferem. Tente de novo."
4. `/logout` volta para `/login`, e `/backoffice` volta a pedir login.
5. A tela de login bate com `legacy/entrar.html` aberto lado a lado (caixa de 400 px, marca, título de 21 px, rótulos em caixa alta).

- [ ] **Step 6: Commit e merge** (`feat/login`, `feat(auth): tema Auster no shadcn, login e logout`).

---

### Task 16: Consulta de CNPJ pelo servidor

**Files:**
- Create: `src/server/company-lookup/domain/company.ts`, `src/server/company-lookup/domain/company.test.ts`, `src/server/company-lookup/ports/company-registry.ts`, `src/server/company-lookup/application/lookup-company.ts`, `src/server/company-lookup/application/lookup-company.test.ts`, `src/server/company-lookup/adapters/brasilapi-company-registry.ts`, `src/server/company-lookup/adapters/brasilapi-company-registry.test.ts`, `src/server/company-lookup/composition.ts`

**Interfaces:**
- Produces: `lookupCompany({ cnpj, requesterName? }): Promise<CompanyLookup>` em `@/server/company-lookup/composition`, com `CompanyLookup = { ok: false; reason: 'cnpj incompleto' | 'tempo esgotado' | 'indisponível' | `HTTP ${number}` } | { ok: true; company: CompanyData; requesterInQsa: boolean | null }` e `CompanyData = { legalName, tradeName, registrationStatus, active, simplesOptant, meiOptant, activityStart, mainCnae, mainCnaeDescription, secondaryCnaes, state, city }`. **O QSA nunca sai do módulo.** `normalizeCnae`, `cnaeDivision`, `isNameInQsa`, `monthsOfActivityInYear` em `domain/company.ts`.

| Antigo (`legacy/src/consulta_cnpj.js`) | Novo |
|---|---|
| `normalizarCnae`, `divisaoCnae`, `nomeConstaNoQsa`, `mesesDeAtividadeNoAno` | `normalizeCnae`, `cnaeDivision`, `isNameInQsa`, `monthsOfActivityInYear` (domínio puro) |
| `consultarCnpj` → `dados {razaoSocial, nomeFantasia, situacao, ativa, optanteSimples, optanteMei, inicioAtividade, cnaePrincipal, cnaeDescricao, cnaesSecundarios, uf, municipio}, qsa` | adaptador `brasilApiCompanyRegistry.find(cnpj)` → `{ company: CompanyData, partners: { name: string }[] }` |

O motivo `bloqueado por abrir o arquivo direto` some: a consulta agora sai do servidor. O `User-Agent: Auster-Portal-Diagnostico/1.0` vai sempre.

- [ ] **Step 1: Testes que falham**

```ts
// src/server/company-lookup/domain/company.test.ts
import { describe, expect, it } from 'vitest'
import * as legacy from '../../../../legacy/src/consulta_cnpj.js'
import { cnaeDivision, isNameInQsa, monthsOfActivityInYear, normalizeCnae } from './company'

describe('company domain parity', () => {
  it.each([6422100, '0600001', 600001, null, 'abc'])('normalizes cnae %s', (value) => {
    expect(normalizeCnae(value)).toBe(legacy.normalizarCnae(value))
    expect(cnaeDivision(value)).toBe(legacy.divisaoCnae(value))
  })
  it('matches names against the partner list the same way', () => {
    const qsa = [{ nome_socio: 'MARIA DA SILVA SOUZA' }, { nome_socio: 'JOÃO PEREIRA' }]
    for (const name of ['Maria Souza', 'maria da silva', 'Joao Pereira', 'Ana', 'Carlos Lima', '']) {
      expect(isNameInQsa(name, qsa.map((p) => ({ name: p.nome_socio })))).toBe(legacy.nomeConstaNoQsa(name, qsa))
    }
  })
  it('counts months of activity', () => {
    expect(monthsOfActivityInYear('2026-03-15', 2026)).toBe(legacy.mesesDeAtividadeNoAno('2026-03-15', 2026))
  })
})
```

```ts
// src/server/company-lookup/adapters/brasilapi-company-registry.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createBrasilApiCompanyRegistry } from './brasilapi-company-registry'

const sample = {
  razao_social: 'EMPRESA TESTE LTDA', nome_fantasia: 'TESTE', descricao_situacao_cadastral: 'ATIVA',
  opcao_pelo_simples: true, opcao_pelo_mei: false, data_inicio_atividade: '2020-01-02',
  cnae_fiscal: 6201501, cnae_fiscal_descricao: 'Desenvolvimento', cnaes_secundarios: [{ codigo: 620300 }],
  uf: 'MG', municipio: 'UBERLANDIA', qsa: [{ nome_socio: 'MARIA SOUZA' }],
}

describe('brasilApiCompanyRegistry', () => {
  it('sends the User-Agent and maps the payload', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 }))
    const registry = createBrasilApiCompanyRegistry({ fetch: fetchMock, timeoutMs: 4000 })
    const result = await registry.find('11222333000181')
    expect(fetchMock).toHaveBeenCalledWith('https://brasilapi.com.br/api/cnpj/v1/11222333000181', expect.objectContaining({ headers: { 'User-Agent': 'Auster-Portal-Diagnostico/1.0' } }))
    expect(result).toMatchObject({ ok: true, company: { legalName: 'EMPRESA TESTE LTDA', active: true, simplesOptant: true, mainCnae: '6201501', secondaryCnaes: ['0620300'] }, partners: [{ name: 'MARIA SOUZA' }] })
  })
  it('never throws on HTTP errors or timeouts', async () => {
    const failing = createBrasilApiCompanyRegistry({ fetch: async () => new Response('x', { status: 403 }), timeoutMs: 10 })
    expect(await failing.find('11222333000181')).toEqual({ ok: false, reason: 'HTTP 403' })
    const slow = createBrasilApiCompanyRegistry({
      fetch: (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
      timeoutMs: 10,
    })
    expect(await slow.find('11222333000181')).toEqual({ ok: false, reason: 'tempo esgotado' })
  })
})
```

```ts
// src/server/company-lookup/application/lookup-company.test.ts
import { describe, expect, it } from 'vitest'
import { makeLookupCompany } from './lookup-company'

describe('lookupCompany', () => {
  it('returns company data and the QSA check, never the partner list', async () => {
    const lookup = makeLookupCompany({
      find: async () => ({ ok: true, company: { legalName: 'X' } as never, partners: [{ name: 'MARIA SOUZA' }] }),
    })
    const result = await lookup({ cnpj: '11.222.333/0001-81', requesterName: 'Maria Souza' })
    expect(result).toEqual({ ok: true, company: { legalName: 'X' }, requesterInQsa: true })
    expect(JSON.stringify(result)).not.toContain('partners')
  })
  it('refuses an incomplete cnpj without calling the registry', async () => {
    let called = false
    const lookup = makeLookupCompany({ find: async () => ((called = true), { ok: false, reason: 'indisponível' }) })
    expect(await lookup({ cnpj: '11.222' })).toEqual({ ok: false, reason: 'cnpj incompleto' })
    expect(called).toBe(false)
  })
})
```

- [ ] **Step 2:** Run `pnpm vitest run src/server/company-lookup`. Expected: FAIL.
- [ ] **Step 3: Implementar**

`domain/company.ts`: porte fiel das quatro funções puras de `legacy/src/consulta_cnpj.js` pela tabela. `isNameInQsa(name: string, partners: { name: string }[]): boolean | null`, mesma regra (sem acento, caixa alta, ignora DA/DE/DO/DAS/DOS/E, pelo menos duas palavras, toda palavra em algum sócio). Também define o tipo `CompanyData`.

```ts
// src/server/company-lookup/ports/company-registry.ts
import type { CompanyData } from '../domain/company'

export type RegistryResult =
  | { ok: true; company: CompanyData; partners: { name: string }[] }
  | { ok: false; reason: 'tempo esgotado' | 'indisponível' | `HTTP ${number}` }

export interface CompanyRegistry {
  find(cnpjDigits: string): Promise<RegistryResult>
}
```

```ts
// src/server/company-lookup/application/lookup-company.ts
import { isNameInQsa, type CompanyData } from '../domain/company'
import type { CompanyRegistry } from '../ports/company-registry'

export type CompanyLookup =
  | { ok: false; reason: 'cnpj incompleto' | 'tempo esgotado' | 'indisponível' | `HTTP ${number}` }
  | { ok: true; company: CompanyData; requesterInQsa: boolean | null }

export const makeLookupCompany =
  (registry: CompanyRegistry) =>
  async ({ cnpj, requesterName }: { cnpj: string; requesterName?: string }): Promise<CompanyLookup> => {
    const digits = cnpj.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    if (digits.length !== 14) return { ok: false, reason: 'cnpj incompleto' }
    const result = await registry.find(digits)
    if (!result.ok) return result
    return {
      ok: true,
      company: result.company,
      requesterInQsa: requesterName ? isNameInQsa(requesterName, result.partners) : null,
    }
  }
```

```ts
// src/server/company-lookup/adapters/brasilapi-company-registry.ts
import { normalizeCnae } from '../domain/company'
import type { CompanyRegistry } from '../ports/company-registry'

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

interface BrasilApiCompany {
  razao_social?: string
  nome_fantasia?: string
  descricao_situacao_cadastral?: string
  opcao_pelo_simples?: boolean | null
  opcao_pelo_mei?: boolean | null
  data_inicio_atividade?: string
  cnae_fiscal?: number | string
  cnae_fiscal_descricao?: string
  cnaes_secundarios?: { codigo?: number | string }[]
  uf?: string
  municipio?: string
  qsa?: { nome_socio?: string }[]
}

export function createBrasilApiCompanyRegistry({ fetch, timeoutMs }: { fetch: Fetch; timeoutMs: number }): CompanyRegistry {
  return {
    async find(cnpjDigits) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`, {
          headers: { 'User-Agent': 'Auster-Portal-Diagnostico/1.0' },
          signal: controller.signal,
        })
        if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` }
        const data = (await response.json()) as BrasilApiCompany
        const status = data.descricao_situacao_cadastral ?? ''
        return {
          ok: true,
          company: {
            legalName: data.razao_social ?? '',
            tradeName: data.nome_fantasia ?? '',
            registrationStatus: status,
            active: status.toUpperCase() === 'ATIVA',
            simplesOptant: data.opcao_pelo_simples ?? null,
            meiOptant: data.opcao_pelo_mei ?? null,
            activityStart: data.data_inicio_atividade ?? null,
            mainCnae: normalizeCnae(data.cnae_fiscal),
            mainCnaeDescription: data.cnae_fiscal_descricao ?? '',
            secondaryCnaes: (data.cnaes_secundarios ?? []).map((c) => normalizeCnae(c.codigo)).filter((c): c is string => c !== null),
            state: data.uf ?? '',
            city: data.municipio ?? '',
          },
          partners: (data.qsa ?? []).map((partner) => ({ name: partner.nome_socio ?? '' })),
        }
      } catch (error) {
        return { ok: false, reason: error instanceof DOMException && error.name === 'AbortError' ? 'tempo esgotado' : 'indisponível' }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
```

Confira os campos de `CompanyData` contra `dados` em `legacy/src/consulta_cnpj.js` (o `ativa` do antigo usa a mesma comparação? use exatamente a do antigo). O teste do adaptador trava o formato.

```ts
// src/server/company-lookup/composition.ts
import { createBrasilApiCompanyRegistry } from './adapters/brasilapi-company-registry'
import { makeLookupCompany } from './application/lookup-company'

export const lookupCompany = makeLookupCompany(createBrasilApiCompanyRegistry({ fetch: globalThis.fetch, timeoutMs: 4000 }))
export type { CompanyLookup } from './application/lookup-company'
```

- [ ] **Step 4:** Run `pnpm vitest run src/server/company-lookup`. Expected: PASS.
- [ ] **Step 5: Commit e merge** (`feat/company-lookup`, `feat(cnpj): consulta cadastral pelo servidor, sem expor o QSA`).

---

### Task 17: Redirecionamentos antigos, cabeçalhos de segurança e `/health`

**Files:**
- Create: `src/app/legacy-redirects.ts`, `src/app/legacy-redirects.test.ts`, `src/start.ts`, `src/server/health/ports/migration-status.ts`, `src/server/health/application/get-health.ts`, `src/server/health/application/get-health.test.ts`, `src/server/health/adapters/prisma-migration-status.ts`, `src/server/health/composition.ts`, `src/app/routes/health.ts`

**Interfaces:**
- Produces: `resolveLegacyRedirect(url: URL): string | null`; `getHealth(): Promise<{ ok: boolean; now: string; appliedMigration: string | null; expectedMigration: string | null }>`; rota `GET /health` (200 se `ok`, 503 se não).

- [ ] **Step 1: Teste dos redirecionamentos que falha**

```ts
// src/app/legacy-redirects.test.ts
import { describe, expect, it } from 'vitest'
import { resolveLegacyRedirect } from './legacy-redirects'

const resolve = (path: string) => resolveLegacyRedirect(new URL(path, 'https://hml-reforma.austercontabil.com.br'))

describe('legacy redirects', () => {
  it.each([
    ['/?c=ABC123', '/diagnosis?invite=ABC123'],
    ['/diagnostico-simples', '/diagnosis'],
    ['/diagn%C3%B3stico-simples?c=X', '/diagnosis?invite=X'],
    ['/index.html', '/'],
    ['/principal', '/'],
    ['/Principal', '/'],
    ['/adesao?c=TOK', '/adhesion?invite=TOK'],
    ['/adesao', '/adhesion'],
    ['/eventos', '/events'],
    ['/eventos/encontro-outubro', '/events/encontro-outubro'],
    ['/entrar', '/login'],
    ['/sair', '/logout'],
    ['/saude', '/health'],
    ['/backoffice/relatorio?id=42', '/backoffice/responses/42/report'],
    ['/backoffice/termo?id=7', '/backoffice/adhesions/7/term'],
    ['/diagnostico-simples?c=A&utm_source=wpp', '/diagnosis?utm_source=wpp&invite=A'],
  ])('%s -> %s', (from, to) => expect(resolve(from)).toBe(to))

  it.each(['/', '/diagnosis', '/events/x', '/backoffice', '/health', '/%zz'])('leaves %s alone', (path) =>
    expect(resolve(path)).toBeNull(),
  )
})
```

- [ ] **Step 2:** Run `pnpm vitest run src/app/legacy-redirects.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar**

```ts
// src/app/legacy-redirects.ts
const STATIC_PATHS: Record<string, string> = {
  '/index.html': '/',
  '/principal': '/',
  '/diagnostico-simples': '/diagnosis',
  '/diagnóstico-simples': '/diagnosis',
  '/adesao': '/adhesion',
  '/eventos': '/events',
  '/entrar': '/login',
  '/sair': '/logout',
  '/saude': '/health',
}

function withInvite(target: string, search: URLSearchParams): string {
  const params = new URLSearchParams(search)
  const invite = params.get('c')
  params.delete('c')
  if (invite) params.set('invite', invite)
  const query = params.toString()
  return query ? `${target}?${query}` : target
}

export function resolveLegacyRedirect(url: URL): string | null {
  let path: string
  try {
    path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/'
  } catch {
    return null
  }
  const lower = path.toLowerCase()
  if (path === '/' && url.searchParams.has('c')) return withInvite('/diagnosis', url.searchParams)
  if (STATIC_PATHS[lower]) return withInvite(STATIC_PATHS[lower], url.searchParams)
  if (lower.startsWith('/eventos/')) return `/events/${encodeURIComponent(path.slice('/eventos/'.length))}`
  const id = url.searchParams.get('id')
  if (lower === '/backoffice/relatorio' && id && /^\d+$/.test(id)) return `/backoffice/responses/${id}/report`
  if (lower === '/backoffice/termo' && id && /^\d+$/.test(id)) return `/backoffice/adhesions/${id}/term`
  return null
}
```

Os redirecionamentos de `/imagens/*` ficam para a etapa 5, junto com a migração do conteúdo dos eventos que usa esses endereços.

```ts
// src/start.ts
import { createMiddleware, createStart } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { resolveLegacyRedirect } from './app/legacy-redirects'

const legacyRedirects = createMiddleware({ type: 'request' }).server(async ({ request, next }) => {
  const target = resolveLegacyRedirect(new URL(request.url))
  if (target) throw redirect({ href: target, statusCode: 301 })
  return next()
})

const securityHeaders = createMiddleware({ type: 'request' }).server(async ({ next }) => {
  setResponseHeaders(
    new Headers({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    }),
  )
  return next()
})

export const startInstance = createStart(() => ({ requestMiddleware: [legacyRedirects, securityHeaders] }))
```

O `'unsafe-inline'` em `script-src` cobre o script de hidratação que o Start injeta no HTML. Endurecer com nonce é trabalho separado. Se `setResponseHeaders` não aceitar `Headers`, passe um objeto simples. Se o `throw redirect` num middleware de requisição não virar 301, devolva `new Response(null, { status: 301, headers: { Location: target } })`.

- [ ] **Step 4: Saúde (teste que falha, depois implementação)**

```ts
// src/server/health/application/get-health.test.ts
import { describe, expect, it } from 'vitest'
import { makeGetHealth } from './get-health'

describe('getHealth', () => {
  it('is ok when the applied migration is the expected one', async () => {
    const health = await makeGetHealth({ applied: async () => '20261001_init', expected: async () => '20261001_init' })()
    expect(health).toMatchObject({ ok: true, appliedMigration: '20261001_init', expectedMigration: '20261001_init' })
  })
  it('is not ok when they differ or the database is down', async () => {
    expect((await makeGetHealth({ applied: async () => 'a', expected: async () => 'b' })()).ok).toBe(false)
    const down = await makeGetHealth({ applied: async () => { throw new Error('down') }, expected: async () => 'b' })()
    expect(down).toMatchObject({ ok: false, appliedMigration: null })
  })
})
```

```ts
// src/server/health/ports/migration-status.ts
export interface MigrationStatus {
  applied(): Promise<string | null>
  expected(): Promise<string | null>
}
```

```ts
// src/server/health/application/get-health.ts
import type { MigrationStatus } from '../ports/migration-status'

export const makeGetHealth = (status: MigrationStatus) => async () => {
  const expectedMigration = await status.expected()
  const appliedMigration = await status.applied().catch(() => null)
  return {
    ok: appliedMigration !== null && appliedMigration === expectedMigration,
    now: new Date().toISOString(),
    appliedMigration,
    expectedMigration,
  }
}
```

```ts
// src/server/health/adapters/prisma-migration-status.ts
import { readdir } from 'node:fs/promises'
import { prisma } from '@/server/shared/prisma/client'
import type { MigrationStatus } from '../ports/migration-status'

export const prismaMigrationStatus: MigrationStatus = {
  async applied() {
    const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name DESC LIMIT 1`
    return rows[0]?.migration_name ?? null
  },
  async expected() {
    const entries = await readdir('prisma/migrations', { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort().at(-1) ?? null
  },
}
```

```ts
// src/server/health/composition.ts
import { prismaMigrationStatus } from './adapters/prisma-migration-status'
import { makeGetHealth } from './application/get-health'

export const getHealth = makeGetHealth(prismaMigrationStatus)
```

```ts
// src/app/routes/health.ts
import { createFileRoute } from '@tanstack/react-router'
import { getHealth } from '@/server/health/composition'

export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: async () => {
        const health = await getHealth()
        return Response.json(health, { status: health.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
      },
    },
  },
})
```

- [ ] **Step 5: Verificar**

Run: `pnpm vitest run src/app/legacy-redirects.test.ts src/server/health`. Expected: PASS.

Run: `pnpm dev`, depois `curl -si "http://localhost:3000/?c=ABC" | head -5` e `curl -s http://localhost:3000/health`
Expected: `301` com `location: /diagnosis?invite=ABC`; `{"ok":true,…}` com as duas migrações iguais; `curl -sI http://localhost:3000/` mostra `x-content-type-options: nosniff` e o `content-security-policy`.

- [ ] **Step 6: Commit e merge** (`feat/redirects-health`, `feat(rotas): 301 dos endereços antigos, cabeçalhos de segurança e /health`).

---

### Task 18: Varreduras

**Files:**
- Create: `scripts/sweep.ts`, `scripts/sweep-weighted.ts`

**Interfaces:**
- Consumes: `diagnose`, `buildActionPlan`, `QUESTIONS`, `visibleQuestions`, `THRESHOLDS`, `APPLY_DENSITY_TEST_ON_HIGH_BRANCH`.

- [ ] **Step 1:** Porte `legacy/varredura.mjs` → `scripts/sweep.ts` e `legacy/varredura_pesos.mjs` → `scripts/sweep-weighted.ts`, com o mesmo argumento `N`, as mesmas sementes (`20260914`), a mesma data de referência e a mesma saída impressa (os rótulos do relatório no terminal ficam em português, é texto para gente). Os `PESOS` e `PESO_MATRIZ` são dados: mantenha as chaves (valores de opção). A guarda que aborta com peso para opção inexistente fica.
- [ ] **Step 2: Verificar a igualdade**

Run: `node legacy/varredura.mjs 20000 > before.txt; pnpm -s sweep 20000 > after.txt; diff before.txt after.txt`
Expected: sem diferença, exceto nos nomes de constante impressos (`CORTES` → `THRESHOLDS`). Repita com `varredura_pesos.mjs` / `sweep:weighted`. Apague `before.txt` e `after.txt`.

- [ ] **Step 3: Commit e merge** (`feat/sweeps`, `feat(diagnostico): varreduras de distribuição em TS`).

---

### Task 19: Imagem e compose de deploy

**Files:**
- Create: `server.ts`, `Dockerfile`, `.dockerignore`, `dokploy-compose.yml`

**Interfaces:**
- Produces: imagem que sobe em `:3000`, aplica as migrações e serve o app; compose de deploy nas redes `dokploy-network`, `shared-postgres` e `shared-minio`.

- [ ] **Step 1: Servidor de produção**

```ts
// server.ts
import { serve } from 'srvx'
import { serveStatic } from 'srvx/static'
// @ts-expect-error saída do build
import app from './dist/server/server.js'

serve({
  port: Number(process.env.PORT ?? 3000),
  hostname: '0.0.0.0',
  middleware: [serveStatic({ dir: 'dist/client' })],
  fetch: app.fetch,
})
```

Run: `pnpm build && pnpm start` e `curl -s http://localhost:3000/health`
Expected: `{"ok":true,…}`. Se o `srvx/static` tiver outra assinatura nesta versão, veja `node_modules/srvx/dist/static.d.mts`; se o build não gerar `dist/server/server.js`, o caminho certo aparece no log do `vite build`.

- [ ] **Step 2: `Dockerfile`**

```dockerfile
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH TZ=America/Sao_Paulo
RUN corepack enable && apk add --no-cache tzdata
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod --ignore-scripts

FROM base AS runtime
ENV NODE_ENV=production PORT=3000
COPY --from=build --chown=node:node /app/package.json /app/prisma.config.ts /app/server.ts ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/tsconfig.json ./
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/scripts ./scripts
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node --experimental-strip-types server.ts"]
```

O `prisma` precisa estar em `dependencies` (não em `devDependencies`) para sobreviver ao `pnpm prune --prod`: mova com `pnpm remove -D prisma && pnpm add prisma@7.10.0`.

```
# .dockerignore
node_modules
dist
.output
.env
.env.local
legacy
docs
*.log
.git
```

- [ ] **Step 3: `dokploy-compose.yml`**

```yaml
services:
  app:
    build: .
    image: forms-victor-app:latest
    pull_policy: build
    restart: unless-stopped
    expose:
      - '3000'
    environment:
      NODE_ENV: production
      PORT: '3000'
      TZ: America/Sao_Paulo
      DATABASE_URL: ${DATABASE_URL:?defina no painel}
      S3_ENDPOINT: ${S3_ENDPOINT:-minio:9000}
      S3_USE_SSL: 'false'
      S3_BUCKET: ${S3_BUCKET:?defina no painel}
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:?defina no painel}
      S3_SECRET_KEY: ${S3_SECRET_KEY:?defina no painel}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET:?defina no painel}
      BETTER_AUTH_URL: ${BETTER_AUTH_URL:?defina no painel}
      APP_PUBLIC_URL: ${APP_PUBLIC_URL:?defina no painel}
      ADHESION_WINDOW_END: ${ADHESION_WINDOW_END:-2026-09-30}
      BOOTSTRAP_ADMIN_USERNAME: ${BOOTSTRAP_ADMIN_USERNAME:-}
      BOOTSTRAP_ADMIN_PASSWORD: ${BOOTSTRAP_ADMIN_PASSWORD:-}
    networks:
      - dokploy-network
      - shared-postgres
      - shared-minio

networks:
  dokploy-network:
    external: true
  shared-postgres:
    external: true
  shared-minio:
    external: true
```

Sem `ports:`, sem `volumes:` e sem label de Traefik: o domínio é cadastrado na aba *Domains*.

- [ ] **Step 4: Verificar a imagem**

Run (Docker Desktop aberto, `pnpm db:up` de pé):

```bash
docker build -t forms-victor-app:local .
docker run --rm -p 3001:3000 --env-file .env -e DATABASE_URL=postgresql://app:app@host.docker.internal:5432/forms_victor_dev -e S3_ENDPOINT=host.docker.internal:9000 forms-victor-app:local
```

Em outro terminal: `curl -s http://localhost:3001/health`
Expected: o log mostra `No pending migrations to apply` e depois o servidor ouvindo; o `/health` responde `{"ok":true,…}`; `http://localhost:3001/login` renderiza a tela.

- [ ] **Step 5: Commit e merge** (`feat/deploy-image`, `feat(deploy): imagem de produção e compose do Dokploy`).

---

### Task 20: Remover o código antigo

**Files:**
- Delete: `legacy/`
- Delete: `src/server/shared/domain/validation.test.ts`, `src/server/diagnosis/domain/questions.test.ts`, `src/server/diagnosis/domain/diagnose.parity.test.ts`, `src/server/diagnosis/domain/action-plan.parity.test.ts`, `src/server/company-lookup/domain/company.test.ts` (paridade; o que não depende do antigo sobrevive, ver Step 1)
- Modify: `src/server/adhesion/domain/term.test.ts`, `tsconfig.json`, `eslint.config.js`, `.dockerignore`

- [ ] **Step 1: Congelar o que ainda vale sem o antigo**

- `term.test.ts`: troque a comparação com `legacy/src/termo.js` pelo hash literal. Antes de apagar, rode `node -e "import('./legacy/src/termo.js').then(({TERMO})=>console.log(require('node:crypto').createHash('sha256').update(JSON.stringify(TERMO),'utf8').digest('hex')))"` e cole o valor:

```ts
const TERM_V4_HASH = '<hex de 64 caracteres impresso acima>'

it('hashes to the value stored with every existing adhesion', async () => {
  expect(await computeTermHash(TERM_V4)).toBe(TERM_V4_HASH)
})
```

- De `validation.test.ts`, mantenha só os casos sem `legacy.` (o exemplo oficial alfanumérico), com os valores esperados escritos à mão: `isValidCnpj('12.ABC.345/01DE-35') === true`, `isValidCnpj('11.111.111/1111-11') === false`, `maskPhone('34999991234') === '(34) 99999-1234'`.
- As invariantes (`diagnose.invariants.test.ts`) ficam: elas não dependem do antigo.

- [ ] **Step 2: Apagar**

```bash
git rm -r legacy
git rm src/server/diagnosis/domain/questions.test.ts src/server/diagnosis/domain/diagnose.parity.test.ts src/server/diagnosis/domain/action-plan.parity.test.ts src/server/company-lookup/domain/company.test.ts
```

Tire `legacy` de `tsconfig.json` (`exclude`), de `eslint.config.js` (`ignores`) e de `.dockerignore`.

- [ ] **Step 3: Verificar**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: tudo limpo; nenhum import restante de `legacy/` (`grep -r "legacy/" src scripts tests` não acha nada).

- [ ] **Step 4: Commit e merge** (`chore/remove-legacy`, `chore(base): remove o código antigo depois da paridade comprovada`).

---

### Task I-1 [INFRA]: MinIO na rede `shared-minio`, fora da internet

Sessão separada, MCP `dokploy-vps`. Compose `minio` do projeto *Shared Services* (`composeId: VKid505yVO6c4fSHBShwD`).

- [ ] **Step 1: Ler o estado atual:** `compose-one` com o `composeId` e `domain-byComposeId`. Anote o `composeFile` e os dois domínios (`s3.austercontabil.com.br:9000`, `minio.austercontabil.com.br:9001`).
- [ ] **Step 2: Novo compose** via `compose-update` com o `composeFile`:

```yaml
services:
  minio:
    image: pgsty/minio:RELEASE.2026-06-18T00-00-00Z
    restart: unless-stopped
    volumes:
      - minio-data:/data
    environment:
      - MINIO_ROOT_USER=${MINIO_ROOT_USER}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
    command: server /data --console-address ":9001"
    expose:
      - 9000
    ports:
      - "127.0.0.1:9001:9001"
    networks:
      - shared-minio

volumes:
  minio-data:

networks:
  shared-minio:
    name: shared-minio
```

O nome do volume (`minio-data`) e o nome do projeto não mudam, e é isso que preserva os dados. `MINIO_BROWSER_REDIRECT_URL` sai (o console não tem mais domínio).

- [ ] **Step 3: Tirar os domínios:** `domain-delete` nos dois `domainId` do Step 1.
- [ ] **Step 4: Publicar:** `compose-deploy`; acompanhe com `deployment-allByCompose` até `done`, e leia o log com `deployment-readLogs`.
- [ ] **Step 5: Conferir**
  - De fora: `curl -s -o /dev/null -w "%{http_code}" https://s3.austercontabil.com.br/minio/health/live` não responde 200 (404 do Traefik ou falha de certificado).
  - O volume continua com os objetos: o bucket `dokploy-bucket` segue existindo (confira pelo console via `ssh -L 9001:127.0.0.1:9001 auster@86.48.5.53`, feito pelo usuário).
- [ ] **Step 6:** Avise o usuário para apagar os registros `s3` e `minio` na Cloudflare.

### Task I-2 [INFRA]: Bancos e buckets de homologação e produção

- [ ] **Step 1: Compose temporário de provisionamento** no projeto *Shared Services*, via `compose-create` + `compose-update`, com variáveis definidas por `compose-saveEnvironment` (as senhas são geradas na hora com 32 caracteres aleatórios e **entregues ao usuário para o Vaultwarden**, nunca gravadas no repositório):

```yaml
services:
  provision-postgres:
    image: postgres:17
    restart: "no"
    environment:
      PGHOST: postgres
      PGUSER: ${POSTGRES_ADMIN_USER}
      PGPASSWORD: ${POSTGRES_ADMIN_PASSWORD}
      HML_PASSWORD: ${HML_DB_PASSWORD}
      PROD_PASSWORD: ${PROD_DB_PASSWORD}
    entrypoint: ["sh", "-c"]
    command:
      - |
        psql -v ON_ERROR_STOP=1 -d postgres \
          -c "CREATE ROLE forms_victor_hml LOGIN PASSWORD '$$HML_PASSWORD'" \
          -c "CREATE DATABASE forms_victor_hml OWNER forms_victor_hml" \
          -c "CREATE ROLE forms_victor LOGIN PASSWORD '$$PROD_PASSWORD'" \
          -c "CREATE DATABASE forms_victor OWNER forms_victor" \
          -c "REVOKE ALL ON DATABASE forms_victor_hml FROM PUBLIC" \
          -c "REVOKE ALL ON DATABASE forms_victor FROM PUBLIC"
    networks: [shared-postgres]
  provision-minio:
    image: minio/mc:latest
    restart: "no"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
      HML_S3_SECRET: ${HML_S3_SECRET}
      PROD_S3_SECRET: ${PROD_S3_SECRET}
    entrypoint: ["sh", "-c"]
    command:
      - |
        set -e
        mc alias set local http://minio:9000 "$$MINIO_ROOT_USER" "$$MINIO_ROOT_PASSWORD"
        for env in hml prod; do
          bucket=$$( [ "$$env" = hml ] && echo forms-victor-hml || echo forms-victor )
          secret=$$( [ "$$env" = hml ] && echo "$$HML_S3_SECRET" || echo "$$PROD_S3_SECRET" )
          mc mb --ignore-existing local/$$bucket
          printf '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:ListBucket","s3:GetBucketLocation"],"Resource":["arn:aws:s3:::%s","arn:aws:s3:::%s/*"]}]}' $$bucket $$bucket > /tmp/policy.json
          mc admin policy create local $$bucket-rw /tmp/policy.json || true
          mc admin user add local $$bucket "$$secret"
          mc admin policy attach local $$bucket-rw --user $$bucket || true
        done
    networks: [shared-minio]
networks:
  shared-postgres:
    external: true
  shared-minio:
    external: true
```

- [ ] **Step 2:** `compose-deploy`; leia os logs dos dois serviços (`compose-readLogs`) e confira `CREATE DATABASE` ×2 e `Added user` ×2.
- [ ] **Step 3:** `compose-delete` do compose temporário (o log com senha não pode ficar).
- [ ] **Step 4:** Entregue ao usuário, para o cofre: senha de `forms_victor_hml`, de `forms_victor`, e os segredos S3 de `forms-victor-hml` e `forms-victor`.

### Task I-3 [INFRA]: Compose "hml"

- [ ] **Step 1:** `compose-create` no projeto *Forms Victor* (`58t786pq2rawvm3xcUpJo`), ambiente `production`, nome `hml`, no servidor `VPS Contabo` (`6nT1mQRDAo48Eqdc53CUr`).
- [ ] **Step 2:** `compose-saveGithubProvider` (ou o equivalente que o compose "frontend" usa; leia com `compose-one` do `eVnxXHD0N71sYlndkYkEG`): mesmo repositório `forms-victor`, branch `main`, `composePath: ./dokploy-compose.yml`, `autoDeploy: true`.
- [ ] **Step 3:** `compose-saveEnvironment`:

```
DATABASE_URL=postgresql://forms_victor_hml:<senha I-2>@postgres:5432/forms_victor_hml
S3_ENDPOINT=minio:9000
S3_BUCKET=forms-victor-hml
S3_ACCESS_KEY=forms-victor-hml
S3_SECRET_KEY=<segredo I-2>
BETTER_AUTH_SECRET=<64 caracteres aleatórios, gerados agora>
BETTER_AUTH_URL=https://hml-reforma.austercontabil.com.br
APP_PUBLIC_URL=https://hml-reforma.austercontabil.com.br
ADHESION_WINDOW_END=2026-09-30
BOOTSTRAP_ADMIN_USERNAME=<definido pelo usuário>
BOOTSTRAP_ADMIN_PASSWORD=<definido pelo usuário>
```

- [ ] **Step 4:** `domain-create`: host `hml-reforma.austercontabil.com.br`, `path /`, `port 3000`, `serviceName app`, `https: true`, `certificateType: letsencrypt`.
- [ ] **Step 5:** Confirme com o usuário que o registro A `hml-reforma → 86.48.5.53` já existe na Cloudflare (sem ele o Let's Encrypt falha).

### Task I-4 [INFRA]: Congelar o compose antigo

- [ ] **Step 1:** `compose-update` do `eVnxXHD0N71sYlndkYkEG` ("frontend") com `autoDeploy: false`. Não disparar deploy.
- [ ] **Step 2:** `compose-one` e confira `autoDeploy: false` e `composeStatus: done`; `curl -s https://reforma-tributaria.austercontabil.com.br/saude` responde `{"ok":true,…}` (o portal antigo segue no ar).

**Só depois desta tarefa o push na `main` está liberado.**

---

### Task 21: Primeiro push e homologação no ar

- [ ] **Step 1:** Confirme que I-1 a I-4 estão feitas (pergunte ao usuário se foram em outra sessão).
- [ ] **Step 2:** `git push origin main`
- [ ] **Step 3:** Pelo MCP `dokploy-vps`, acompanhe o deploy do compose "hml" (`deployment-allByCompose` até `done`, e `deployment-readLogs`). Os erros esperados de primeira viagem estão na wiki da casa: compose sem `pull_policy: build` (não é o caso aqui), CRLF em `.sh` (não há `.sh`), variável faltando (o Zod aponta qual).
- [ ] **Step 4:** Rodar o bootstrap no container, pelo terminal do Dokploy (feito pelo usuário): `node_modules/.bin/tsx scripts/bootstrap-admin.ts`. Depois, o usuário apaga `BOOTSTRAP_ADMIN_*` do painel e o compose é redeployado.
- [ ] **Step 5:** Rodar o seed no container, pelo terminal (usuário): `node_modules/.bin/tsx prisma/seed.ts` (as fotos vêm em `prisma/seed-assets`, copiado com `prisma/`).
- [ ] **Step 6: Critério de pronto da spec**
  1. `curl -s https://hml-reforma.austercontabil.com.br/health` → `{"ok":true,…}` com as migrações iguais.
  2. `https://s3.austercontabil.com.br` não serve o MinIO.
  3. `/login` entra com o admin; `/backoffice` sem sessão manda para `/login`; um login errado aparece em `audit_logs` (`action = access_denied`).
  4. `select count(*) from stored_files where kind = 'house_photo'` = 6 e `GET /files/<id>` de uma delas devolve a foto.
  5. `pnpm test` limpo na `main` (invariantes incluídas).
  6. `curl -si https://hml-reforma.austercontabil.com.br/?c=ABC` → `301` para `/diagnosis?invite=ABC`.
  7. `https://reforma-tributaria.austercontabil.com.br/saude` segue respondendo pelo portal antigo, com `autoDeploy: false`.
