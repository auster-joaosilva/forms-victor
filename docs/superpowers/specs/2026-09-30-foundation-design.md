# Etapa 0 — Fundação da reescrita

Data: 2026-09-30 · Status: aprovado em conversa, aguardando revisão da spec escrita

## Contexto

O portal atual é Node sem dependência (`node:http` + `node:sqlite`), com HTML
montado no build e estado injetado em `window.__X__`. Ele entrega cinco partes:
diagnóstico (formulário de 5 etapas, motor, relatório de 6 folhas), adesão
(termo V4 com prova por SHA-256), eventos (CMS com inscrição por sessão), capa
institucional e backoffice (respostas, adesões, eventos, convites, auditoria,
usuários). Está em produção em `reforma-tributaria.austercontabil.com.br`, na
VPS Contabo, com deploy automático da `main`.

A reescrita troca a stack por TanStack Start + Prisma/PostgreSQL + MinIO +
better-auth, no padrão bullet-proof no front e hexagonal no back, sem guardar
nada no navegador nem em disco.

## Decomposição

Cada etapa tem spec, plano e implementação próprios.

| Etapa | Escopo |
|---|---|
| **0. Fundação** (esta spec) | Infra da VPS, esqueleto, schema completo, auth, MinIO, motor portado com testes, Docker, `AGENTS.md`/`CLAUDE.md`, homologação no ar |
| 1. Diagnóstico | Formulário, revisão, resultado, relatório, rascunho no banco, convite |
| 2. Adesão | Termo, recibo, documento impresso, janela |
| 3. Eventos e capa | Páginas públicas, inscrição, fotos no MinIO |
| 4. Backoffice | As seis áreas, CSVs, reimpressões |
| 5. Migração e virada | SQLite → Postgres, senhas novas, backup, troca de domínio |

## Decisões

| # | Decisão |
|---|---|
| D1 | Identificadores em inglês (funções, variáveis, tipos, arquivos, rotas, tabelas, colunas, valores de enum). Texto de tela em português. Chaves e valores das perguntas (`receitaPorCliente`, `nao_sei`) e o objeto do termo V4 continuam como estão: são dado de domínio, gravado no `payload` e, no caso do termo, base do hash da prova |
| D2 | Convivência com produção: o compose atual "frontend" fica **congelado** (`autoDeploy` desligado, imagem de hoje). Um compose novo "hml" publica a `main` em `hml-reforma.austercontabil.com.br`. Na virada, o domínio de produção passa para ele |
| D3 | Login por usuário e senha com better-auth (`username` + `admin`). Sem cadastro público, sem senha de implantação; bootstrap por comando |
| D4 | Backend em `src/server/<módulo>` hexagonal; front em `src/app` + `src/features` bullet-proof |
| D5 | Componentes do shadcn/ui restilizados com os tokens Auster, o mais perto possível do visual atual |
| D6 | URLs em inglês; endereços antigos respondem 301 com a query preservada |
| D7 | Toda a infra (VPS, Postgres, MinIO, composes) é feita pelo MCP `dokploy-vps`, em sessão separada |

## 1. Stack e estrutura

- TanStack Start (React 19, SSR, rotas por arquivo), TanStack Router,
  TanStack Query. Transporte por server functions (`createServerFn`) com
  entrada validada por Zod.
- Prisma ORM + PostgreSQL; MinIO via `@aws-sdk/client-s3`.
- better-auth sobre Prisma.
- Tailwind v4 + shadcn/ui, fonte Kanit.
- TypeScript `strict`, pnpm, Vitest, ESLint com `eslint-plugin-boundaries`,
  Prettier.

```
src/
  app/              rotas, providers, router
  features/<nome>/  api/ (server functions + hooks do Query), components/, hooks/, types/
  components/ lib/ hooks/ config/ testing/
  server/<módulo>/  domain/ application/ ports/ adapters/ composition.ts
  server/shared/    prisma, env, auth
```

Módulos do servidor: `diagnosis`, `adhesion`, `events`, `invitations`,
`identity`, `audit`, `storage`, `company-lookup`, `rate-limit`.

Fronteiras, travadas por lint:

- `app` e `features` alcançam o servidor só pelas server functions de
  `features/*/api`, que chamam `server/*/application`.
- `domain` não importa nada fora de si.
- `adapters` implementa `ports` e só é ligado em `composition.ts`.
- Sem import cruzado entre features.
- Exceção única: `server/diagnosis/domain` é isomórfico (TS puro) e pode ser
  importado pelo front, para o resultado aparecer sem ida ao servidor. Na
  gravação, o servidor **recalcula** o diagnóstico e ignora o que o navegador
  mandou.

## 2. Rotas

| Hoje | Novo |
|---|---|
| `/` (diagnóstico), `/principal` | `/` (capa) |
| `/?c=TOKEN` | 301 → `/diagnosis?invite=TOKEN` |
| `/diagnostico-simples`, `/diagnóstico-simples` | `/diagnosis` |
| `/adesao?c=TOKEN` | `/adhesion?invite=TOKEN` |
| `/eventos`, `/eventos/:apelido` | `/events`, `/events/:slug` |
| `/entrar`, `/sair` | `/login`, `/logout` |
| `/backoffice`, `/backoffice/relatorio?id=`, `/backoffice/termo?id=` | `/backoffice`, `/backoffice/responses/:id/report`, `/backoffice/adhesions/:id/term` |
| `/imagens/:arquivo` | `/files/:id` (lido do MinIO pelo app) |
| `/saude` | `/health` |

A fundação entrega as rotas `/health`, `/login`, `/logout`, o `beforeLoad` de
`/backoffice` e a camada de redirecionamento. As telas ficam para as etapas
seguintes.

## 3. Modelo de dados

Modelos e colunas em inglês (`@@map` em snake_case), datas `timestamptz`,
"hoje" calculado em `America/Sao_Paulo`. `payload` guarda o JSON como veio.

| Modelo | Origem | Campos-chave |
|---|---|---|
| `User`, `Session`, `Account`, `Verification` | better-auth | `username` único, `name`, `role` (`admin`/`team`), `banned`, `lastLoginAt` |
| `Invitation` | `convites` | `token` PK (alfabeto sem I/O/0/1), `companyName`, `cnpj`, `email`, `note`, `openCount`, `lastOpenedAt`, `createdById` |
| `DiagnosisDraft` | localStorage | `id` uuid, `step`, `payload`, `updatedAt`, `expiresAt` (7 dias) |
| `Response` | `respostas` | `protocol` único gerado no servidor (`DS-AAMMDD-XXXX`), `invitationToken?`, projeções (`companyName`, `cnpj`, `cnpjDigits`, `requester`, `email`, `phone`, `formVersion`, `outcome`, `position`, `certainty`, `urgency`, `confidence`, `requesterInQsa`), `payload`, `status` (`new`/`in_review`/`validated`/`discarded`), `internalNote`, `handledById`, `handledAt` |
| `Adhesion` | `adesoes` | `protocol`, `responseId?`, `invitationToken?`, empresa e representante, `modality` (`standard`/`hybrid`), `withoutManifestation?` (`cancel`/`keep`), `wantsProposal`, `termVersion`, `termHash`, `acceptedAt`, `originIp`, `originSource`, `forwardedChain`, `userAgent`, `payload`, `status` (`received`/`filed`/`cancelled`), `internalNote`, `handledById`, `handledAt` |
| `Event` | `agenda` | `slug` único, `title`, `status` (`draft`/`published`/`closed`), `registrations` (`open`/`closed`), `content` JSON com referência a `StoredFile`, nunca base64 |
| `EventSession` | `agenda_sessoes` | `eventId`, `order`, `date` (date), `time`, `format` (`in_person`/`online`), `title`, `description`, `location`, `seats?` |
| `Registration` | `inscricoes` | `protocol`, `eventId`, `sessionId`, `responseId?`, contato, `privacyConsent`, origem, `status` (`registered`/`confirmed`/`present`/`absent`/`cancelled`); índice único parcial em (`sessionId`, e-mail em minúsculas) fora de `cancelled` |
| `StoredFile` | fotos e uploads | `bucket`, `key`, `contentType`, `size`, `sha256`, `kind` (`house_photo`/`event_cover`/`speaker_photo`), `createdById` |
| `AuditLog` | `eventos` | `occurredAt`, `actorId?`, `actorUsername` (cópia), `action`, `reference`, `detail` JSON; só inserção |
| `RateLimitHit` | Map em memória | `key` (rota + IP), `windowStart`, `count`; janelas de minuto e hora |

Regras:

- `prisma migrate deploy` roda na subida; `/health` compara a migração
  aplicada com a esperada.
- Vaga de inscrição conferida e gravada na mesma transação.
- Trava do último admin no caso de uso.
- CSV com `;` e BOM (entregue na etapa 4).
- Logos e favicon são assets do bundle. As seis fotos da casa entram por seed
  como `StoredFile` `house_photo`.

## 4. Autenticação e segurança

- better-auth com `username` e `admin`; cadastro público desligado. O `User`
  recebe e-mail sintético `<usuario>@users.invalid`, nunca exibido.
- Sessão no Postgres, cookie `httpOnly`, `SameSite=Lax`, `Secure` em HTTPS,
  12 h. Banir derruba as sessões na hora; trocar senha invalida as sessões da
  pessoa.
- Senha mínima de 12 caracteres, scrypt do better-auth. Hash antigo
  incompatível: senha nova para cada usuário na etapa 5.
- Rate limit de login nativo, `storage: "database"`.
- `/api/auth/admin/*` recusado para chamada direta por hook `before`. Gestão
  de usuário só por `server/identity/application`, que aplica trava do último
  admin, "equipe só troca a própria senha" e auditoria (`user_created`,
  `user_updated`, `access_denied`).
- `requireSession()` e `requireRole('admin')` nas server functions;
  `beforeLoad` de `/backoffice/*` manda para `/login`.
- `pnpm auth:bootstrap-admin` cria ou reativa e promove um admin a partir de
  `BOOTSTRAP_ADMIN_USERNAME` e `BOOTSTRAP_ADMIN_PASSWORD`, com auditoria.
- Mantidos: ordem de apuração do IP (`CF-Connecting-IP` → `X-Real-IP` →
  primeiro salto do `X-Forwarded-For` → socket) com a fonte e a cadeia
  gravadas; limite de corpo de 256 KB; rate limit das escritas públicas no
  banco; `noindex`, `X-Content-Type-Options`, `Referrer-Policy`, CSP.
- Consulta de CNPJ pelo servidor (`server/company-lookup`), timeout de 4 s,
  nunca bloqueia; QSA usado só para `requesterInQsa`, nunca exibido nem
  gravado.
- Rascunho: cookie `httpOnly` `draft_id` que só aponta para a linha no banco.

## 5. Infraestrutura (via MCP `dokploy-vps`, em sessão separada)

1. MinIO: declarar a rede `shared-minio` (`name: shared-minio`) no compose,
   apagar os domínios `s3.` e `minio.`, publicar o console só em
   `127.0.0.1:9001`, redeploy. Conferir que a API não responde de fora e
   responde em `minio:9000` pela rede.
2. Postgres: bancos `forms_victor_hml` e `forms_victor`, cada um com usuário
   dono só do seu banco.
3. MinIO: buckets `forms-victor-hml` e `forms-victor`, cada um com usuário e
   política restritos ao bucket.
4. Compose "frontend" atual: `autoDeploy` desligado.
5. Compose "hml" no projeto Forms Victor: repositório `forms-victor`, `main`,
   `./dokploy-compose.yml`, `autoDeploy` ligado, domínio
   `hml-reforma.austercontabil.com.br` → `app:3000`, Let's Encrypt, variáveis
   no painel.

Se a API não executar SQL ou `mc`, usar compose temporário de execução única
na mesma rede e apagá-lo depois. Nada por SSH.

Com o usuário: registro A de `hml-reforma` → `86.48.5.53` na Cloudflare,
remoção dos registros `s3.` e `minio.`, cópia dos segredos para o Vaultwarden.

## 6. Repositório

- `Dockerfile` multi-stage `node:22-alpine` + pnpm; imagem final não-root,
  executa `prisma migrate deploy` e o servidor; healthcheck em `/health`.
- `dokploy-compose.yml`: `build:` + `image:` + `pull_policy: build`,
  `expose: 3000`, sem `ports:`, redes externas `dokploy-network`,
  `shared-postgres`, `shared-minio`, sem volume.
- `docker-compose.yml`: Postgres e MinIO para desenvolvimento.
- `.gitattributes` com `*.sh text eol=lf`.
- `.env.example`: `DATABASE_URL`, `S3_ENDPOINT` (host puro), `S3_BUCKET`,
  `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `APP_PUBLIC_URL`, `ADHESION_WINDOW_END`, `BOOTSTRAP_ADMIN_USERNAME`,
  `BOOTSTRAP_ADMIN_PASSWORD`. Validado por Zod na subida.
- O código antigo sai da `main`. O portal atual segue pela imagem congelada; o
  histórico guarda o resto. Risco aceito: correção urgente no portal antigo
  exigiria deploy a partir de commit antigo.
- `CLAUDE.md` com uma linha: `Leia e siga o AGENTS.md.`

## 7. `AGENTS.md`

Conteúdo obrigatório:

- Stack, estrutura e fronteiras da seção 1.
- Identificadores em inglês, texto de tela em português, chaves e valores de
  pergunta e termo como dado; termo novo é versão nova.
- Sem comentário desnecessário; comentário só para um porquê que o código não
  diz.
- Sempre bullet-proof no front e hexagonal no back.
- Nada local: proibidos `localStorage`, `sessionStorage`, IndexedDB e escrita
  em disco pelo app; estado no Postgres, arquivo no MinIO; no navegador só
  cookies `httpOnly` de identificador.
- Nenhum segredo no repositório; env validado; QSA nunca exibido nem gravado;
  hash do termo calculado pelo servidor.
- Fluxo de git: branch local `<tipo>/<assunto>` a partir da `main`; Conventional
  Commits com descrição em português, sem `Co-Authored-By`;
  `pnpm lint && pnpm typecheck && pnpm test` antes do merge;
  `git merge --no-ff` na `main` local, `git push origin main`, apagar a branch
  local; nunca enviar outra branch ao remoto.
- Push na `main` é deploy em homologação, e em produção depois da virada.
- O compose "frontend" está congelado: não disparar deploy nele.
- Testes nas três camadas da seção 8.

## 8. Testes

- `domain`: Vitest puro. As 30 invariantes de `testes.mjs` viram
  `*.invariants.test.ts` sobre 40 mil preenchimentos com semente fixa
  (`20260915`). As que dependem de tela ficam para a etapa 1.
- `application`: casos de uso com fakes das portas.
- `adapters`: contra Postgres e MinIO do `docker-compose.yml`.
- `varredura.mjs` e `varredura_pesos.mjs` viram `pnpm sweep` e
  `pnpm sweep:weighted`.
- Paridade do motor: antes de apagar o código antigo, rodar os dois motores
  sobre os mesmos 40 mil preenchimentos e exigir saída idêntica
  (`saida.codigo`, posição, confiança, gatilhos, plano). É o que prova que o
  porte não mudou nenhuma recomendação.

## Critério de pronto da fundação

1. `hml-reforma.austercontabil.com.br/health` responde com a migração em dia.
2. MinIO sem domínio público, alcançável só pela `shared-minio`.
3. `pnpm auth:bootstrap-admin` cria o admin; `/login` entra; `/backoffice`
   sem sessão manda para `/login`; o login negado aparece na auditoria.
4. Upload e leitura de um arquivo no bucket de homologação pelo adaptador.
5. As 30 invariantes e o teste de paridade passam.
6. `pnpm lint && pnpm typecheck && pnpm test` limpos, com as fronteiras
   travadas.
7. Portal atual em `reforma-tributaria.` intacto, com `autoDeploy` desligado.

## Fora do escopo

- Telas das etapas 1 a 4.
- Migração de dados e senhas (etapa 5).
- Backup: hoje não há nenhum na VPS, e o único destino é o MinIO da própria
  VPS. Tratar na etapa 5, antes da virada, com dump para o MinIO interno.
