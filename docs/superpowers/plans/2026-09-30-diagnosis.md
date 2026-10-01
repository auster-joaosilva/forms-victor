# Etapa 1 — Diagnóstico, backoffice e migração — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pôr no ar, em `hml-reforma.austercontabil.com.br` pela branch `teste`, o diagnóstico completo (formulário, conferência, resultado, envio automático e relatório de 6 folhas) com rascunho no Postgres, o backoffice de respostas, convites, usuários e auditoria, e a migração das respostas, convites, usuários e auditoria do SQLite antigo — com o conteúdo idêntico ao portal antigo.

**Architecture:** O front (`src/features/diagnosis`, `src/features/backoffice-*`) guarda as respostas em estado React e usa o `server/diagnosis/domain` (puro) para visibilidade, validação e resultado provisório. Tudo o que o servidor grava passa por server functions de `features/*/api`, que chamam `server/<módulo>/composition.ts`. O servidor relê o rascunho do banco, recalcula `diagnose` e `buildActionPlan` e nunca aceita o diagnóstico do navegador. As telas são montadas a partir de modelos de tela puros (`reviewItems`, `resultView`, `reportSheets`, `csvRows`, `answerBlocks`), cobertos pelas invariantes sobre 40 mil preenchimentos; os componentes só desenham. O CSS do antigo é portado com as variáveis trocadas pelos tokens Auster do `app.css`. A migração é um módulo hexagonal (`server/legacy-import`) chamado por `scripts/migrate-legacy.ts`, lendo o SQLite pelo `node:sqlite`.

**Tech Stack:** TanStack Start 1.168 / Router 1.170 / Query 5.104, React 19, Prisma 7.10 + PostgreSQL 17, better-auth 1.7, Tailwind 4 + shadcn (`radix-ui`), Zod 4, Vitest 5 (+ jsdom e Testing Library, novos), Playwright (novo), `node:sqlite` (Node ≥ 22.13, sem flag), TypeScript 6.0, pnpm 12.

**Spec:** `docs/superpowers/specs/2026-09-30-diagnosis-design.md`

## Global Constraints

- Identificadores em inglês: funções, variáveis, tipos, propriedades, arquivos, rotas, tabelas, colunas, valores de enum, classes CSS novas.
- Texto de tela em português.
- **Valores de domínio ficam como estão** (são dado gravado no `payload` ou prova): chaves e valores das perguntas (`receitaPorCliente`, `nao_sei`, `aceiteLgpd`, `sintetico`), ids de gatilho (`gate_simei`), códigos de saída (`A`…`ESPECIAL-MEI`), chaves de posição (`hibrido_a_confirmar`), ids de ação, níveis (`ALTA`/`MÉDIA`/`BAIXA`), `certeza` (`fechada`/`aberta`), famílias (`padrao`, `hibrido`, `a_definir`, `nao_se_aplica`) e o objeto do termo (`server/adhesion/domain/term.ts`, que esta etapa não toca). O `pacote` das respostas antigas vai para o `payload` como está.
- Sem comentário desnecessário. Comentário só para um porquê que o código não diz (regra de lei, armadilha medida). Os comentários longos do antigo viram, no máximo, uma linha.
- TypeScript `strict` (com `noUncheckedIndexedAccess`), sem `any`. `import type` para tipos (`verbatimModuleSyntax`).
- **Nada local:** proibidos `localStorage`, `sessionStorage`, IndexedDB e escrita em disco pelo app. Estado no Postgres. No navegador, só cookies `httpOnly` de identificador (`draft_id`, sessão). Os testes podem escrever em diretório temporário; o app, nunca.
- Nenhum segredo no repositório. `.env.test`, `docker-compose.yml` e a senha do usuário de ponta a ponta (só no banco de desenvolvimento local) são credenciais de desenvolvimento.
- `TZ=America/Sao_Paulo` em teste e em produção. Data "de hoje" e protocolo sempre pela data de Brasília (`Intl` com `timeZone: 'America/Sao_Paulo'`).
- Fronteiras exatamente como o `eslint.config.js` trava (tabela abaixo): `app` e `feature-api` só chegam ao servidor compartilhado por `server/shared/http/**` e por `server/*/composition.ts`; pastas de front (`app`, `features`, `components`, `lib`, `hooks`) não importam `node:*`, `@prisma/*`, `@aws-sdk/*` nem o `better-auth` de servidor; feature não importa outra feature (só a rota compõe duas).
- **Git durante a reescrita, em toda tarefa:**
  1. `git switch teste && git pull --ff-only && git switch -c <tipo>/<assunto>`
  2. Commits pequenos, Conventional Commits, descrição em português. **Sem `Co-Authored-By`.**
  3. Antes do merge: `pnpm db:up && pnpm lint && pnpm typecheck && pnpm test` — tudo limpo. (Depois de criar rota, rode `pnpm build` uma vez antes do `typecheck`: ele regenera `src/app/routeTree.gen.ts`, que é ignorado pelo git.)
  4. `git switch teste && git merge --no-ff <branch> -m "merge: <assunto>" && git branch -d <branch> && git push origin teste`
  5. **Push na `teste` é deploy em hml. Nunca tocar nem enviar a `main`.** Nenhuma outra branch vai ao remoto.
- **E1 — porte fiel do conteúdo.** Perguntas, enunciados, dicas, opções, textos do resultado, do relatório, do aviso de privacidade, prazos, URL da Avaliação Prévia (`https://consultoria.austercontabil.com.br/diagnostico-reforma`), retenção de 24 meses e recomendação ficam como no antigo. Onde este plano manda "porte literal", o texto é copiado caractere por caractere de `git show 22b3cfc:legacy/modelo.html` (ou `backoffice.html`); só saem o envio por WhatsApp e o painel `?motor=1`. A única frase alterada está marcada na Tarefa 7 (faixa de retomada), porque a original afirma algo que deixou de ser verdade.

## Fronteiras (como o `eslint.config.js` trava)

| De | Pode importar |
|---|---|
| `src/app/**` | `app`, `features/**` (inclusive `api`), `components/**`, `lib/**`, `hooks/**`, `config/**`, `styles/**`, `server/*/domain/**`, `server/shared/domain/**`, `server/*/composition.ts`, `server/shared/http/**` |
| `src/features/<f>/api/**` | a própria feature, `server/*/composition.ts`, `server/shared/http/**`, `server/*/domain/**`, `server/shared/domain/**`, `components/**`, `lib/**` |
| `src/features/<f>/**` (fora de `api`) | a própria feature (inclusive `api`), `components/**`, `lib/**`, `hooks/**`, `config/**`, `server/*/domain/**`, `server/shared/domain/**` |
| `src/components/**`, `src/lib/**`, `src/hooks/**`, `src/styles/**` | entre si |
| `src/server/<m>/domain/**` | o próprio `domain`, `server/shared/domain/**` (sem `node:*`, `process`, `fetch`, IO) |
| `src/server/<m>/application/**` | o próprio `domain`, o próprio `ports`, a própria `application`, `server/shared/domain/**` |
| `src/server/<m>/ports/**` | o próprio `domain`, `server/shared/domain/**` |
| `src/server/<m>/adapters/**` | o próprio `ports`, o próprio `domain`, os próprios `adapters`, `server/shared/**` |
| `src/server/<m>/composition.ts` | o próprio módulo inteiro, `server/shared/**`, `server/*/composition.ts` |
| `src/server/shared/**` | `server/shared/**` (e `shared/auth` → `server/audit/composition.ts`) |

Arquivos `*.test.ts(x)` estão fora das fronteiras. `scripts/**`, `tests/**` e `prisma/**` também.

## `node:sqlite` no Node 22

O `node:sqlite` saiu de trás da flag `--experimental-sqlite` no Node 22.13.0. A imagem usa `node:22-alpine` (sempre a 22.x mais nova) e o portal antigo já rodava `DatabaseSync` nela sem flag. Conferido também no Vitest 5 deste repositório (Node 24 local): importa e roda; só emite `ExperimentalWarning`, que não é erro. **Nenhuma flag é necessária.** A Tarefa 13 sobe `engines.node` para `>=22.13` para isso ficar explícito.

## Mapa de arquivos

```
prisma/schema.prisma                                       (M, T1)
prisma/migrations/<carimbo>_diagnosis_stage1/migration.sql (C, T1, gerado)
public/brand/logo-contabil-negativa.png  logo-contabil-positiva.png   (C, T7)
playwright.config.ts                                       (C, T14)
package.json  vitest.config.ts  AGENTS.md                  (M, T6/T13/T14)
tests/setup-dom.ts                                         (C, T6)
tests/e2e/{global-setup.ts,fill.ts,diagnosis.spec.ts,backoffice.spec.ts}  (C, T14)
scripts/migrate-legacy.ts                                  (C, T13)

src/styles/app.css                                         (M, T7)
src/styles/diagnosis.css                                   (C, T7; M, T8, T9)
src/styles/backoffice.css                                  (C, T10)
src/lib/print.ts  print.test.ts                            (C, T9)
src/components/brand/site-header.tsx                       (C, T7)
src/components/backoffice/backoffice-shell.tsx             (C, T10)

src/server/audit/domain/audit-entry.ts  audit-entry.test.ts            (M/C, T1)
src/server/shared/http/draft-cookie.ts  draft-cookie.test.ts           (C, T5)
src/server/identity/adapters/better-auth-user-accounts.ts  .int.test.ts (M, T12)

src/server/diagnosis/domain/
  dates.ts  draft-rules.ts  validate-answers.ts  matrix-footer.ts  review.ts
  result-view.ts  report-sheets.ts  stored-payload.ts  csv.ts  response-status.ts
  company-badge.ts  protocol.ts                            (C, T2; protocol.ts T4)
  testing/screen-text.ts                                   (C, T2)
  *.test.ts  screen.invariants.test.ts                     (C, T2/T4)
src/server/diagnosis/ports/
  draft-repository.ts  response-repository.ts  protocol-generator.ts  clock.ts
  rate-limiter.ts  audit-recorder.ts  invitation-gateway.ts  company-gateway.ts   (C, T4)
  response-backoffice-repository.ts                        (C, T10)
src/server/diagnosis/application/
  drafts.ts  submit-diagnosis.ts  reports.ts  testing/fakes.ts  *.test.ts         (C, T4)
  backoffice-responses.ts  backoffice-responses.test.ts    (C, T10)
src/server/diagnosis/adapters/
  schema.int.test.ts                                       (C, T1)
  prisma-draft-repository.ts  prisma-response-repository.ts  random-protocol-generator.ts
  system-clock.ts  *.int.test.ts                           (C, T4; M, T10)
src/server/diagnosis/composition.ts                        (C, T4; M, T10)

src/server/invitations/{domain,ports,application,adapters}/**  composition.ts  (C, T3)
src/server/legacy-import/{domain,ports,application,adapters}/**  composition.ts (C, T13)

src/features/diagnosis/
  types/diagnosis.ts                                       (C, T5)
  api/diagnosis.ts  api/client.ts                          (C, T5)
  hooks/form-state.ts  hooks/use-diagnosis-form.ts  *.test.ts(x)   (C, T6)
  components/{step-bar,question-field,matrix-field,cnpj-badge,privacy-consent,
    resume-banner,step-form,triage-referral,diagnosis-page}.tsx       (C, T7)
  components/{review-screen,result-screen,submission-card}.tsx        (C, T8)
  components/report-document.tsx                           (C, T9)
src/features/backoffice-responses/{api,components}/**      (C, T10)
src/features/backoffice-invitations/{api,components}/**    (C, T11)
src/features/backoffice-users/{api,components}/**          (C, T12)
src/features/backoffice-audit/{api,components}/**          (C, T12)

src/app/routes/diagnosis/index.tsx                         (C, T7)
src/app/routes/diagnosis/report.tsx                        (C, T9)
src/app/routes/backoffice/index.tsx                        (M, T10, T11, T12)
src/app/routes/backoffice/responses/$id/report.tsx         (C, T10)
src/app/routes/backoffice/responses[.]csv.ts               (C, T10)
```

## Mapa do CSS antigo para o novo

O CSS do diagnóstico e do relatório é o `<style>` de `git show 22b3cfc:legacy/modelo.html` (linhas 23–493); o do backoffice, o de `legacy/backoffice.html` (linhas 11–136). Ele é portado regra por regra, com três trocas mecânicas e nada mais:

1. **Variáveis** → tokens já existentes ou criados na Tarefa 7 em `app.css`:

| Antigo | Novo |
|---|---|
| `--escuro` `--claro` `--acento` `--tinta` `--cinza` `--fundo` | `--color-auster-dark` `--color-auster-light` `--color-auster-accent` `--color-auster-ink` `--color-auster-gray` `--color-auster-background` |
| `--borda` `--borda-forte` | `--color-auster-border` `--color-auster-border-strong` |
| `--alto` `--medio` `--baixo` | `--color-auster-high` `--color-auster-medium` `--color-auster-low` |
| `--sombra` | `--shadow-auster` |
| `--t-meta` `--t-corpo` `--t-destaque` `--t-titulo` `--t-tela` | `--text-meta` `--text-body` `--text-lead` `--text-title` `--text-screen` |

2. **Escopo**: todo seletor de elemento solto do antigo (`h1`, `h2`, `h3`, `button`, `textarea`, `input[...]`, `select`, `main`) ganha o prefixo da raiz da tela (`.dx` no diagnóstico, `.rp` no relatório, `.bo` no backoffice). O `body` e o `*` do antigo não são portados (o `app.css` já os define).

3. **Classes** → nomes em inglês pela tabela:

| Antigo (`modelo.html`) | Novo |
|---|---|
| `header` `.cabecalho` `.logo` `.logo.tela` `.logo.papel` `.sub` | `.dx-header` `.dx-header-brand` `.dx-logo` `.dx-logo.is-screen` `.dx-logo.is-paper` `.dx-header-sub` |
| `main` | `.dx` (raiz `<main className="dx">`) |
| `.etapa-conta` | `.dx-step-count` |
| `.passos` `.passo` `.passo.ativo` `.passo.feito` | `.dx-steps` `.dx-step` `.dx-step.is-active` `.dx-step.is-done` |
| `.cartao` | `.dx-card` |
| `.campo` `.campo>label` `.obr` `.erro` `.dica` | `.dx-field` `.dx-field>label` `.dx-required` `.dx-error` `.dx-hint` |
| `.opcoes` `.opcoes.curtas` `.opcao` `.opcao.marcada` `.opcao.com-desc` `.texto-opcao` `.desc` | `.dx-options` `.dx-options.is-short` `.dx-option` `.dx-option.is-checked` `.dx-option.has-description` `.dx-option-text` `.dx-option-description` |
| `.matriz-rolo` `table.matriz` `th.rot` `td .f` `.na` | `.dx-matrix-scroll` `table.dx-matrix` `th.dx-matrix-row` `td .dx-matrix-band` `.is-unknown` |
| `.soma` `.soma.alerta` | `.dx-matrix-sum` `.dx-matrix-sum.is-warning` |
| `.rodape-nav` | `.dx-nav` |
| `button.principal` `button.secundario` | `.dx-button.is-primary` `.dx-button.is-secondary` |
| `.cadastro` `.buscando` `.achou` `.alerta` | `.dx-company` `.dx-company.is-loading` `.dx-company.is-found` `.dx-company.is-warning` |
| `.privacidade` `.opcao.aceite` | `.dx-privacy` `.dx-option.is-consent` |
| `.retomar` `.retomar .botoes` | `.dx-resume` `.dx-resume-actions` |
| `.escopo` `.glossario` `.aviso` | `.dx-scope` `.dx-glossary` `.dx-notice` |
| `.encaminha` `.menor` `.botoes` `a.cta` | `.dx-referral` `.is-minor` `.dx-referral-actions` `a.dx-cta` |
| `.rev-bloco` `.conta` `.rev-linha` `.pergunta` `.resposta` `.resposta.vazia` `.resposta.lacuna` `.linha-matriz` `.linha-matriz.na` `button.alterar` `.decide` `.rev-aviso` | `.dx-review-block` `.dx-review-count` `.dx-review-row` `.dx-review-question` `.dx-review-answer` `.dx-review-answer.is-empty` `.dx-review-answer.is-gap` `.dx-matrix-line` `.dx-matrix-line.is-gap` `.dx-review-change` `.dx-decides` `.dx-review-gaps` |
| `.campo.destacado` `@keyframes pisca` | `.dx-field.is-highlighted` `@keyframes dx-flash` |
| `.selo.ALTA/.MÉDIA/.BAIXA` | `.dx-level[data-level="ALTA"/"MÉDIA"/"BAIXA"]` |
| `.regime` `.fechada` `.aberta` `.f-hibrido` `.f-padrao` | `.dx-decision` `[data-certainty="fechada"/"aberta"]` `[data-family="hibrido"/"padrao"]` |
| `.regime .rot .nome .qual .faca .porque .prefixo .abertos .det .prelim .trava .fonte` | `.dx-decision-label` `-name` `-qualifier` `-action` `-why` `-prefix` `-open` `-detail` `-reading` `-notice` `-source` (todas `.dx-decision-*`) |
| `.precisa-numeros` `.marca` | `.dx-needs-numbers` `.dx-needs-numbers-mark` |
| `.cartao.significa` `.grade` `.mini` `.mini .rot .val .nota-mini` `.mini.destaque` `.val.grande` | `.dx-card.dx-meaning` `.dx-grid` `.dx-mini` `.dx-mini-label` `.dx-mini-value` `.dx-mini-note` `.dx-mini.is-highlight` `.dx-mini-value.is-large` |
| `.eixo` `.topo` `.barra` `.barra i` `i.f-forte/.f-atenção/.f-prioritária` | `.dx-axis` `.dx-axis-head` `.dx-bar` `.dx-bar-fill` `[data-tone="forte"/"atenção"/"prioritária"]` |
| `.acao` `.t` `.p` `.meta` `.base` `.acao.auster` | `.dx-action` `.dx-action-title` `.dx-action-reason` `.dx-action-meta` `.dx-action-basis` `.dx-action.is-auster` |
| `.bloco-auster` `.intro` `.encaixe` | `.dx-auster` `.dx-auster-intro` `.dx-fit` |
| `.bloco-envio` `.envio` `.envio.ok` `.envio.erro` | `.dx-submission` `.dx-submission-text` `.is-ok` `.is-error` |
| `.atencao` `.atencao.forte` `.num` `.t` `.c` `.fonte` | `.dx-caution` `.dx-caution.is-strong` `.dx-caution-number` `.dx-caution-title` `.dx-caution-text` `.dx-caution-source` |
| `.conflito .parte` `.assimetria` `.fonte-legal` `.notas-pe` | `.dx-conflict-part` `.dx-asymmetry` `.dx-legal-source` `.dx-footnotes` |
| `.barra-doc` `.doc` `.folha` `.capa` `.selo-doc` `.cabecalho-doc` `.corrido` | `.rp-toolbar` `.rp` `.rp-sheet` `.rp-sheet.is-cover` `.rp-badge` `.rp-header-table` `.rp-prose` |
| `.doc-decisao` `.fechada/.aberta` `.rot .nome .qual` | `.rp-decision` `[data-certainty]` `.rp-decision-label` `-name` `-qualifier` |
| `.doc-abertos` `.doc-acao` `.n .t .p .m .f` | `.rp-open` `.rp-action` `.rp-action-number` `-title` `-reason` `-requires` `-basis` |
| `.prazos` `.resumo` `.p` `.r` `.r.lacuna` `.linha-matriz` | `.rp-deadlines` `.rp-summary` `.rp-summary-question` `.rp-summary-answer` `.rp-summary-answer.is-gap` `.dx-matrix-line` |
| `.doc-livre` `.doc-ressalvas` `.doc-nota` `.doc-fonte` `.doc-rodape` | `.rp-free` `.rp-cautions` `.rp-note` `.rp-source` `.rp-footer` |

| Antigo (`backoffice.html`) | Novo |
|---|---|
| `header` `.marca` `.logo` `h1` `.linha-fina` `.acoes-cabecalho` `.quem` `.sair` | `.bo-header` `.bo-brand` `.bo-logo` `.bo-header h1` `.bo-tagline` `.bo-header-actions` `.bo-who` `.bo-logout` |
| `main` `.abas` `.aba` `.aba.ativa` `.painel` `.filtros` | `.bo` `.bo-tabs` `.bo-tab` `.bo-tab.is-active` `.bo-panel` `.bo-filters` |
| `button` `button.claro` `table` `th` `td` `tr.linha` | `.bo-button` `.bo-button.is-light` `.bo table` `.bo th` `.bo td` `tr.bo-row` |
| `.selo` `.s-nova` `.s-em_analise` `.s-validada` `.s-descartada` | `.bo-badge` `[data-status="new"/"in_review"/"validated"/"discarded"]` |
| `.u-ALTA` `.u-MÉDIA` `.u-BAIXA` | `.bo-badge[data-level="ALTA"/"MÉDIA"/"BAIXA"]` |
| `.contagem` `.caixa` `.rot` `.val` `.vazio` `.nota` | `.bo-counts` `.bo-count` `.bo-count-label` `.bo-count-value` `.bo-empty` `.bo-note` |
| `dialog` `.ficha` `.prot` `.grade` `.item` `.respostas` `.k` `.v` `.alerta-qsa` `.acoes-ficha` | `.bo-dialog` `.bo-sheet` `.bo-protocol` `.bo-grid` `.bo-item` `.bo-answers` `.bo-answer-key` `.bo-answer-value` `.bo-alert` `.bo-sheet-actions` |
| `.link-convite` `.papel` `.papel.admin` `.inativo` `.erro-senha` | `.bo-link` `.bo-role` `.bo-role.is-admin` `.is-inactive` `.bo-error` |

As regras de galeria, sessões, adesões e campos de evento do `backoffice.html` não são portadas (Etapas 2 e 3).

---

### Task 1: Migração do schema da etapa 1

**Files:**
- Modify: `prisma/schema.prisma`, `src/server/audit/domain/audit-entry.ts`
- Create: `prisma/migrations/<carimbo>_diagnosis_stage1/migration.sql` (gerado pelo Prisma), `src/server/audit/domain/audit-entry.test.ts`
- Test: `src/server/diagnosis/adapters/schema.int.test.ts`

**Interfaces:**
- Consumes: schema da fundação.
- Produces:
  - `DiagnosisDraft.responseId Int? @unique` (relação com `Response`, `onDelete: SetNull`), `DiagnosisDraft.invitationToken String?`, `DiagnosisDraft.invitationOpened Boolean @default(false)`; `Response.updatedAt DateTime?`; `Response.draft DiagnosisDraft?`.
  - `AUDIT_ACTIONS` ganha `'response_updated'` e `'legacy_imported'`.
  - `AUDIT_ACTION_LABELS: Record<AuditAction, string>` em `src/server/audit/domain/audit-entry.ts` (rótulo em português para a tela de auditoria).

- [ ] **Step 1: Branch**

```bash
git switch teste && git pull --ff-only && git switch -c feat/schema-etapa-1
pnpm db:up
```

- [ ] **Step 2: Testes que falham**

```ts
// src/server/diagnosis/adapters/schema.int.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'

const tomorrow = () => new Date(Date.now() + 86_400_000)

describe('stage 1 schema', () => {
  beforeEach(resetDatabase)

  it('links one draft to one response and keeps the invitation fields', async () => {
    const response = await prisma.response.create({ data: { protocol: 'DS-260930-AAAA', payload: {} } })
    expect(response.updatedAt).toBeNull()
    const draft = await prisma.diagnosisDraft.create({
      data: { payload: {}, expiresAt: tomorrow(), responseId: response.id, invitationToken: 'ABCDEFGHJK' },
    })
    expect(draft.invitationOpened).toBe(false)
    await expect(
      prisma.diagnosisDraft.create({ data: { payload: {}, expiresAt: tomorrow(), responseId: response.id } }),
    ).rejects.toThrow()
  })

  it('keeps the draft when its response is deleted', async () => {
    const response = await prisma.response.create({ data: { protocol: 'DS-260930-BBBB', payload: {} } })
    const draft = await prisma.diagnosisDraft.create({ data: { payload: {}, expiresAt: tomorrow(), responseId: response.id } })
    await prisma.response.delete({ where: { id: response.id } })
    expect((await prisma.diagnosisDraft.findUniqueOrThrow({ where: { id: draft.id } })).responseId).toBeNull()
  })

  it('stores the time the client last changed a response', async () => {
    const changedAt = new Date('2026-09-20T15:00:00Z')
    const response = await prisma.response.create({ data: { protocol: 'DS-260930-CCCC', payload: {}, updatedAt: changedAt } })
    expect(response.updatedAt).toEqual(changedAt)
  })
})
```

```ts
// src/server/audit/domain/audit-entry.test.ts
import { describe, expect, it } from 'vitest'
import { AUDIT_ACTION_LABELS, AUDIT_ACTIONS } from './audit-entry'

describe('audit actions', () => {
  it('knows the stage 1 actions', () => {
    expect(AUDIT_ACTIONS).toContain('response_updated')
    expect(AUDIT_ACTIONS).toContain('legacy_imported')
  })

  it('labels every action in Portuguese', () => {
    for (const action of AUDIT_ACTIONS) expect(AUDIT_ACTION_LABELS[action]).toMatch(/^[a-zà-ú ]+$/)
  })
})
```

- [ ] **Step 3:** Run `pnpm vitest run src/server/diagnosis/adapters/schema.int.test.ts src/server/audit/domain/audit-entry.test.ts`. Expected: FAIL — `Unknown argument \`responseId\`` / `updatedAt` no Prisma e `AUDIT_ACTION_LABELS` não exportado.

- [ ] **Step 4: Schema**

Em `prisma/schema.prisma`, substitua os dois modelos por:

```prisma
model DiagnosisDraft {
  id               String    @id @default(uuid()) @db.Uuid
  step             Int       @default(1)
  payload          Json
  updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  expiresAt        DateTime  @map("expires_at") @db.Timestamptz
  responseId       Int?      @unique @map("response_id")
  response         Response? @relation(fields: [responseId], references: [id], onDelete: SetNull)
  invitationToken  String?   @map("invitation_token")
  invitationOpened Boolean   @default(false) @map("invitation_opened")

  @@index([expiresAt])
  @@map("diagnosis_drafts")
}
```

e, em `model Response`, depois de `receivedAt`:

```prisma
  updatedAt       DateTime?      @map("updated_at") @db.Timestamptz
```

e, junto das relações de `Response` (depois de `registrations Registration[]`):

```prisma
  draft           DiagnosisDraft?
```

Run: `pnpm prisma migrate dev --name diagnosis_stage1` (gera a migração e o cliente em `src/server/shared/prisma/generated`, que é ignorado pelo git).

- [ ] **Step 5: Ações de auditoria**

Em `src/server/audit/domain/audit-entry.ts`, troque `AUDIT_ACTIONS` e acrescente os rótulos:

```ts
export const AUDIT_ACTIONS = [
  'access_denied', 'login', 'user_created', 'user_updated', 'admin_bootstrapped',
  'invitation_created', 'invitation_deleted', 'response_received', 'response_updated', 'response_handled',
  'adhesion_received', 'adhesion_handled', 'event_created', 'event_updated', 'event_slug_changed',
  'registration_received', 'registration_handled', 'file_stored', 'spreadsheet_exported', 'legacy_imported',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  access_denied: 'acesso negado',
  login: 'entrada',
  user_created: 'usuário criado',
  user_updated: 'usuário alterado',
  admin_bootstrapped: 'administrador de implantação',
  invitation_created: 'convite criado',
  invitation_deleted: 'convite apagado',
  response_received: 'resposta recebida',
  response_updated: 'resposta alterada pelo cliente',
  response_handled: 'resposta tratada',
  adhesion_received: 'adesão recebida',
  adhesion_handled: 'adesão tratada',
  event_created: 'evento criado',
  event_updated: 'evento alterado',
  event_slug_changed: 'endereço do evento trocado',
  registration_received: 'inscrição recebida',
  registration_handled: 'inscrição tratada',
  file_stored: 'arquivo guardado',
  spreadsheet_exported: 'planilha exportada',
  legacy_imported: 'migração do portal antigo',
}
```

O front lê `AUDIT_ACTION_LABELS` direto do domínio (permitido pelas fronteiras); a composição não muda.

- [ ] **Step 6:** Run `pnpm vitest run src/server/diagnosis/adapters/schema.int.test.ts src/server/audit`. Expected: PASS.
- [ ] **Step 7: Commit e merge**

```bash
git add prisma/schema.prisma prisma/migrations src/server/audit src/server/diagnosis/adapters/schema.int.test.ts
git commit -m "feat(diagnostico): rascunho ligado à resposta, data da alteração e ações de auditoria da etapa 1"
pnpm lint && pnpm typecheck && pnpm test
git switch teste && git merge --no-ff feat/schema-etapa-1 -m "merge: schema da etapa 1" && git branch -d feat/schema-etapa-1 && git push origin teste
```

---
### Task 2: Modelos de tela puros e as invariantes de tela

**Files:**
- Create: `src/server/diagnosis/domain/dates.ts`, `draft-rules.ts`, `validate-answers.ts`, `matrix-footer.ts`, `review.ts`, `result-view.ts`, `report-sheets.ts`, `stored-payload.ts`, `csv.ts`, `response-status.ts`, `company-badge.ts`, `testing/screen-text.ts`, `testing/applicable-fill.ts` (todos em `src/server/diagnosis/domain/`)
- Test: `src/server/diagnosis/domain/validate-answers.test.ts`, `draft-rules.test.ts`, `matrix-footer.test.ts`, `stored-payload.test.ts`, `csv.test.ts`, `report-sheets.test.ts`, `screen.invariants.test.ts`

**Interfaces:**
- Consumes: `QUESTIONS`, `BLOCKS`, `visibleQuestions`, `bandMidpoint`, `optionLabel` (`questions.ts`); `Question`, `Answers`, `MatrixAnswer` (`question-types.ts`); `diagnose`, `Diagnosis`, `Conflict` (`diagnose.ts`); `buildActionPlan`, `ActionPlan`, `ActionItem` (`action-plan.ts`); `assessConfidence`, `ConfidenceLevel` (`confidence.ts`); `PositionDefinition` (`outcomes.ts`); `VALIDATORS` (`server/shared/domain/validation.ts`); `generateFills` (`testing/fill-generator.ts`).
- Produces (todas puras, exportadas pelo próprio arquivo):
  - `dates.ts`: `brasiliaDateParts(date: Date): { year: string; month: string; day: string }`, `formatLongDate(date: Date): string`, `formatShortDateTime(iso: string | null): string`
  - `draft-rules.ts`: `FORM_STEPS = 5`, `REVIEW_STEP = 6`, `RESULT_STEP = 7`, `DRAFT_TTL_MS`, `DRAFT_ID_PATTERN`, `draftExpiry(now: Date): Date`, `isDraftExpired(expiresAt: Date, now: Date): boolean`, `clampStep(step: number): number`, `stripInternalKeys(answers: Answers): Answers`, `cleanInvisibleAnswers(answers: Answers): Answers`, `triageReason(answers: Answers): TriageReason | null` com `TriageReason = 'mei' | 'outside'`, `sameAnswers(a: Answers, b: Answers): boolean`, `type AnswerValue = string | Record<string, string>`, `type WireAnswers = Record<string, AnswerValue>`, `toWireAnswers(answers: Answers): WireAnswers`
  - `validate-answers.ts`: `type AnswerProblems = Record<string, string>`, `stepProblems(answers: Answers, block: number): AnswerProblems`, `validateAnswers(answers: Answers): AnswerProblems`, `fieldProblem(answers: Answers, key: string): string | null`
  - `matrix-footer.ts`: `matrixFooter(answers: Answers, key: string): { warning: boolean; text: string }`
  - `review.ts`: `ReadableAnswer`, `readableAnswer(question: Question, answers: Answers): ReadableAnswer | null`, `ReviewRow`, `ReviewBlock`, `ReviewView`, `reviewItems(answers: Answers): ReviewView`
  - `result-view.ts`: `RadarTone`, `ResultView`, `windowText(diagnosis: Diagnosis): string`, `resultView(diagnosis: Diagnosis, plan: ActionPlan): ResultView`
  - `report-sheets.ts`: `ReportSubject`, `NumberedAction`, `ReportSheets`, `reportFileName(companyName: string): string`, `reportSheets(subject: ReportSubject, diagnosis: Diagnosis, plan: ActionPlan): ReportSheets`
  - `stored-payload.ts`: `asRecord(value: unknown): Record<string, unknown>`, `EngineSnapshot`, `StoredPayload`, `ResponseProjections`, `buildStoredPayload(answers: Answers, diagnosis: Diagnosis, requesterInQsa: boolean | null): StoredPayload`, `readStoredPayload(payload: unknown): StoredPayload`, `cnpjDigits(cnpj: string): string | null`, `responseProjections(payload: StoredPayload): ResponseProjections`, `DetailValue`, `AnswerBlocks`, `answerBlocks(answers: Answers): AnswerBlocks`
  - `csv.ts`: `CsvResponse`, `csvRows(responses: CsvResponse[]): string[][]`, `toCsv(rows: string[][]): string`, `csvFileName(today: Date): string`
  - `response-status.ts`: `RESPONSE_STATUSES`, `ResponseStatus`, `RESPONSE_STATUS_LABELS`, `isResponseStatus(value: unknown): value is ResponseStatus`
  - `company-badge.ts`: `CompanyBadge`, `CompanyBadgeLookup`, `toCompanyBadge(company: CompanyBadge): CompanyBadge`, `applyCompanyPrefill(answers: Answers, company: CompanyBadge): Answers`
  - `testing/screen-text.ts`: `affirmsMerit(text: string): string | null`, `collectText(value: unknown): { texts: string[]; numbers: number[] }`
  - `testing/applicable-fill.ts`: `applicableFill(seed: number): Answers` — o primeiro preenchimento gerado que não cai na triagem (usado pelos testes das Tarefas 4, 6, 8 e 9)

Mapa do antigo (`git show 22b3cfc:legacy/modelo.html`):

| Antigo | Novo |
|---|---|
| `problemasNaEtapa(numeroBloco)` | `stepProblems(answers, block)`; `validateAnswers` junta as 5 etapas |
| `window.conferirCampo` (só validador) | `fieldProblem(answers, key)` |
| `somaMatriz` + `rodapeMatriz` | `matrixFooter` |
| `respostaLegivel(p)` | `readableAnswer(question, answers)` |
| `renderRevisao` (dados) | `reviewItems` |
| `renderResultado` (dados) | `resultView` |
| `renderRelatorio` + `resumoDoPreenchimento` + `nomeDoArquivo` (dados) | `reportSheets`, `reportFileName` |
| `atalhoDeTriagem` | `triageReason` |
| `window.set` (apaga o invisível) | `cleanInvisibleAnswers` |
| `servidor.mjs: planilhaDeRespostas` + `rotuloDe` | `csvRows` + `toCsv` |
| `backoffice.html: valorLegivel` + agrupamento de `abrirFicha` | `answerBlocks` |
| `banco.mjs: gravarResposta` (projeções) | `responseProjections` |
| `testes.mjs: PALAVRAS_DE_MERITO`, `NEGACAO`, `afirmaMerito` | `testing/screen-text.ts` (`MERIT_PHRASES`, `NEGATION`, `affirmsMerit`) |

O `payload` novo é `StoredPayload` (`{ answers, engine, requesterInQsa, formVersion }`). O antigo é o `pacote` (`{ respostas, diagnostico: { saida, posicao, certeza, urgencia, confianca, lacunas, gatilhos, pontosEmAberto }, solicitanteNoQsa, versaoFormulario }`) e fica como está no banco; `readStoredPayload` lê os dois formatos, e é só por ele que backoffice, CSV e relatório leem o `payload`.

- [ ] **Step 1: Branch**

```bash
git switch teste && git pull --ff-only && git switch -c feat/modelos-de-tela
```

- [ ] **Step 2: Testes que falham**

```ts
// src/server/diagnosis/domain/validate-answers.test.ts
import { describe, expect, it } from 'vitest'
import { VALIDATORS } from '../../shared/domain/validation'
import { fieldProblem, stepProblems, validateAnswers } from './validate-answers'

describe('validateAnswers', () => {
  it('asks for every required field of step 1', () => {
    const problems = stepProblems({}, 1)
    for (const key of ['versaoFormulario', 'cnpj', 'nomeEmpresa', 'regimeAtual', 'ehSimei', 'solicitante', 'email', 'telefone', 'jaClienteAuster', 'segmento', 'aceiteLgpd']) {
      expect(problems[key]).toBe('Obrigatório')
    }
    expect(problems.expectativa).toBeUndefined()
  })

  it('uses the validator message for a malformed value', () => {
    expect(stepProblems({ cnpj: '11.111.111/1111-11' }, 1).cnpj).toBe(VALIDATORS.cnpj.error)
    expect(fieldProblem({ telefone: '(34) 1234' }, 'telefone')).toBe(VALIDATORS.phone.error)
    expect(fieldProblem({ telefone: '' }, 'telefone')).toBeNull()
    expect(fieldProblem({ segmento: 'comercio' }, 'segmento')).toBeNull()
  })

  it('requires every row of the customer matrix', () => {
    expect(stepProblems({ receitaPorCliente: { pessoa_fisica: 'zero' } }, 3).receitaPorCliente).toBe('Responda todas as linhas.')
  })

  it('joins the five steps', () => {
    const all = validateAnswers({})
    expect(all.versaoFormulario).toBe('Obrigatório')
    expect(all.receitaPorCliente).toBe('Responda todas as linhas.')
  })
})
```

```ts
// src/server/diagnosis/domain/draft-rules.test.ts
import { describe, expect, it } from 'vitest'
import {
  clampStep, cleanInvisibleAnswers, draftExpiry, isDraftExpired, sameAnswers, stripInternalKeys, toWireAnswers, triageReason,
} from './draft-rules'

describe('draft rules', () => {
  it('expires seven days after the last save', () => {
    const now = new Date('2026-09-20T12:00:00Z')
    const expiry = draftExpiry(now)
    expect(expiry.toISOString()).toBe('2026-09-27T12:00:00.000Z')
    expect(isDraftExpired(expiry, new Date('2026-09-27T11:59:59Z'))).toBe(false)
    expect(isDraftExpired(expiry, new Date('2026-09-27T12:00:00Z'))).toBe(true)
  })

  it('drops internal keys and clamps the step', () => {
    expect(stripInternalKeys({ nomeEmpresa: 'X', _cadastro: { a: 1 }, _protocolo: 'DS' })).toEqual({ nomeEmpresa: 'X' })
    expect([clampStep(0), clampStep(4), clampStep(9), clampStep(Number.NaN)]).toEqual([1, 4, 7, 1])
  })

  it('erases answers of questions that became invisible', () => {
    const answers = { segmento: 'servico_saude', servicoHospitalar: 'sim', _interno: 'fica' }
    expect(cleanInvisibleAnswers(answers)).toEqual(answers)
    expect(cleanInvisibleAnswers({ ...answers, segmento: 'comercio' })).toEqual({ segmento: 'comercio', _interno: 'fica' })
  })

  it('detours MEI and companies outside the Simples, but not "não sei"', () => {
    expect(triageReason({ ehSimei: 'sim' })).toBe('mei')
    expect(triageReason({ regimeAtual: 'presumido' })).toBe('outside')
    expect(triageReason({ regimeAtual: 'nao_sei' })).toBeNull()
    expect(triageReason({ regimeAtual: 'simples', ehSimei: 'nao' })).toBeNull()
  })

  it('compares answers regardless of key order', () => {
    expect(sameAnswers({ a: '1', m: { x: 'zero', y: 'nao_sei' } }, { m: { y: 'nao_sei', x: 'zero' }, a: '1' })).toBe(true)
    expect(sameAnswers({ a: '1' }, { a: '2' })).toBe(false)
  })

  it('keeps only strings and string maps on the wire', () => {
    expect(toWireAnswers({ a: 'x', m: { r: 'zero', n: 3 }, n: 3, l: ['x'] })).toEqual({ a: 'x', m: { r: 'zero' } })
  })
})
```

```ts
// src/server/diagnosis/domain/matrix-footer.test.ts
import { describe, expect, it } from 'vitest'
import { matrixFooter } from './matrix-footer'

describe('matrixFooter', () => {
  it('warns outside 80 to 120 percent', () => {
    expect(matrixFooter({ receitaPorCliente: { pessoa_fisica: 'acima_80', simples_mei: 'ate_20' } }, 'receitaPorCliente'))
      .toEqual({ warning: false, text: 'Soma aproximada: 100%' })
    expect(matrixFooter({ receitaPorCliente: { pessoa_fisica: 'de_20_40' } }, 'receitaPorCliente'))
      .toEqual({ warning: true, text: 'Soma aproximada: 30% — revise, o total deveria ficar perto de 100%.' })
  })

  it('counts "não sei" as a gap, not as zero', () => {
    expect(matrixFooter({ receitaPorCliente: { pessoa_fisica: 'de_20_40', exterior: 'nao_sei' } }, 'receitaPorCliente'))
      .toEqual({ warning: false, text: 'Soma das linhas respondidas: 30% — uma linha ficou em "não sei".' })
    expect(matrixFooter({ receitaPorCliente: { a: 'nao_sei', b: 'nao_sei' } }, 'receitaPorCliente').text)
      .toBe('Soma das linhas respondidas: 0% — 2 linhas ficaram em "não sei".')
  })
})
```

```ts
// src/server/diagnosis/domain/stored-payload.test.ts
import { describe, expect, it } from 'vitest'
import { answerBlocks, readStoredPayload, responseProjections } from './stored-payload'

const legacyPacote = {
  protocolo: 'DS-260915-ABCD',
  versaoFormulario: 'sintetico',
  diagnostico: { saida: 'B', posicao: 'Simples híbrido', certeza: 'aberta', urgencia: 'ALTA', confianca: 'MÉDIA', lacunas: ['margemLiquida'], gatilhos: ['g1'], pontosEmAberto: ['p1'] },
  respostas: { nomeEmpresa: 'Empresa Antiga', cnpj: '11.222.333/0001-81', regimeAtual: 'simples', aceiteLgpd: 'sim', campoRemovido: 'x' },
  solicitanteNoQsa: false,
}

describe('stored payload', () => {
  it('reads the legacy pacote and the new payload the same way', () => {
    const legacy = readStoredPayload(legacyPacote)
    expect(legacy.answers.nomeEmpresa).toBe('Empresa Antiga')
    expect(legacy.engine).toEqual({ outcome: 'B', position: 'Simples híbrido', certainty: 'aberta', urgency: 'ALTA', confidence: 'MÉDIA', gaps: ['margemLiquida'], triggers: ['g1'], openPoints: ['p1'] })
    expect(legacy.requesterInQsa).toBe(false)
    expect(legacy.formVersion).toBe('sintetico')
    expect(readStoredPayload(legacy)).toEqual(legacy)
    expect(readStoredPayload(null).answers).toEqual({})
  })

  it('projects the columns used for search and listing', () => {
    expect(responseProjections(readStoredPayload(legacyPacote))).toMatchObject({
      companyName: 'Empresa Antiga', cnpj: '11.222.333/0001-81', cnpjDigits: '11222333000181', outcome: 'B', requesterInQsa: false, formVersion: 'sintetico',
    })
  })

  it('groups answers by block with labels and keeps keys the form no longer has', () => {
    const blocks = answerBlocks(legacyPacote.respostas)
    expect(blocks.total).toBe(4)
    expect(blocks.blocks[0]?.rows.find((row) => row.key === 'regimeAtual')?.value).toEqual({ kind: 'text', text: 'Simples Nacional' })
    expect(blocks.blocks.flatMap((block) => block.rows).some((row) => row.key === 'aceiteLgpd')).toBe(false)
    expect(blocks.outsideForm).toEqual([{ key: 'campoRemovido', value: { kind: 'text', text: 'x' } }])
  })
})
```

```ts
// src/server/diagnosis/domain/csv.test.ts
import { describe, expect, it } from 'vitest'
import { csvFileName, csvRows, toCsv } from './csv'
import { readStoredPayload } from './stored-payload'

const matrixHeader = (row: string) => `3. Quanto do seu faturamento vai para cada tipo de cliente? — ${row}`

describe('responses spreadsheet', () => {
  const payload = readStoredPayload({
    answers: {
      nomeEmpresa: 'Empresa "A"; Filial', cnpj: '11.222.333/0001-81', regimeAtual: 'simples', aceiteLgpd: 'sim',
      receitaPorCliente: { pessoa_fisica: 'acima_80', simples_mei: 'nao_sei' },
    },
    engine: { outcome: 'B', position: 'Simples híbrido', certainty: 'aberta', urgency: 'ALTA', confidence: 'MÉDIA', gaps: ['a', 'b'], triggers: ['t'], openPoints: [] },
    requesterInQsa: false,
    formVersion: 'completo',
  })
  const rows = csvRows([{
    protocol: 'DS-260915-AB12', receivedAt: new Date('2026-09-15T13:00:00Z'), status: 'in_review', handledBy: 'maria',
    handledAt: null, invitationToken: 'ABCDEFGHJK', payload,
  }])
  const [header = [], line = []] = rows
  const at = (column: string) => line[header.indexOf(column)]

  it('has the legacy fixed columns, then one per question and one per matrix row', () => {
    expect(header.slice(0, 3)).toEqual(['protocolo', 'recebido em', 'situacao'])
    expect(header).toHaveLength(line.length)
    expect(at('situacao')).toBe('Em análise')
    expect(at('origem')).toBe('convite ABCDEFGHJK')
    expect(at('campos em nao sei')).toBe('a | b')
    expect(at('quem respondeu no QSA')).toBe('nao')
    expect(at('1. Regime tributário atual')).toBe('Simples Nacional')
    expect(at(matrixHeader('Pessoa física / consumidor final'))).toBe('acima de 80%')
    expect(at(matrixHeader('MEI ou empresa do Simples'))).toBe('não sei')
    expect(header.some((column) => column.includes('aceiteLgpd'))).toBe(false)
  })

  it('writes BOM, semicolons, CRLF and quotes what needs quoting', () => {
    const csv = toCsv(rows)
    expect(csv.startsWith('﻿protocolo;recebido em;situacao;')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.split('\r\n')).toHaveLength(3)
    expect(csv).toContain(';"Empresa ""A""; Filial";')
  })

  it('names the file by the Brasília date', () => {
    expect(csvFileName(new Date('2026-10-01T02:00:00Z'))).toBe('respostas-simples-2026-09-30.csv')
  })
})
```

```ts
// src/server/diagnosis/domain/report-sheets.test.ts
import { describe, expect, it } from 'vitest'
import { reportFileName } from './report-sheets'

describe('report file name', () => {
  it('follows the legacy pattern', () => {
    expect(reportFileName('Padaria São João & Filhos Ltda.')).toBe('Plano-De-Acao-SN-Padaria-Sao-Joao-Filhos-Ltda')
    expect(reportFileName('')).toBe('Plano-De-Acao-SN-Empresa')
    expect(reportFileName('***')).toBe('Plano-De-Acao-SN-Empresa')
  })
})
```

```ts
// src/server/diagnosis/domain/screen.invariants.test.ts
import { describe, expect, it } from 'vitest'
import { buildActionPlan } from './action-plan'
import { diagnose } from './diagnose'
import { visibleQuestions } from './questions'
import { reportSheets } from './report-sheets'
import { resultView } from './result-view'
import { reviewItems } from './review'
import { generateFills } from './testing/fill-generator'
import { affirmsMerit, collectText } from './testing/screen-text'
import { validateAnswers } from './validate-answers'

const TODAY = new Date('2026-09-15T10:00:00-03:00')
const PROTOCOL = 'DS-260915-AB12'

function expectCleanScreen(view: unknown) {
  const { texts, numbers } = collectText(view)
  for (const text of texts) {
    expect(text).not.toMatch(/\b(undefined|NaN)\b/)
    expect(text.trim()).not.toBe('null')
  }
  for (const number of numbers) expect(Number.isFinite(number)).toBe(true)
  expect(affirmsMerit(texts.join(' '))).toBeNull()
}

describe('screen invariants over 40 000 fills', () => {
  it('holds every screen invariant of the legacy battery (#18–22, #25–30)', () => {
    let checked = 0
    for (const answers of generateFills({ count: 40_000, seed: 20260915 })) {
      const diagnosis = diagnose(answers, TODAY)
      const plan = buildActionPlan(answers, diagnosis)
      const result = resultView(diagnosis, plan)
      const review = reviewItems(answers)
      const report = reportSheets({ answers, protocol: PROTOCOL, issuedOn: TODAY }, diagnosis, plan)
      const visible = visibleQuestions(answers)
      const reviewRows = review.blocks.flatMap((block) => block.rows)

      expect(validateAnswers(answers)).toEqual({})
      expect(review.total).toBe(visible.length)
      expect(reviewRows.map((row) => row.key).sort()).toEqual(visible.map((question) => question.key).sort())
      for (const row of reviewRows) {
        if (visible.find((question) => question.key === row.key)?.required !== 'never') expect(row.answer).not.toBeNull()
      }
      if (diagnosis.position.family === 'hibrido') expect(result.decision.showWithdrawalNotice).toBe(true)
      expectCleanScreen(result)
      expectCleanScreen(report)
      expect(report.sheetCount).toBe(plan.auster.length ? 6 : 5)
      const choiceQuestions = visible.filter((question) => question.type !== 'consent' && question.type !== 'textarea')
      expect(report.summary.blocks.reduce((total, block) => total + block.rows.length, 0)).toBe(choiceQuestions.length)
      expect(report.cover.protocol).toMatch(/^DS-\d{6}-[A-Z0-9]{4}$/)
      checked++
    }
    expect(checked).toBe(40_000)
  }, 300_000)
})
```

O texto fixo das telas (o "30 de novembro" do cartão de prazos, as ressalvas, o aviso de método) é conferido nos testes de componente das Tarefas 8 e 9, que desenham as telas e rodam `affirmsMerit` sobre o texto renderizado.

- [ ] **Step 3:** Run `pnpm vitest run src/server/diagnosis/domain`. Expected: FAIL — os módulos novos não existem.

- [ ] **Step 4: `dates.ts`, `response-status.ts`, `company-badge.ts`**

```ts
// src/server/diagnosis/domain/dates.ts
const TIME_ZONE = 'America/Sao_Paulo'

export function brasiliaDateParts(date: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return { year: part('year'), month: part('month'), day: part('day') }
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: TIME_ZONE })
}

export function formatShortDateTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: TIME_ZONE })
}
```

```ts
// src/server/diagnosis/domain/response-status.ts
export const RESPONSE_STATUSES = ['new', 'in_review', 'validated', 'discarded'] as const

export type ResponseStatus = (typeof RESPONSE_STATUSES)[number]

export const RESPONSE_STATUS_LABELS: Record<ResponseStatus, string> = {
  new: 'Nova',
  in_review: 'Em análise',
  validated: 'Validada',
  discarded: 'Descartada',
}

export const isResponseStatus = (value: unknown): value is ResponseStatus =>
  typeof value === 'string' && (RESPONSE_STATUSES as readonly string[]).includes(value)
```

```ts
// src/server/diagnosis/domain/company-badge.ts
import type { Answers } from './question-types'

export interface CompanyBadge {
  legalName: string
  city: string
  state: string
  simplesOptant: boolean | null
  meiOptant: boolean | null
  active: boolean
  registrationStatus: string
}

export type CompanyBadgeLookup = { ok: true; company: CompanyBadge; requesterInQsa: boolean | null } | { ok: false; reason: string }

export const toCompanyBadge = (company: CompanyBadge): CompanyBadge => ({
  legalName: company.legalName,
  city: company.city,
  state: company.state,
  simplesOptant: company.simplesOptant,
  meiOptant: company.meiOptant,
  active: company.active,
  registrationStatus: company.registrationStatus,
})

// Only what the respondent left blank is filled: the registry never overwrites an answer.
export function applyCompanyPrefill(answers: Answers, company: CompanyBadge): Answers {
  const next = { ...answers }
  if (company.legalName && !next.nomeEmpresa) next.nomeEmpresa = company.legalName
  if (!next.ehSimei) next.ehSimei = company.meiOptant ? 'sim' : 'nao'
  if (!next.regimeAtual && company.simplesOptant) next.regimeAtual = 'simples'
  return next
}
```

`toCompanyBadge` existe para o adaptador cortar o `CompanyData` inteiro (que traz CNAE e datas) no que a tela mostra.

- [ ] **Step 5: `draft-rules.ts`, `validate-answers.ts`, `matrix-footer.ts`**

```ts
// src/server/diagnosis/domain/draft-rules.ts
import type { Answers } from './question-types'
import { QUESTIONS, visibleQuestions } from './questions'

export const FORM_STEPS = 5
export const REVIEW_STEP = 6
export const RESULT_STEP = 7
export const DRAFT_TTL_MS = 7 * 24 * 3600 * 1000
export const DRAFT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TriageReason = 'mei' | 'outside'
export type AnswerValue = string | Record<string, string>
export type WireAnswers = Record<string, AnswerValue>

const QUESTION_KEYS = new Set(QUESTIONS.map((question) => question.key))

export const draftExpiry = (now: Date): Date => new Date(now.getTime() + DRAFT_TTL_MS)

export const isDraftExpired = (expiresAt: Date, now: Date): boolean => expiresAt.getTime() <= now.getTime()

export const clampStep = (step: number): number =>
  Number.isFinite(step) ? Math.min(Math.max(Math.trunc(step), 1), RESULT_STEP) : 1

export const stripInternalKeys = (answers: Answers): Answers =>
  Object.fromEntries(Object.entries(answers).filter(([key]) => !key.startsWith('_')))

export function cleanInvisibleAnswers(answers: Answers): Answers {
  let current = answers
  for (let pass = 0; pass < QUESTIONS.length; pass++) {
    const visible = new Set(visibleQuestions(current).map((question) => question.key))
    const next = Object.fromEntries(Object.entries(current).filter(([key]) => visible.has(key) || !QUESTION_KEYS.has(key)))
    if (Object.keys(next).length === Object.keys(current).length) return next
    current = next
  }
  return current
}

export function triageReason(answers: Answers): TriageReason | null {
  if (answers.ehSimei === 'sim') return 'mei'
  if (answers.regimeAtual && answers.regimeAtual !== 'simples' && answers.regimeAtual !== 'nao_sei') return 'outside'
  return null
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export const sameAnswers = (a: Answers, b: Answers): boolean => stable(a) === stable(b)

export function toWireAnswers(answers: Answers): WireAnswers {
  const wire: WireAnswers = {}
  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === 'string') wire[key] = value
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      wire[key] = Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    }
  }
  return wire
}
```

`cleanInvisibleAnswers` repete até estabilizar (o `set()` antigo fazia uma passada só e deixava a segunda para o próximo clique); o resultado de qualquer preenchimento gerado é o mesmo, porque o gerador também limpa até estabilizar.

```ts
// src/server/diagnosis/domain/validate-answers.ts
import { VALIDATORS } from '../../shared/domain/validation'
import type { Answers, MatrixAnswer } from './question-types'
import { BLOCKS, QUESTIONS, visibleQuestions } from './questions'

export type AnswerProblems = Record<string, string>

export function stepProblems(answers: Answers, block: number): AnswerProblems {
  const problems: AnswerProblems = {}
  for (const question of visibleQuestions(answers)) {
    if (question.block !== block || question.required === 'never') continue
    const value = answers[question.key]
    if (question.type === 'matrix') {
      const matrix = (value as MatrixAnswer | undefined) ?? {}
      if ((question.rows ?? []).some((row) => !matrix[row.key])) problems[question.key] = 'Responda todas as linhas.'
      continue
    }
    if (!value || !String(value).trim()) {
      problems[question.key] = 'Obrigatório'
      continue
    }
    const validator = question.validator ? VALIDATORS[question.validator] : undefined
    if (validator && !validator.validate(String(value))) problems[question.key] = validator.error
  }
  return problems
}

export const validateAnswers = (answers: Answers): AnswerProblems =>
  Object.assign({}, ...BLOCKS.map((block) => stepProblems(answers, block.number)))

export function fieldProblem(answers: Answers, key: string): string | null {
  const question = QUESTIONS.find((q) => q.key === key)
  const value = answers[key]
  if (!question?.validator || typeof value !== 'string' || !value.trim()) return null
  const validator = VALIDATORS[question.validator]
  return validator.validate(value) ? null : validator.error
}
```

```ts
// src/server/diagnosis/domain/matrix-footer.ts
import type { Answers, MatrixAnswer } from './question-types'
import { bandMidpoint } from './questions'

// "Não sei" enters as a gap, not as 0%: otherwise the 100% warning would accuse the honest answer.
export function matrixFooter(answers: Answers, key: string): { warning: boolean; text: string } {
  const matrix = (answers[key] as MatrixAnswer | undefined) ?? {}
  let sum = 0
  let unknown = 0
  for (const value of Object.values(matrix)) {
    const midpoint = bandMidpoint(value)
    if (midpoint === null) unknown++
    else sum += midpoint
  }
  if (unknown) {
    const rows = unknown === 1 ? 'uma linha ficou' : `${unknown} linhas ficaram`
    return { warning: false, text: `Soma das linhas respondidas: ${sum}% — ${rows} em "não sei".` }
  }
  const outside = sum > 0 && (sum < 80 || sum > 120)
  return { warning: outside, text: `Soma aproximada: ${sum}%${outside ? ' — revise, o total deveria ficar perto de 100%.' : ''}` }
}
```

- [ ] **Step 6: `review.ts`**

```ts
// src/server/diagnosis/domain/review.ts
import { assessConfidence } from './confidence'
import type { Answers, MatrixAnswer, Question } from './question-types'
import { BLOCKS, visibleQuestions } from './questions'

export type ReadableAnswer =
  | { kind: 'text'; text: string; gap: boolean }
  | { kind: 'matrix'; rows: { label: string; value: string; gap: boolean }[]; gap: boolean }

export interface ReviewRow {
  key: string
  block: number
  prompt: string
  decides: boolean
  answer: ReadableAnswer | null
}

export interface ReviewBlock {
  number: number
  title: string
  position: number
  rows: ReviewRow[]
}

export interface ReviewView {
  blocks: ReviewBlock[]
  total: number
  readableGaps: string[]
}

export function readableAnswer(question: Question, answers: Answers): ReadableAnswer | null {
  const value = answers[question.key]
  if (question.type === 'matrix') {
    const matrix = (value as MatrixAnswer | undefined) ?? {}
    const rows = (question.rows ?? []).map((row) => {
      const raw = matrix[row.key]
      const column = (question.columns ?? []).find((c) => c.value === raw)
      return { label: row.label, value: raw === undefined ? 'não respondido' : (column?.label ?? raw), gap: raw === question.unknownValue }
    })
    return { kind: 'matrix', rows, gap: rows.some((row) => row.gap) }
  }
  if (!value || !String(value).trim()) return null
  if (question.type === 'consent') return { kind: 'text', text: 'Concordou com o uso das informações', gap: false }
  if (question.options) {
    const option = question.options.find((o) => o.value === value)
    return { kind: 'text', text: option ? option.label : String(value), gap: value === question.unknownValue }
  }
  return { kind: 'text', text: String(value), gap: false }
}

const decides = (question: Question) => question.feeds.includes('modality') || question.feeds.includes('eligibility')

export function reviewItems(answers: Answers): ReviewView {
  const visible = visibleQuestions(answers)
  const blocks = BLOCKS.map((block, index) => ({
    number: block.number,
    title: block.title,
    position: index + 1,
    rows: visible
      .filter((question) => question.block === block.number)
      .map((question) => ({ key: question.key, block: question.block, prompt: question.prompt, decides: decides(question), answer: readableAnswer(question, answers) })),
  })).filter((block) => block.rows.length > 0)
  return { blocks, total: visible.length, readableGaps: assessConfidence(answers).readableGaps }
}
```

- [ ] **Step 7: `result-view.ts`**

```ts
// src/server/diagnosis/domain/result-view.ts
import type { ActionItem, ActionPlan } from './action-plan'
import type { ConfidenceLevel } from './confidence'
import type { Conflict, Diagnosis } from './diagnose'
import type { PositionDefinition } from './outcomes'

export type RadarTone = 'forte' | 'atenção' | 'prioritária' | null

export interface ResultView {
  lowConfidence: { gapCount: number; readableGaps: string[] } | null
  decision: {
    certainty: PositionDefinition['certainty']
    family: PositionDefinition['family']
    label: string
    qualifier: string
    singleAction: string
    openPoints: string[]
    preliminaryReading: { condition: string; modalityLabel: string } | null
    why: { preliminary: boolean; title: string; summary: string } | null
    detail: string | null
    showWithdrawalNotice: boolean
  }
  meaning: string | null
  windowText: string
  filingDeadline: { value: string; note: string }
  urgency: ConfidenceLevel
  confidence: { level: ConfidenceLevel; dasEstimated: boolean }
  radar: { title: string; scoreText: string; band: string; width: number; tone: RadarTone }[]
  plan: { clientNow: ActionItem[]; clientLater: ActionItem[]; auster: ActionItem[] }
  conflict: Conflict | null
  asymmetry: { title: string; text: string; forWhom: string | null; source: string }
}

const DEFAULT_CONDITION = 'depende de um ponto que as respostas não fecham'
const ESTIMATED_DAS = 'estimado pela tabela do anexo'
const TONES: Record<string, RadarTone> = { forte: 'forte', 'atenção moderada': 'atenção', 'evolução prioritária': 'prioritária' }

export function windowText(diagnosis: Diagnosis): string {
  if (!diagnosis.windowOpen) return 'encerrada'
  if (diagnosis.calendarDaysToWindowEnd === 0) return 'hoje é o último dia'
  if (diagnosis.calendarDaysToWindowEnd === 1) return 'termina amanhã'
  return `${diagnosis.calendarDaysToWindowEnd} dias`
}

export function resultView(diagnosis: Diagnosis, plan: ActionPlan): ResultView {
  const { position, outcome, preliminaryReading, asymmetry } = diagnosis
  const reading = preliminaryReading
    ? { condition: preliminaryReading.condition ?? DEFAULT_CONDITION, modalityLabel: preliminaryReading.modality.label }
    : null
  const lead = diagnosis.operationalLeadDays
  return {
    lowConfidence: diagnosis.preliminary
      ? { gapCount: diagnosis.confidence.gaps.length, readableGaps: diagnosis.confidence.readableGaps }
      : null,
    decision: {
      certainty: position.certainty,
      family: position.family,
      label: position.label,
      qualifier: position.qualifier,
      singleAction: position.singleAction,
      openPoints: position.openPoints,
      preliminaryReading: reading,
      why: reading ? null : { preliminary: position.qualifier !== 'decisão fechada', title: outcome.title, summary: outcome.summary },
      detail: position.detail && !reading ? position.detail : null,
      showWithdrawalNotice: position.family === 'hibrido' || position.family === 'a_definir',
    },
    meaning: outcome.meaning || null,
    windowText: windowText(diagnosis),
    filingDeadline: diagnosis.withinLeadTime
      ? { value: diagnosis.filingDeadline, note: `Antecedência nossa de ${lead} dias úteis para representação, análise prévia e eventual pendência de Estado ou Município. Não é prazo legal.` }
      : { value: 'o quanto antes', note: `A antecedência de ${lead} dias úteis que pedimos já não cabe. Dá para fazer, mas passa a ser prioridade da semana.` },
    urgency: diagnosis.urgency,
    confidence: { level: diagnosis.confidence.level, dasEstimated: diagnosis.derived.dasSource === ESTIMATED_DAS },
    radar: diagnosis.radar.map((axis) => ({
      title: axis.title,
      scoreText: axis.score === null ? '—' : `${axis.score}%`,
      band: axis.band,
      width: axis.score ?? 0,
      tone: TONES[axis.band] ?? null,
    })),
    plan: { clientNow: plan.clientNow, clientLater: plan.clientLater, auster: plan.auster },
    conflict: diagnosis.conflict,
    asymmetry: { title: asymmetry.title, text: asymmetry.text, forWhom: position.family === 'padrao' ? asymmetry.forWhom : null, source: asymmetry.source },
  }
}
```

Confira cada ramo contra `renderResultado` (linhas 1214–1412 de `modelo.html`): `d.preliminar` → `lowConfidence`; `d.leituraPreliminar` → `preliminaryReading`; o prefixo "Indicação preliminar —" aparece quando `qualificador !== 'decisão fechada'` → `why.preliminary`; o cartão `trava` aparece para `hibrido`/`a_definir` → `showWithdrawalNotice`; as quatro caixas (janela, protocolar até, urgência, confiança) → `windowText`, `filingDeadline`, `urgency`, `confidence`.

- [ ] **Step 8: `report-sheets.ts`**

```ts
// src/server/diagnosis/domain/report-sheets.ts
import type { ActionItem, ActionPlan } from './action-plan'
import { formatLongDate } from './dates'
import type { Conflict, Diagnosis } from './diagnose'
import type { PositionDefinition } from './outcomes'
import type { Answers } from './question-types'
import { BLOCKS, visibleQuestions } from './questions'
import { readableAnswer, type ReadableAnswer } from './review'

export interface ReportSubject {
  answers: Answers
  protocol: string
  issuedOn: Date
}

export interface NumberedAction {
  number: number
  action: string
  reason: string
  requires: string | null
  legalBasis: string | null
}

export interface ReportSheets {
  fileName: string
  cover: {
    company: string
    cnpj: string
    requester: string
    protocol: string
    issuedOn: string
    version: 'caminho curto' | 'completa'
    decision: { certainty: PositionDefinition['certainty']; label: string; qualifier: string; singleAction: string }
    openPoints: string[]
  }
  meaning: {
    text: string
    conflict: Conflict | null
    asymmetry: { title: string; text: string; forWhom: string | null; source: string }
    showDeadlines: boolean
  }
  plan: { clientNow: NumberedAction[]; clientLater: NumberedAction[] }
  auster: NumberedAction[]
  summary: { blocks: { title: string; rows: { prompt: string; answer: ReadableAnswer | null }[] }[]; freeText: { label: string; value: string }[] }
  footer: string
  sheetCount: 5 | 6
}

const text = (answers: Answers, key: string): string => {
  const value = answers[key]
  return typeof value === 'string' ? value : ''
}

export function reportFileName(companyName: string): string {
  const plain = (companyName || 'Empresa').normalize('NFD').replace(/[̀-ͯ]/g, '')
  const clean = plain.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `Plano-De-Acao-SN-${clean || 'Empresa'}`
}

const numbered = (items: ActionItem[], offset: number): NumberedAction[] =>
  items.map((item, index) => ({
    number: offset + index + 1,
    action: item.action,
    reason: item.reason,
    requires: item.requires ?? null,
    legalBasis: item.legalBasis ?? null,
  }))

export function reportSheets(subject: ReportSubject, diagnosis: Diagnosis, plan: ActionPlan): ReportSheets {
  const { answers, protocol } = subject
  const issuedOn = formatLongDate(subject.issuedOn)
  const company = text(answers, 'nomeEmpresa')
  const { position, asymmetry } = diagnosis
  const visible = visibleQuestions(answers)
  const blocks = BLOCKS.map((block) => ({
    title: block.title,
    rows: visible
      .filter((question) => question.block === block.number && question.type !== 'consent' && question.type !== 'textarea')
      .map((question) => ({ prompt: question.prompt, answer: readableAnswer(question, answers) })),
  })).filter((block) => block.rows.length > 0)
  const freeText = [
    { label: 'O que você esperava descobrir', value: text(answers, 'expectativa') },
    { label: 'O que mudou na sua percepção', value: text(answers, 'percepcaoFinal') },
  ].filter((item) => item.value.trim())
  return {
    fileName: reportFileName(company),
    cover: {
      company: company || '—',
      cnpj: text(answers, 'cnpj') || '—',
      requester: text(answers, 'solicitante') || '—',
      protocol,
      issuedOn,
      version: answers.versaoFormulario === 'sintetico' ? 'caminho curto' : 'completa',
      decision: { certainty: position.certainty, label: position.label, qualifier: position.qualifier, singleAction: position.singleAction },
      openPoints: position.openPoints,
    },
    meaning: {
      text: diagnosis.outcome.meaning,
      conflict: diagnosis.conflict,
      asymmetry: { title: asymmetry.title, text: asymmetry.text, forWhom: position.family === 'padrao' ? asymmetry.forWhom : null, source: asymmetry.source },
      showDeadlines: position.family === 'hibrido' || position.family === 'a_definir',
    },
    plan: { clientNow: numbered(plan.clientNow, 0), clientLater: numbered(plan.clientLater, plan.clientNow.length) },
    auster: numbered(plan.auster, 0),
    summary: { blocks, freeText },
    footer: `${protocol} · ${company} · emitido em ${issuedOn}`,
    sheetCount: plan.auster.length ? 6 : 5,
  }
}
```

- [ ] **Step 9: `stored-payload.ts`**

```ts
// src/server/diagnosis/domain/stored-payload.ts
import type { Diagnosis } from './diagnose'
import type { Answers, Question } from './question-types'
import { BLOCKS, QUESTIONS } from './questions'

export interface EngineSnapshot {
  outcome: string
  position: string
  certainty: string
  urgency: string
  confidence: string
  gaps: string[]
  triggers: string[]
  openPoints: string[]
}

export interface StoredPayload {
  answers: Answers
  engine: EngineSnapshot
  requesterInQsa: boolean | null
  formVersion: string | null
}

export interface ResponseProjections {
  companyName: string | null
  cnpj: string | null
  cnpjDigits: string | null
  requester: string | null
  email: string | null
  phone: string | null
  formVersion: string | null
  outcome: string | null
  position: string | null
  certainty: string | null
  urgency: string | null
  confidence: string | null
  requesterInQsa: boolean | null
}

export type DetailValue = { kind: 'text'; text: string } | { kind: 'matrix'; rows: { label: string; value: string }[] }

export interface AnswerBlocks {
  blocks: { number: number; title: string; rows: { key: string; prompt: string; value: DetailValue }[] }[]
  outsideForm: { key: string; value: DetailValue }[]
  total: number
}

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
const asString = (value: unknown): string => (typeof value === 'string' ? value : '')
const asStrings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
const asBoolean = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null)
const orNull = (value: unknown): string | null => asString(value).trim() || null

export function buildStoredPayload(answers: Answers, diagnosis: Diagnosis, requesterInQsa: boolean | null): StoredPayload {
  return {
    answers,
    engine: {
      outcome: diagnosis.outcome.code,
      position: diagnosis.position.label,
      certainty: diagnosis.position.certainty,
      urgency: diagnosis.urgency,
      confidence: diagnosis.confidence.level,
      gaps: diagnosis.confidence.gaps,
      triggers: diagnosis.triggers,
      openPoints: diagnosis.position.openPoints,
    },
    requesterInQsa,
    formVersion: orNull(answers.versaoFormulario),
  }
}

export function readStoredPayload(payload: unknown): StoredPayload {
  const root = asRecord(payload)
  if ('answers' in root) {
    const engine = asRecord(root.engine)
    return {
      answers: asRecord(root.answers),
      engine: {
        outcome: asString(engine.outcome), position: asString(engine.position), certainty: asString(engine.certainty),
        urgency: asString(engine.urgency), confidence: asString(engine.confidence), gaps: asStrings(engine.gaps),
        triggers: asStrings(engine.triggers), openPoints: asStrings(engine.openPoints),
      },
      requesterInQsa: asBoolean(root.requesterInQsa),
      formVersion: orNull(root.formVersion),
    }
  }
  const legacy = asRecord(root.diagnostico)
  return {
    answers: asRecord(root.respostas),
    engine: {
      outcome: asString(legacy.saida), position: asString(legacy.posicao), certainty: asString(legacy.certeza),
      urgency: asString(legacy.urgencia), confidence: asString(legacy.confianca), gaps: asStrings(legacy.lacunas),
      triggers: asStrings(legacy.gatilhos), openPoints: asStrings(legacy.pontosEmAberto),
    },
    requesterInQsa: asBoolean(root.solicitanteNoQsa),
    formVersion: orNull(root.versaoFormulario),
  }
}

export function cnpjDigits(cnpj: string): string | null {
  return cnpj.replace(/[^0-9A-Za-z]/g, '').toUpperCase() || null
}

export function responseProjections(payload: StoredPayload): ResponseProjections {
  const { answers, engine } = payload
  return {
    companyName: orNull(answers.nomeEmpresa),
    cnpj: orNull(answers.cnpj),
    cnpjDigits: cnpjDigits(asString(answers.cnpj)),
    requester: orNull(answers.solicitante),
    email: orNull(answers.email),
    phone: orNull(answers.telefone),
    formVersion: payload.formVersion,
    outcome: engine.outcome || null,
    position: engine.position || null,
    certainty: engine.certainty || null,
    urgency: engine.urgency || null,
    confidence: engine.confidence || null,
    requesterInQsa: payload.requesterInQsa,
  }
}

// A value the current form does not know is shown as it is: inventing a label would hide the divergence.
function detailValue(question: Question | undefined, value: unknown): DetailValue {
  if (value === undefined || value === null || value === '') return { kind: 'text', text: '—' }
  if (question?.type === 'matrix' && typeof value === 'object') {
    const matrix = asRecord(value)
    return {
      kind: 'matrix',
      rows: (question.rows ?? []).flatMap((row) => {
        const raw = matrix[row.key]
        if (typeof raw !== 'string' || !raw) return []
        return [{ label: row.label, value: (question.columns ?? []).find((c) => c.value === raw)?.label ?? raw }]
      }),
    }
  }
  if (typeof value === 'object') return { kind: 'text', text: JSON.stringify(value) }
  return { kind: 'text', text: question?.options?.find((o) => o.value === value)?.label ?? String(value) }
}

export function answerBlocks(answers: Answers): AnswerBlocks {
  const answered = Object.keys(answers).filter((key) => key !== 'aceiteLgpd')
  const known = new Set(QUESTIONS.map((question) => question.key))
  return {
    blocks: BLOCKS.map((block) => ({
      number: block.number,
      title: block.title,
      rows: QUESTIONS.filter((question) => question.block === block.number && answered.includes(question.key)).map((question) => ({
        key: question.key,
        prompt: question.prompt,
        value: detailValue(question, answers[question.key]),
      })),
    })).filter((block) => block.rows.length > 0),
    outsideForm: answered.filter((key) => !known.has(key)).map((key) => ({ key, value: detailValue(undefined, answers[key]) })),
    total: answered.length,
  }
}
```

- [ ] **Step 10: `csv.ts`**

```ts
// src/server/diagnosis/domain/csv.ts
import { brasiliaDateParts } from './dates'
import type { Question } from './question-types'
import { QUESTIONS } from './questions'
import { RESPONSE_STATUS_LABELS, type ResponseStatus } from './response-status'
import { asRecord, type StoredPayload } from './stored-payload'

export interface CsvResponse {
  protocol: string
  receivedAt: Date
  status: ResponseStatus
  handledBy: string | null
  handledAt: Date | null
  invitationToken: string | null
  payload: StoredPayload
}

const FIXED_HEADER = [
  'protocolo', 'recebido em', 'situacao', 'tratado por', 'tratado em',
  'origem', 'empresa', 'CNPJ', 'quem respondeu', 'e-mail', 'telefone',
  'versao', 'saida', 'posicao', 'certeza', 'urgencia', 'confianca',
  'pontos em aberto', 'campos em nao sei', 'gatilhos', 'quem respondeu no QSA',
]
const RAW_TYPES = new Set<Question['type']>(['text', 'email', 'phone', 'cnpj', 'textarea'])

const optionText = (question: Question, value: unknown): string => {
  if (value === undefined || value === null || value === '') return ''
  return question.options?.find((o) => o.value === value)?.label ?? String(value)
}

export function csvRows(responses: CsvResponse[]): string[][] {
  const simple = QUESTIONS.filter((question) => question.type !== 'matrix')
  const matrixColumns = QUESTIONS.filter((question) => question.type === 'matrix').flatMap((question) =>
    (question.rows ?? []).map((row) => ({ question, row })),
  )
  const header = [
    ...FIXED_HEADER,
    ...simple.map((question) => `${question.block}. ${question.prompt}`),
    ...matrixColumns.map(({ question, row }) => `${question.block}. ${question.prompt} — ${row.label}`),
  ]
  const body = responses.map(({ protocol, receivedAt, status, handledBy, handledAt, invitationToken, payload }) => {
    const { answers, engine, requesterInQsa, formVersion } = payload
    const raw = (key: string) => {
      const value = answers[key]
      return typeof value === 'string' ? value : ''
    }
    return [
      protocol, receivedAt.toISOString(), RESPONSE_STATUS_LABELS[status], handledBy ?? '', handledAt?.toISOString() ?? '',
      invitationToken ? `convite ${invitationToken}` : 'link aberto',
      raw('nomeEmpresa'), raw('cnpj'), raw('solicitante'), raw('email'), raw('telefone'),
      formVersion ?? '', engine.outcome, engine.position, engine.certainty, engine.urgency, engine.confidence,
      engine.openPoints.join(' | '), engine.gaps.join(' | '), engine.triggers.join(' | '),
      requesterInQsa === true ? 'sim' : requesterInQsa === false ? 'nao' : '',
      ...simple.map((question) => (RAW_TYPES.has(question.type) ? raw(question.key) : optionText(question, answers[question.key]))),
      ...matrixColumns.map(({ question, row }) => {
        const value = asRecord(answers[question.key])[row.key]
        if (typeof value !== 'string' || !value) return ''
        return question.columns?.find((c) => c.value === value)?.label ?? value
      }),
    ]
  })
  return [header, ...body]
}

const cell = (value: string): string => (/[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

// Semicolon and BOM because the destination is Excel in Portuguese.
export const toCsv = (rows: string[][]): string => `﻿${rows.map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`

export function csvFileName(today: Date): string {
  const { year, month, day } = brasiliaDateParts(today)
  return `respostas-simples-${year}-${month}-${day}.csv`
}
```

- [ ] **Step 11: `testing/screen-text.ts`**

```ts
// src/server/diagnosis/domain/testing/screen-text.ts
const MERIT_PHRASES = [
  'sai mais barato', 'sairia mais caro', 'margem aguenta', 'aguenta esse desconto',
  'mais barato do que', 'mais caro do que', 'sai mais barata', 'sairia mais barato',
]
const NEGATION = /não serve|não significa|não é|não para|nem para|é conta|não diz|nunca|deixa de|sem conta|não permite/i

export function affirmsMerit(text: string): string | null {
  const lower = text.toLowerCase()
  for (const phrase of MERIT_PHRASES) {
    let index = lower.indexOf(phrase)
    while (index >= 0) {
      const before = text.slice(Math.max(0, index - 90), index)
      const after = text.slice(index + phrase.length, index + phrase.length + 70)
      if (!NEGATION.test(before) && !NEGATION.test(after)) return phrase
      index = lower.indexOf(phrase, index + 1)
    }
  }
  return null
}

export function collectText(value: unknown, into: { texts: string[]; numbers: number[] } = { texts: [], numbers: [] }) {
  if (typeof value === 'string') into.texts.push(value)
  else if (typeof value === 'number') into.numbers.push(value)
  else if (Array.isArray(value)) value.forEach((item) => collectText(item, into))
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectText(item, into))
  return into
}
```

```ts
// src/server/diagnosis/domain/testing/applicable-fill.ts
import { triageReason } from '../draft-rules'
import type { Answers } from '../question-types'
import { generateFills } from './fill-generator'

export function applicableFill(seed: number): Answers {
  for (const fill of generateFills({ count: 500, seed })) if (!triageReason(fill)) return fill
  throw new Error(`nenhum preenchimento fora da triagem com a semente ${seed}`)
}
```

- [ ] **Step 12:** Run `pnpm vitest run src/server/diagnosis/domain`. Expected: PASS, inclusive as 40 000 rodadas de `screen.invariants.test.ts` e as invariantes da fundação. Se uma invariante cair, o `expect` mostra o preenchimento: corrija o modelo de tela contra o antigo, nunca a invariante.
- [ ] **Step 13: Commit e merge**

```bash
git add src/server/diagnosis/domain
git commit -m "feat(diagnostico): modelos puros da conferência, do resultado, do relatório e da planilha, com as invariantes de tela"
pnpm lint && pnpm typecheck && pnpm test
git switch teste && git merge --no-ff feat/modelos-de-tela -m "merge: modelos de tela do diagnóstico" && git branch -d feat/modelos-de-tela && git push origin teste
```

---
### Task 3: Módulo de convites

**Files:**
- Create: `src/server/invitations/domain/invitation.ts`, `src/server/invitations/ports/invitation-repository.ts`, `src/server/invitations/ports/token-source.ts`, `src/server/invitations/application/manage-invitations.ts`, `src/server/invitations/adapters/prisma-invitation-repository.ts`, `src/server/invitations/adapters/random-token-source.ts`, `src/server/invitations/composition.ts`
- Test: `src/server/invitations/domain/invitation.test.ts`, `src/server/invitations/application/manage-invitations.test.ts`, `src/server/invitations/adapters/prisma-invitation-repository.int.test.ts`

**Interfaces:**
- Consumes: `isValidCnpj`, `maskCnpj`, `VALIDATORS` (`server/shared/domain/validation.ts`); `recordAudit` (`server/audit/composition`); `getEnv().APP_PUBLIC_URL`; tabelas `invitations`, `diagnosis_drafts`, `responses`, `adhesions`.
- Produces (em `@/server/invitations/composition`):
  - `createInvitation(actor: InvitationActor, input: InvitationInput): Promise<{ ok: true; invitation: InvitationView } | { ok: false; message: string }>`
  - `listInvitations(): Promise<InvitationView[]>`
  - `deleteInvitation(actor: InvitationActor, token: string): Promise<{ ok: true } | { ok: false; message: string }>`
  - `openInvitation(token: string, draftId: string): Promise<boolean>` — conta uma abertura por rascunho e grava o token no rascunho
  - `invitationPrefill(token: string): Promise<InvitationPrefill | null>`
  - tipos `InvitationActor = { id: string; username: string }`, `InvitationInput = { companyName: string; cnpj: string; email: string }`, `InvitationPrefill = { token: string; companyName: string | null; cnpj: string | null }`, `InvitationView = { token; companyName; cnpj; email; openCount: number; lastOpenedAt: string | null; createdAt: string; createdBy: string | null; responseCount: number; adhesionCount: number; links: { diagnosis: string; adhesion: string } }`
- Domínio: `TOKEN_ALPHABET`, `TOKEN_LENGTH`, `tokenFromBytes(bytes: Uint8Array): string`, `isInvitationToken(value: string): boolean`, `normalizeInvitation(input): { ok: true; value: { companyName: string | null; cnpj: string | null; email: string | null } } | { ok: false; message: string }`, `invitationLinks(baseUrl: string, token: string): { diagnosis: string; adhesion: string }`, `NAME_OR_CNPJ_REQUIRED`, `INVITATION_IN_USE`.

| Antigo (`banco.mjs` / `backoffice.html`) | Novo |
|---|---|
| `novoToken()` (alfabeto sem I, O, 0, 1; 10 caracteres) | `tokenFromBytes` + `randomTokenSource` |
| `criarConvite` / `convite_criado` | `createInvitation` / `invitation_created` |
| `apagarConvite` ("convite já usado") / `convite_apagado` | `deleteInvitation` (recusa com resposta **ou adesão**) / `invitation_deleted` |
| `marcarAbertura` (contava na abertura da página e de novo no envio) | `openInvitation(token, draftId)` (uma vez por rascunho) |
| `convites()` com `respostas` | `listInvitations()` com `responseCount` e `adhesionCount` |
| links `/?c=` e `/adesao?c=` | `/diagnosis?invite=` e `/adhesion?invite=` sobre `APP_PUBLIC_URL` |

- [ ] **Step 1: Branch** — `git switch teste && git pull --ff-only && git switch -c feat/convites`

- [ ] **Step 2: Testes que falham**

```ts
// src/server/invitations/domain/invitation.test.ts
import { describe, expect, it } from 'vitest'
import { VALIDATORS } from '../../shared/domain/validation'
import { NAME_OR_CNPJ_REQUIRED, invitationLinks, isInvitationToken, normalizeInvitation, tokenFromBytes } from './invitation'

describe('invitation domain', () => {
  it('builds 10-character tokens from the legacy alphabet', () => {
    const token = tokenFromBytes(new Uint8Array([0, 1, 31, 32, 33, 255, 8, 9, 10, 11, 99]))
    expect(token).toBe('AB9AB9JKLM')
    expect(isInvitationToken(token)).toBe(true)
    expect(isInvitationToken('ABCDEFGHI1')).toBe(false)
    expect(isInvitationToken('abcdefghjk')).toBe(false)
  })

  it('requires a name or a valid CNPJ and masks the CNPJ', () => {
    expect(normalizeInvitation({ companyName: ' ', cnpj: '', email: 'a@b.com' })).toEqual({ ok: false, message: NAME_OR_CNPJ_REQUIRED })
    expect(normalizeInvitation({ companyName: '', cnpj: '11.111.111/1111-11', email: '' })).toEqual({ ok: false, message: VALIDATORS.cnpj.error })
    expect(normalizeInvitation({ companyName: '', cnpj: '11222333000181', email: '' })).toEqual({
      ok: true, value: { companyName: null, cnpj: '11.222.333/0001-81', email: null },
    })
  })

  it('links the diagnosis and the adhesion on the public address', () => {
    expect(invitationLinks('https://hml.example/', 'ABCDEFGHJK')).toEqual({
      diagnosis: 'https://hml.example/diagnosis?invite=ABCDEFGHJK',
      adhesion: 'https://hml.example/adhesion?invite=ABCDEFGHJK',
    })
  })
})
```

```ts
// src/server/invitations/application/manage-invitations.test.ts
import { describe, expect, it } from 'vitest'
import type { InvitationRecord, InvitationRepository } from '../ports/invitation-repository'
import { INVITATION_IN_USE } from '../domain/invitation'
import { makeInvitations } from './manage-invitations'

const actor = { id: 'u1', username: 'maria' }

function setup() {
  const rows = new Map<string, InvitationRecord>()
  const opened = new Set<string>()
  const audits: { action: string; reference: string }[] = []
  const repository: InvitationRepository = {
    exists: async (token) => rows.has(token),
    create: async (input) => {
      const record: InvitationRecord = { ...input, note: null, openCount: 0, lastOpenedAt: null, createdAt: new Date('2026-09-20T12:00:00Z'), createdBy: 'maria', responseCount: 0, adhesionCount: 0 }
      rows.set(input.token, record)
      return record
    },
    find: async (token) => rows.get(token) ?? null,
    list: async () => [...rows.values()],
    delete: async (token) => void rows.delete(token),
    registerOpening: async (token, draftId) => {
      const row = rows.get(token)
      if (!row || opened.has(draftId)) return false
      opened.add(draftId)
      row.openCount++
      return true
    },
  }
  const tokens = ['ABCDEFGHJK', 'ABCDEFGHJK', 'ZZZZZZZZZZ']
  const invitations = makeInvitations({
    repository,
    tokens: { next: () => tokens.shift() ?? 'YYYYYYYYYY' },
    recordAudit: async (entry) => void audits.push(entry),
    baseUrl: 'https://hml.example',
  })
  const row = (token: string) => {
    const found = rows.get(token)
    if (!found) throw new Error(`convite ${token} ausente`)
    return found
  }
  return { rows, row, audits, invitations }
}

describe('manage invitations', () => {
  it('creates with a fresh token, audits and returns the links', async () => {
    const { invitations, audits } = setup()
    const first = await invitations.createInvitation(actor, { companyName: 'Empresa', cnpj: '', email: '' })
    const second = await invitations.createInvitation(actor, { companyName: 'Outra', cnpj: '', email: '' })
    expect(first.ok && first.invitation.token).toBe('ABCDEFGHJK')
    expect(second.ok && second.invitation.token).toBe('ZZZZZZZZZZ')
    expect(second.ok && second.invitation.links.diagnosis).toBe('https://hml.example/diagnosis?invite=ZZZZZZZZZZ')
    expect(audits.map((a) => a.action)).toEqual(['invitation_created', 'invitation_created'])
  })

  it('refuses without name or CNPJ', async () => {
    const { invitations } = setup()
    expect((await invitations.createInvitation(actor, { companyName: '', cnpj: '', email: 'x@y.com' })).ok).toBe(false)
  })

  it('does not delete an invitation that brought a response or an adhesion', async () => {
    const { invitations, row, audits } = setup()
    await invitations.createInvitation(actor, { companyName: 'Empresa', cnpj: '', email: '' })
    row('ABCDEFGHJK').adhesionCount = 1
    expect(await invitations.deleteInvitation(actor, 'ABCDEFGHJK')).toEqual({ ok: false, message: INVITATION_IN_USE })
    row('ABCDEFGHJK').adhesionCount = 0
    expect(await invitations.deleteInvitation(actor, 'ABCDEFGHJK')).toEqual({ ok: true })
    expect(audits.at(-1)?.action).toBe('invitation_deleted')
  })

  it('counts one opening per draft and ignores malformed tokens', async () => {
    const { invitations, rows } = setup()
    await invitations.createInvitation(actor, { companyName: 'Empresa', cnpj: '', email: '' })
    expect(await invitations.openInvitation('ABCDEFGHJK', 'd1')).toBe(true)
    expect(await invitations.openInvitation('ABCDEFGHJK', 'd1')).toBe(false)
    expect(await invitations.openInvitation('ABCDEFGHJK', 'd2')).toBe(true)
    expect(await invitations.openInvitation('nada', 'd3')).toBe(false)
    expect(rows.get('ABCDEFGHJK')?.openCount).toBe(2)
  })

  it('prefills only company name and CNPJ of a known token', async () => {
    const { invitations } = setup()
    await invitations.createInvitation(actor, { companyName: 'Empresa', cnpj: '11222333000181', email: 'a@b.com' })
    expect(await invitations.invitationPrefill('ABCDEFGHJK')).toEqual({ token: 'ABCDEFGHJK', companyName: 'Empresa', cnpj: '11.222.333/0001-81' })
    expect(await invitations.invitationPrefill('QQQQQQQQQQ')).toBeNull()
  })
})
```

```ts
// src/server/invitations/adapters/prisma-invitation-repository.int.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import { prismaInvitationRepository } from './prisma-invitation-repository'

describe('prismaInvitationRepository', () => {
  beforeEach(resetDatabase)

  it('creates, lists with usage counts and deletes', async () => {
    const user = await prisma.user.create({ data: { id: 'u1', name: 'Maria', email: 'maria@users.invalid', username: 'maria' } })
    await prismaInvitationRepository.create({ token: 'ABCDEFGHJK', companyName: 'Empresa', cnpj: null, email: null, createdById: user.id })
    await prisma.response.create({ data: { protocol: 'DS-260920-AAAA', payload: {}, invitationToken: 'ABCDEFGHJK' } })
    const [listed] = await prismaInvitationRepository.list()
    expect(listed).toMatchObject({ token: 'ABCDEFGHJK', createdBy: 'maria', responseCount: 1, adhesionCount: 0, openCount: 0 })
    await prisma.response.deleteMany()
    await prismaInvitationRepository.delete('ABCDEFGHJK')
    expect(await prismaInvitationRepository.exists('ABCDEFGHJK')).toBe(false)
  })

  it('counts one opening per draft and stores the token on the draft', async () => {
    await prismaInvitationRepository.create({ token: 'ABCDEFGHJK', companyName: 'Empresa', cnpj: null, email: null, createdById: null })
    const draft = await prisma.diagnosisDraft.create({ data: { payload: {}, expiresAt: new Date(Date.now() + 86_400_000) } })
    const at = new Date('2026-09-20T12:00:00Z')
    expect(await prismaInvitationRepository.registerOpening('ABCDEFGHJK', draft.id, at)).toBe(true)
    expect(await prismaInvitationRepository.registerOpening('ABCDEFGHJK', draft.id, at)).toBe(false)
    expect(await prismaInvitationRepository.registerOpening('QQQQQQQQQQ', draft.id, at)).toBe(false)
    expect(await prisma.invitation.findUniqueOrThrow({ where: { token: 'ABCDEFGHJK' } })).toMatchObject({ openCount: 1, lastOpenedAt: at })
    expect(await prisma.diagnosisDraft.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({ invitationToken: 'ABCDEFGHJK', invitationOpened: true })
  })
})
```

- [ ] **Step 3:** Run `pnpm vitest run src/server/invitations`. Expected: FAIL — módulos não existem.

- [ ] **Step 4: Domínio e portas**

```ts
// src/server/invitations/domain/invitation.ts
import { isValidCnpj, maskCnpj, VALIDATORS } from '../../shared/domain/validation'

export const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const TOKEN_LENGTH = 10
export const NAME_OR_CNPJ_REQUIRED = 'Informe ao menos o nome da empresa ou o CNPJ — o link serve para amarrar a resposta a alguém.'
export const INVITATION_IN_USE = 'Não consegui apagar o convite: convite já usado.'

const TOKEN_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/

export interface InvitationInput {
  companyName: string
  cnpj: string
  email: string
}

export const tokenFromBytes = (bytes: Uint8Array): string =>
  Array.from(bytes.slice(0, TOKEN_LENGTH), (byte) => TOKEN_ALPHABET.charAt(byte % TOKEN_ALPHABET.length)).join('')

export const isInvitationToken = (value: string): boolean => TOKEN_PATTERN.test(value)

export function normalizeInvitation(
  input: InvitationInput,
): { ok: true; value: { companyName: string | null; cnpj: string | null; email: string | null } } | { ok: false; message: string } {
  const companyName = input.companyName.trim()
  const cnpj = input.cnpj.trim()
  const email = input.email.trim()
  if (!companyName && !cnpj) return { ok: false, message: NAME_OR_CNPJ_REQUIRED }
  if (cnpj && !isValidCnpj(cnpj)) return { ok: false, message: VALIDATORS.cnpj.error }
  return { ok: true, value: { companyName: companyName || null, cnpj: cnpj ? maskCnpj(cnpj) : null, email: email || null } }
}

export function invitationLinks(baseUrl: string, token: string): { diagnosis: string; adhesion: string } {
  const base = baseUrl.replace(/\/+$/, '')
  return { diagnosis: `${base}/diagnosis?invite=${token}`, adhesion: `${base}/adhesion?invite=${token}` }
}
```

No teste de domínio, os bytes `0,1` dão `A,B`; `31` e `255 % 32 = 31` dão `9` (último caractere); `32,33` voltam a `A,B`; `8,9,10,11` dão `J,K,L,M` (o alfabeto pula `I`); o 11º byte é ignorado.

```ts
// src/server/invitations/ports/invitation-repository.ts
export interface InvitationRecord {
  token: string
  companyName: string | null
  cnpj: string | null
  email: string | null
  note: string | null
  openCount: number
  lastOpenedAt: Date | null
  createdAt: Date
  createdBy: string | null
  responseCount: number
  adhesionCount: number
}

export interface InvitationRepository {
  exists(token: string): Promise<boolean>
  create(input: { token: string; companyName: string | null; cnpj: string | null; email: string | null; createdById: string | null }): Promise<InvitationRecord>
  find(token: string): Promise<InvitationRecord | null>
  list(): Promise<InvitationRecord[]>
  delete(token: string): Promise<void>
  registerOpening(token: string, draftId: string, at: Date): Promise<boolean>
}
```

```ts
// src/server/invitations/ports/token-source.ts
export interface TokenSource {
  next(): string
}
```

- [ ] **Step 5: Caso de uso**

```ts
// src/server/invitations/application/manage-invitations.ts
import { INVITATION_IN_USE, invitationLinks, isInvitationToken, normalizeInvitation, type InvitationInput } from '../domain/invitation'
import type { InvitationRecord, InvitationRepository } from '../ports/invitation-repository'
import type { TokenSource } from '../ports/token-source'

export type InvitationActor = { id: string; username: string }
export type InvitationPrefill = { token: string; companyName: string | null; cnpj: string | null }
export type InvitationView = Omit<InvitationRecord, 'note' | 'lastOpenedAt' | 'createdAt'> & {
  lastOpenedAt: string | null
  createdAt: string
  links: { diagnosis: string; adhesion: string }
}
type AuditRecorder = (entry: {
  action: 'invitation_created' | 'invitation_deleted'
  actorId: string
  actorUsername: string
  reference: string
  detail?: Record<string, unknown>
}) => Promise<void>

export function makeInvitations({ repository, tokens, recordAudit, baseUrl, now = () => new Date() }: {
  repository: InvitationRepository
  tokens: TokenSource
  recordAudit: AuditRecorder
  baseUrl: string
  now?: () => Date
}) {
  const view = (record: InvitationRecord): InvitationView => ({
    token: record.token,
    companyName: record.companyName,
    cnpj: record.cnpj,
    email: record.email,
    openCount: record.openCount,
    lastOpenedAt: record.lastOpenedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    responseCount: record.responseCount,
    adhesionCount: record.adhesionCount,
    links: invitationLinks(baseUrl, record.token),
  })

  async function freshToken(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const token = tokens.next()
      if (!(await repository.exists(token))) return token
    }
    throw new Error('não foi possível sortear um token de convite livre')
  }

  return {
    async createInvitation(actor: InvitationActor, input: InvitationInput) {
      const normalized = normalizeInvitation(input)
      if (!normalized.ok) return normalized
      const record = await repository.create({ token: await freshToken(), ...normalized.value, createdById: actor.id })
      await recordAudit({ action: 'invitation_created', actorId: actor.id, actorUsername: actor.username, reference: record.token, detail: { companyName: record.companyName, cnpj: record.cnpj } })
      return { ok: true as const, invitation: view(record) }
    },

    listInvitations: async () => (await repository.list()).map(view),

    async deleteInvitation(actor: InvitationActor, token: string) {
      const record = await repository.find(token)
      if (!record) return { ok: true as const }
      if (record.responseCount > 0 || record.adhesionCount > 0) return { ok: false as const, message: INVITATION_IN_USE }
      await repository.delete(token)
      await recordAudit({ action: 'invitation_deleted', actorId: actor.id, actorUsername: actor.username, reference: token })
      return { ok: true as const }
    },

    openInvitation: async (token: string, draftId: string) =>
      isInvitationToken(token) ? repository.registerOpening(token, draftId, now()) : false,

    async invitationPrefill(token: string): Promise<InvitationPrefill | null> {
      if (!isInvitationToken(token)) return null
      const record = await repository.find(token)
      return record ? { token: record.token, companyName: record.companyName, cnpj: record.cnpj } : null
    },
  }
}
```

- [ ] **Step 6: Adaptadores e composição**

```ts
// src/server/invitations/adapters/prisma-invitation-repository.ts
import { prisma } from '@/server/shared/prisma/client'
import type { InvitationGetPayload } from '@/server/shared/prisma/generated/models'
import type { InvitationRecord, InvitationRepository } from '../ports/invitation-repository'

const include = { createdBy: { select: { username: true } }, _count: { select: { responses: true, adhesions: true } } } as const

type Row = InvitationGetPayload<{ include: typeof include }>

const toRecord = (row: Row): InvitationRecord => ({
  token: row.token,
  companyName: row.companyName,
  cnpj: row.cnpj,
  email: row.email,
  note: row.note,
  openCount: row.openCount,
  lastOpenedAt: row.lastOpenedAt,
  createdAt: row.createdAt,
  createdBy: row.createdBy?.username ?? null,
  responseCount: row._count.responses,
  adhesionCount: row._count.adhesions,
})

export const prismaInvitationRepository: InvitationRepository = {
  exists: async (token) => (await prisma.invitation.count({ where: { token } })) > 0,
  create: async (input) => toRecord(await prisma.invitation.create({ data: input, include })),
  find: async (token) => {
    const row = await prisma.invitation.findUnique({ where: { token }, include })
    return row ? toRecord(row) : null
  },
  list: async () => (await prisma.invitation.findMany({ include, orderBy: { createdAt: 'desc' } })).map(toRecord),
  delete: async (token) => void (await prisma.invitation.deleteMany({ where: { token } })),
  registerOpening: (token, draftId, at) =>
    prisma.$transaction(async (tx) => {
      if (!(await tx.invitation.count({ where: { token } }))) return false
      const marked = await tx.diagnosisDraft.updateMany({ where: { id: draftId, invitationOpened: false }, data: { invitationOpened: true, invitationToken: token } })
      if (marked.count === 0) return false
      await tx.invitation.update({ where: { token }, data: { openCount: { increment: 1 }, lastOpenedAt: at } })
      return true
    }),
}
```

```ts
// src/server/invitations/adapters/random-token-source.ts
import { randomBytes } from 'node:crypto'
import { TOKEN_LENGTH, tokenFromBytes } from '../domain/invitation'
import type { TokenSource } from '../ports/token-source'

export const randomTokenSource: TokenSource = { next: () => tokenFromBytes(randomBytes(TOKEN_LENGTH)) }
```

```ts
// src/server/invitations/composition.ts
import { recordAudit } from '@/server/audit/composition'
import { getEnv } from '@/server/shared/env'
import { prismaInvitationRepository } from './adapters/prisma-invitation-repository'
import { randomTokenSource } from './adapters/random-token-source'
import { makeInvitations } from './application/manage-invitations'

const invitations = makeInvitations({
  repository: prismaInvitationRepository,
  tokens: randomTokenSource,
  recordAudit,
  baseUrl: getEnv().APP_PUBLIC_URL,
})

export const createInvitation = invitations.createInvitation
export const listInvitations = invitations.listInvitations
export const deleteInvitation = invitations.deleteInvitation
export const openInvitation = invitations.openInvitation
export const invitationPrefill = invitations.invitationPrefill
export type { InvitationActor, InvitationPrefill, InvitationView } from './application/manage-invitations'
export type { InvitationInput } from './domain/invitation'
```

- [ ] **Step 7:** Run `pnpm vitest run src/server/invitations`. Expected: PASS (unitário e integração).
- [ ] **Step 8: Commit e merge**

```bash
git add src/server/invitations
git commit -m "feat(convites): convites com token no servidor, uma abertura por rascunho e trava de apagar convite usado"
pnpm lint && pnpm typecheck && pnpm test
git switch teste && git merge --no-ff feat/convites -m "merge: módulo de convites" && git branch -d feat/convites && git push origin teste
```

---

### Task 4: Protocolo, relógio, casos de uso do rascunho, do envio e do relatório

**Files:**
- Create: `src/server/diagnosis/domain/protocol.ts`, `src/server/diagnosis/ports/{draft-repository,response-repository,protocol-generator,clock,rate-limiter,audit-recorder,invitation-gateway,company-gateway}.ts`, `src/server/diagnosis/application/{drafts,submit-diagnosis,reports}.ts`, `src/server/diagnosis/application/testing/fakes.ts`, `src/server/diagnosis/adapters/{prisma-draft-repository,prisma-response-repository,random-protocol-generator,system-clock}.ts`, `src/server/diagnosis/composition.ts`
- Test: `src/server/diagnosis/domain/protocol.test.ts`, `src/server/diagnosis/application/drafts.test.ts`, `src/server/diagnosis/application/submit-diagnosis.test.ts`, `src/server/diagnosis/application/reports.test.ts`, `src/server/diagnosis/adapters/prisma-diagnosis.int.test.ts`

**Interfaces:**
- Consumes: Tarefa 2 (`draft-rules`, `validate-answers`, `stored-payload`, `result-view`, `report-sheets`, `company-badge`, `dates`); `diagnose`, `buildActionPlan`; `checkRateLimit` (`server/rate-limit/composition`); `recordAudit` (`server/audit/composition`); `openInvitation` (Tarefa 3); `lookupCompany` (`server/company-lookup/composition`).
- Produces:
  - `protocol.ts`: `PROTOCOL_ALPHABET`, `PROTOCOL_PATTERN`, `formatProtocol(now: Date, suffix: string): string`
  - Portas: `DraftRecord`, `DraftRepository`, `ResponseRecord`, `ResponseWrite`, `ResponseRepository`, `ProtocolGenerator { next(now: Date): string }`, `Clock { now(): Date }`, `RateLimiter { check(route: RateLimitedRoute, origin: string | null): Promise<RateLimitDecision> }`, `DiagnosisAuditRecorder`, `InvitationGateway { open(token: string, draftId: string): Promise<boolean> }`, `CompanyGateway { lookup(input: { cnpj: string; requesterName?: string }): Promise<CompanyBadgeLookup> }`
  - `@/server/diagnosis/composition`:
    - `diagnosisDrafts.loadDraft(draftId: string | null): Promise<LoadedDraft | null>` com `LoadedDraft = { draft: DraftRecord; protocol: string | null }`
    - `diagnosisDrafts.saveDraft(input: { draftId: string | null; step: number; answers: Answers; invitationToken: string | null; origin: string | null }): Promise<SaveDraftResult>` com `SaveDraftResult = { ok: true; draftId: string } | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }`
    - `diagnosisDrafts.discardDraft(draftId: string | null): Promise<void>`
    - `diagnosisDrafts.lookupCompanyForDraft(input: { draftId: string | null; cnpj: string; requesterName?: string }): Promise<CompanyBadgeLookup>`
    - `submitDiagnosis(input: { draftId: string | null; origin: string | null }): Promise<SubmitResult>` com `SubmitResult = { ok: true; protocol: string; result: ResultView; created: boolean; updated: boolean } | { ok: false; reason: 'no_draft' | 'no_consent' | 'not_applicable' } | { ok: false; reason: 'invalid'; problems: AnswerProblems } | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }`
    - `diagnosisReports.submittedReport(draftId: string | null): Promise<ReportSheets | null>`, `diagnosisReports.responseReport(id: number): Promise<ReportSheets | null>`
    - `todayIso(): string`

Rotas do rate limit: `'diagnosis-draft'` (criação do rascunho) e `'diagnosis-submit'` (envio que grava). Limites: os da fundação (5 por minuto, 30 por hora por origem), os mesmos do `/api/respostas` antigo.

- [ ] **Step 1: Branch** — `git switch teste && git pull --ff-only && git switch -c feat/envio-do-diagnostico`

- [ ] **Step 2: Portas**

```ts
// src/server/diagnosis/ports/draft-repository.ts
import type { Answers } from '../domain/question-types'

export interface DraftRecord {
  id: string
  step: number
  answers: Answers
  requesterInQsa: boolean | null
  updatedAt: Date
  expiresAt: Date
  responseId: number | null
  invitationToken: string | null
  invitationOpened: boolean
}

export interface DraftRepository {
  find(id: string): Promise<DraftRecord | null>
  create(input: { step: number; answers: Answers; expiresAt: Date }): Promise<DraftRecord>
  save(id: string, input: { step: number; answers: Answers; requesterInQsa: boolean | null; expiresAt: Date }): Promise<void>
  setRequesterInQsa(id: string, value: boolean | null): Promise<void>
  delete(id: string): Promise<void>
  linkResponse(id: string, responseId: number): Promise<void>
}
```

```ts
// src/server/diagnosis/ports/response-repository.ts
import type { ResponseStatus } from '../domain/response-status'
import type { ResponseProjections, StoredPayload } from '../domain/stored-payload'

export interface ResponseRecord extends ResponseProjections {
  id: number
  protocol: string
  invitationToken: string | null
  receivedAt: Date
  updatedAt: Date | null
  payload: unknown
  status: ResponseStatus
  internalNote: string | null
  handledByUsername: string | null
  handledAt: Date | null
}

export interface ResponseWrite extends ResponseProjections {
  payload: StoredPayload
}

export interface ResponseRepository {
  protocolExists(protocol: string): Promise<boolean>
  create(input: ResponseWrite & { protocol: string; invitationToken: string | null; receivedAt: Date }): Promise<ResponseRecord>
  update(id: number, input: ResponseWrite & { updatedAt: Date }): Promise<void>
  findById(id: number): Promise<ResponseRecord | null>
}
```

```ts
// src/server/diagnosis/ports/protocol-generator.ts
export interface ProtocolGenerator {
  next(now: Date): string
}
```

```ts
// src/server/diagnosis/ports/clock.ts
export interface Clock {
  now(): Date
}
```

```ts
// src/server/diagnosis/ports/rate-limiter.ts
export type RateLimitedRoute = 'diagnosis-draft' | 'diagnosis-submit'
export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number }

export interface RateLimiter {
  check(route: RateLimitedRoute, origin: string | null): Promise<RateLimitDecision>
}
```

```ts
// src/server/diagnosis/ports/audit-recorder.ts
export type DiagnosisAuditRecorder = (entry: {
  action: 'response_received' | 'response_updated' | 'response_handled' | 'spreadsheet_exported'
  actorId?: string | null
  actorUsername?: string | null
  reference: string
  detail: Record<string, unknown>
}) => Promise<void>
```

```ts
// src/server/diagnosis/ports/invitation-gateway.ts
export interface InvitationGateway {
  open(token: string, draftId: string): Promise<boolean>
}
```

```ts
// src/server/diagnosis/ports/company-gateway.ts
import type { CompanyBadgeLookup } from '../domain/company-badge'

export interface CompanyGateway {
  lookup(input: { cnpj: string; requesterName?: string }): Promise<CompanyBadgeLookup>
}
```

- [ ] **Step 3: Fakes compartilhados pelos testes de aplicação**

```ts
// src/server/diagnosis/application/testing/fakes.ts
import type { Answers } from '../../domain/question-types'
import type { DraftRecord, DraftRepository } from '../../ports/draft-repository'
import type { ResponseRecord, ResponseRepository } from '../../ports/response-repository'
import type { RateLimitDecision, RateLimiter } from '../../ports/rate-limiter'

export function fakeClock(start: string) {
  let current = new Date(start)
  return { now: () => current, set: (iso: string) => void (current = new Date(iso)) }
}

export function memoryDrafts() {
  const rows = new Map<string, DraftRecord>()
  const repository: DraftRepository = {
    find: async (id) => rows.get(id) ?? null,
    create: async ({ step, answers, expiresAt }) => {
      const record: DraftRecord = { id: crypto.randomUUID(), step, answers, requesterInQsa: null, updatedAt: new Date(), expiresAt, responseId: null, invitationToken: null, invitationOpened: false }
      rows.set(record.id, record)
      return record
    },
    save: async (id, input) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, ...input })
    },
    setRequesterInQsa: async (id, value) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, requesterInQsa: value })
    },
    delete: async (id) => void rows.delete(id),
    linkResponse: async (id, responseId) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, responseId })
    },
  }
  const patch = (id: string, extra: Partial<DraftRecord>) => {
    const row = rows.get(id)
    if (row) rows.set(id, { ...row, ...extra })
  }
  const seed = (answers: Answers, extra: Partial<DraftRecord> = {}) => {
    const record: DraftRecord = { id: crypto.randomUUID(), step: 7, answers, requesterInQsa: null, updatedAt: new Date(), expiresAt: new Date('2030-01-01T00:00:00Z'), responseId: null, invitationToken: null, invitationOpened: false, ...extra }
    rows.set(record.id, record)
    return record
  }
  return { rows, repository, seed, patch }
}

export function memoryResponses() {
  const rows = new Map<number, ResponseRecord>()
  let sequence = 0
  const repository: ResponseRepository = {
    protocolExists: async (protocol) => [...rows.values()].some((row) => row.protocol === protocol),
    create: async (input) => {
      const record: ResponseRecord = { ...input, id: ++sequence, updatedAt: null, status: 'new', internalNote: null, handledByUsername: null, handledAt: null }
      rows.set(record.id, record)
      return record
    },
    update: async (id, input) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, ...input })
    },
    findById: async (id) => rows.get(id) ?? null,
  }
  return { rows, repository }
}

export function fakeRateLimiter(decisions: RateLimitDecision[] = []) {
  const calls: string[] = []
  const limiter: RateLimiter = {
    check: async (route) => {
      calls.push(route)
      return decisions.shift() ?? { allowed: true }
    },
  }
  return { calls, limiter }
}
```

- [ ] **Step 4: Testes que falham**

```ts
// src/server/diagnosis/domain/protocol.test.ts
import { describe, expect, it } from 'vitest'
import { PROTOCOL_PATTERN, formatProtocol } from './protocol'

describe('protocol', () => {
  it('uses the Brasília date, not the UTC one', () => {
    expect(formatProtocol(new Date('2026-10-01T02:30:00Z'), 'AB12')).toBe('DS-260930-AB12')
    expect(formatProtocol(new Date('2026-10-01T03:00:00Z'), 'AB12')).toBe('DS-261001-AB12')
    expect(PROTOCOL_PATTERN.test('DS-261001-AB12')).toBe(true)
  })
})
```

```ts
// src/server/diagnosis/application/drafts.test.ts
import { describe, expect, it } from 'vitest'
import { makeDraftUseCases } from './drafts'
import { fakeClock, fakeRateLimiter, memoryDrafts, memoryResponses } from './testing/fakes'

function setup(decisions: Parameters<typeof fakeRateLimiter>[0] = []) {
  const drafts = memoryDrafts()
  const responses = memoryResponses()
  const clock = fakeClock('2026-09-20T12:00:00Z')
  const rate = fakeRateLimiter(decisions)
  const opened: [string, string][] = []
  const useCases = makeDraftUseCases({
    drafts: drafts.repository,
    responses: responses.repository,
    clock,
    rateLimiter: rate.limiter,
    invitations: { open: async (token, draftId) => (opened.push([token, draftId]), token === 'ABCDEFGHJK') },
    companies: { lookup: async ({ requesterName }) => ({ ok: true, company: { legalName: 'X', city: '', state: '', simplesOptant: true, meiOptant: false, active: true, registrationStatus: 'ATIVA' }, requesterInQsa: requesterName ? true : null }) },
  })
  return { drafts, responses, clock, rate, opened, useCases }
}

describe('draft use cases', () => {
  it('creates the draft on the first save only, under the rate limit, without internal keys', async () => {
    const { useCases, drafts, rate } = setup()
    const first = await useCases.saveDraft({ draftId: null, step: 1, answers: { versaoFormulario: 'sintetico', _cadastro: 'x' }, invitationToken: null, origin: '1.1.1.1' })
    expect(first.ok).toBe(true)
    const id = first.ok ? first.draftId : ''
    expect(drafts.rows.get(id)?.answers).toEqual({ versaoFormulario: 'sintetico' })
    const second = await useCases.saveDraft({ draftId: id, step: 2, answers: { versaoFormulario: 'completo' }, invitationToken: null, origin: '1.1.1.1' })
    expect(second).toEqual({ ok: true, draftId: id })
    expect(drafts.rows.size).toBe(1)
    expect(drafts.rows.get(id)?.step).toBe(2)
    expect(rate.calls).toEqual(['diagnosis-draft'])
  })

  it('refuses to create a draft when the origin is over the limit', async () => {
    const { useCases, drafts } = setup([{ allowed: false, retryAfterSeconds: 42 }])
    expect(await useCases.saveDraft({ draftId: null, step: 1, answers: { a: 'b' }, invitationToken: null, origin: null }))
      .toEqual({ ok: false, reason: 'rate_limited', retryAfterSeconds: 42 })
    expect(drafts.rows.size).toBe(0)
  })

  it('opens the invitation through the gateway until the draft carries a token', async () => {
    const { useCases, opened, drafts } = setup()
    const saved = await useCases.saveDraft({ draftId: null, step: 1, answers: { a: 'b' }, invitationToken: 'ABCDEFGHJK', origin: null })
    const id = saved.ok ? saved.draftId : ''
    expect(opened).toEqual([['ABCDEFGHJK', id]])
    drafts.patch(id, { invitationToken: 'ABCDEFGHJK', invitationOpened: true })
    await useCases.saveDraft({ draftId: id, step: 1, answers: { a: 'c' }, invitationToken: 'ABCDEFGHJK', origin: null })
    expect(opened).toHaveLength(1)
  })

  it('deletes an expired draft when it is accessed and ignores ids that are not uuids', async () => {
    const { useCases, drafts, clock } = setup()
    const record = drafts.seed({ a: 'b' }, { expiresAt: new Date('2026-09-21T00:00:00Z') })
    expect(await useCases.loadDraft(record.id)).toMatchObject({ draft: { id: record.id }, protocol: null })
    clock.set('2026-09-21T00:00:01Z')
    expect(await useCases.loadDraft(record.id)).toBeNull()
    expect(drafts.rows.has(record.id)).toBe(false)
    expect(await useCases.loadDraft('nao-e-uuid')).toBeNull()
    expect(await useCases.loadDraft(crypto.randomUUID())).toBeNull()
  })

  it('returns the protocol of a draft already submitted', async () => {
    const { useCases, drafts, responses } = setup()
    const response = await responses.repository.create({ protocol: 'DS-260920-AB12', invitationToken: null, receivedAt: new Date(), payload: { answers: {}, engine: { outcome: '', position: '', certainty: '', urgency: '', confidence: '', gaps: [], triggers: [], openPoints: [] }, requesterInQsa: null, formVersion: null }, companyName: null, cnpj: null, cnpjDigits: null, requester: null, email: null, phone: null, formVersion: null, outcome: null, position: null, certainty: null, urgency: null, confidence: null, requesterInQsa: null })
    const record = drafts.seed({ a: 'b' }, { responseId: response.id })
    expect((await useCases.loadDraft(record.id))?.protocol).toBe('DS-260920-AB12')
  })

  it('discards the draft', async () => {
    const { useCases, drafts } = setup()
    const record = drafts.seed({ a: 'b' })
    await useCases.discardDraft(record.id)
    expect(drafts.rows.size).toBe(0)
  })

  it('stores only the QSA check on the draft, never the partners', async () => {
    const { useCases, drafts } = setup()
    const record = drafts.seed({ a: 'b' })
    const result = await useCases.lookupCompanyForDraft({ draftId: record.id, cnpj: '11222333000181', requesterName: 'Maria' })
    expect(result.ok).toBe(true)
    expect(drafts.rows.get(record.id)?.requesterInQsa).toBe(true)
    expect(JSON.stringify(result)).not.toMatch(/partner|socio/i)
  })
})
```

```ts
// src/server/diagnosis/application/submit-diagnosis.test.ts
import { describe, expect, it } from 'vitest'
import { buildActionPlan } from '../domain/action-plan'
import { diagnose } from '../domain/diagnose'
import { readStoredPayload } from '../domain/stored-payload'
import { applicableFill } from '../domain/testing/applicable-fill'
import { makeSubmitDiagnosis } from './submit-diagnosis'
import { fakeClock, fakeRateLimiter, memoryDrafts, memoryResponses } from './testing/fakes'

const answers = applicableFill(7)

function setup(decisions: Parameters<typeof fakeRateLimiter>[0] = []) {
  const drafts = memoryDrafts()
  const responses = memoryResponses()
  const clock = fakeClock('2026-10-01T02:30:00Z')
  const rate = fakeRateLimiter(decisions)
  const audits: { action: string; reference: string }[] = []
  const suffixes = ['AAAA', 'AAAA', 'BBBB']
  const submit = makeSubmitDiagnosis({
    drafts: drafts.repository,
    responses: responses.repository,
    protocols: { next: (now) => `DS-${now.toISOString().slice(2, 4)}0930-${suffixes.shift() ?? 'ZZZZ'}` },
    clock,
    rateLimiter: rate.limiter,
    recordAudit: async (entry) => void audits.push(entry),
  })
  return { drafts, responses, clock, rate, audits, submit }
}

describe('submitDiagnosis', () => {
  it('recalculates on the server from the stored draft, creates once and links the draft', async () => {
    const { submit, drafts, responses, audits, clock } = setup()
    const draft = drafts.seed(answers, { invitationToken: 'ABCDEFGHJK', requesterInQsa: false })
    const result = await submit({ draftId: draft.id, origin: '1.1.1.1' })
    expect(result).toMatchObject({ ok: true, created: true, updated: false })
    const [stored] = [...responses.rows.values()]
    const expected = diagnose(answers, clock.now())
    expect(readStoredPayload(stored?.payload).engine).toMatchObject({ outcome: expected.outcome.code, position: expected.position.label, triggers: expected.triggers })
    expect(stored).toMatchObject({ invitationToken: 'ABCDEFGHJK', requesterInQsa: false, outcome: expected.outcome.code })
    expect(drafts.rows.get(draft.id)?.responseId).toBe(stored?.id)
    expect(audits.map((a) => a.action)).toEqual(['response_received'])
    expect(result.ok && result.result.plan.clientNow).toEqual(buildActionPlan(answers, expected).clientNow)
  })

  it('skips a protocol that already exists', async () => {
    const { submit, drafts } = setup()
    const first = await submit({ draftId: drafts.seed(answers).id, origin: null })
    const second = await submit({ draftId: drafts.seed(answers).id, origin: null })
    expect([first.ok && first.protocol, second.ok && second.protocol]).toEqual(['DS-260930-AAAA', 'DS-260930-BBBB'])
  })

  it('does nothing when the answers did not change (F5 on the result)', async () => {
    const { submit, drafts, responses, audits, rate } = setup()
    const draft = drafts.seed(answers)
    await submit({ draftId: draft.id, origin: null })
    const again = await submit({ draftId: draft.id, origin: null })
    expect(again).toMatchObject({ ok: true, created: false, updated: false })
    expect(responses.rows.size).toBe(1)
    expect(audits).toHaveLength(1)
    expect(rate.calls).toEqual(['diagnosis-submit'])
  })

  it('updates the same response, keeping protocol and receivedAt', async () => {
    const { submit, drafts, responses, audits, clock } = setup()
    const draft = drafts.seed(answers)
    const first = await submit({ draftId: draft.id, origin: null })
    const receivedAt = [...responses.rows.values()][0]?.receivedAt
    clock.set('2026-10-02T15:00:00Z')
    drafts.patch(draft.id, { answers: { ...answers, telefone: '(34) 98888-7777' } })
    const second = await submit({ draftId: draft.id, origin: null })
    expect(second).toMatchObject({ ok: true, created: false, updated: true, protocol: first.ok ? first.protocol : '' })
    const [stored] = [...responses.rows.values()]
    expect(responses.rows.size).toBe(1)
    expect(stored?.receivedAt).toEqual(receivedAt)
    expect(stored?.updatedAt).toEqual(new Date('2026-10-02T15:00:00Z'))
    expect(stored?.phone).toBe('(34) 98888-7777')
    expect(audits.map((a) => a.action)).toEqual(['response_received', 'response_updated'])
  })

  it('refuses without consent, outside the scope, with invalid answers or without a draft', async () => {
    const { submit, drafts, responses } = setup()
    expect(await submit({ draftId: drafts.seed({ ...answers, aceiteLgpd: '' }).id, origin: null })).toEqual({ ok: false, reason: 'no_consent' })
    expect(await submit({ draftId: drafts.seed({ ...answers, ehSimei: 'sim' }).id, origin: null })).toEqual({ ok: false, reason: 'not_applicable' })
    expect(await submit({ draftId: drafts.seed({ ...answers, email: 'x' }).id, origin: null })).toMatchObject({ ok: false, reason: 'invalid', problems: { email: 'E-mail inválido.' } })
    expect(await submit({ draftId: null, origin: null })).toEqual({ ok: false, reason: 'no_draft' })
    expect(await submit({ draftId: drafts.seed(answers, { expiresAt: new Date('2026-09-01T00:00:00Z') }).id, origin: null })).toEqual({ ok: false, reason: 'no_draft' })
    expect(responses.rows.size).toBe(0)
  })

  it('answers 429 data when the origin is over the limit', async () => {
    const { submit, drafts, responses } = setup([{ allowed: false, retryAfterSeconds: 30 }])
    expect(await submit({ draftId: drafts.seed(answers).id, origin: '1.1.1.1' })).toEqual({ ok: false, reason: 'rate_limited', retryAfterSeconds: 30 })
    expect(responses.rows.size).toBe(0)
  })
})
```

O fake de protocolo do teste só concatena um sufixo; quem prova a data de Brasília é `protocol.test.ts` e o adaptador real.

```ts
// src/server/diagnosis/application/reports.test.ts
import { describe, expect, it } from 'vitest'
import { buildStoredPayload } from '../domain/stored-payload'
import { diagnose } from '../domain/diagnose'
import { applicableFill } from '../domain/testing/applicable-fill'
import { makeReports } from './reports'
import { fakeClock, memoryDrafts, memoryResponses } from './testing/fakes'

const answers = applicableFill(11)

describe('reports', () => {
  it('builds the report of the submitted version, not of later unsent edits', async () => {
    const drafts = memoryDrafts()
    const responses = memoryResponses()
    const clock = fakeClock('2026-09-20T12:00:00Z')
    const payload = buildStoredPayload(answers, diagnose(answers, clock.now()), null)
    const created = await responses.repository.create({ protocol: 'DS-260920-AB12', invitationToken: null, receivedAt: clock.now(), payload, companyName: null, cnpj: null, cnpjDigits: null, requester: null, email: null, phone: null, formVersion: null, outcome: null, position: null, certainty: null, urgency: null, confidence: null, requesterInQsa: null })
    const draft = drafts.seed({ ...answers, nomeEmpresa: 'Editado e não enviado' }, { responseId: created.id })
    const reports = makeReports({ drafts: drafts.repository, responses: responses.repository, clock })
    const sheets = await reports.submittedReport(draft.id)
    expect(sheets?.cover.protocol).toBe('DS-260920-AB12')
    expect(sheets?.cover.company).toBe(String(answers.nomeEmpresa))
    expect(await reports.submittedReport(drafts.seed(answers).id)).toBeNull()
    expect((await reports.responseReport(created.id))?.fileName).toMatch(/^Plano-De-Acao-SN-/)
    expect(await reports.responseReport(999)).toBeNull()
  })
})
```

```ts
// src/server/diagnosis/adapters/prisma-diagnosis.int.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import { makeDraftUseCases } from '../application/drafts'
import { prismaDraftRepository } from './prisma-draft-repository'
import { prismaResponseRepository } from './prisma-response-repository'
import { createRandomProtocolGenerator } from './random-protocol-generator'

const engine = { outcome: 'B', position: 'Simples híbrido', certainty: 'aberta', urgency: 'ALTA', confidence: 'MÉDIA', gaps: [], triggers: [], openPoints: [] }
const projections = { companyName: 'Empresa', cnpj: '11.222.333/0001-81', cnpjDigits: '11222333000181', requester: 'Maria', email: 'a@b.com', phone: null, formVersion: 'sintetico', outcome: 'B', position: 'Simples híbrido', certainty: 'aberta', urgency: 'ALTA', confidence: 'MÉDIA', requesterInQsa: true }

describe('diagnosis persistence', () => {
  beforeEach(resetDatabase)

  it('creates, saves, links and deletes drafts', async () => {
    const draft = await prismaDraftRepository.create({ step: 1, answers: { versaoFormulario: 'sintetico' }, expiresAt: new Date(Date.now() + 86_400_000) })
    await prismaDraftRepository.setRequesterInQsa(draft.id, true)
    await prismaDraftRepository.save(draft.id, { step: 3, answers: { versaoFormulario: 'completo' }, requesterInQsa: true, expiresAt: new Date(Date.now() + 2 * 86_400_000) })
    expect(await prismaDraftRepository.find(draft.id)).toMatchObject({ step: 3, answers: { versaoFormulario: 'completo' }, requesterInQsa: true, responseId: null })
    await prismaDraftRepository.delete(draft.id)
    await prismaDraftRepository.delete(draft.id)
    expect(await prismaDraftRepository.find(draft.id)).toBeNull()
  })

  it('deletes an expired draft on access and treats a cookie without row as no draft', async () => {
    const useCases = makeDraftUseCases({
      drafts: prismaDraftRepository,
      responses: prismaResponseRepository,
      clock: { now: () => new Date() },
      rateLimiter: { check: async () => ({ allowed: true }) },
      invitations: { open: async () => false },
      companies: { lookup: async () => ({ ok: false, reason: 'indisponível' }) },
    })
    const expired = await prismaDraftRepository.create({ step: 1, answers: {}, expiresAt: new Date(Date.now() - 1000) })
    expect(await useCases.loadDraft(expired.id)).toBeNull()
    expect(await prisma.diagnosisDraft.count()).toBe(0)
    expect(await useCases.loadDraft('1b4e28ba-2fa1-11d2-883f-0016d3cca427')).toBeNull()
  })

  it('creates and updates a response, dropping an invitation token that does not exist', async () => {
    const payload = { answers: { nomeEmpresa: 'Empresa' }, engine, requesterInQsa: true, formVersion: 'sintetico' }
    const created = await prismaResponseRepository.create({ ...projections, payload, protocol: 'DS-260920-AB12', invitationToken: 'QQQQQQQQQQ', receivedAt: new Date('2026-09-20T12:00:00Z') })
    expect(created).toMatchObject({ protocol: 'DS-260920-AB12', invitationToken: null, status: 'new', updatedAt: null })
    expect(await prismaResponseRepository.protocolExists('DS-260920-AB12')).toBe(true)
    await prismaResponseRepository.update(created.id, { ...projections, phone: '(34) 98888-7777', payload, updatedAt: new Date('2026-09-21T12:00:00Z') })
    expect(await prismaResponseRepository.findById(created.id)).toMatchObject({ phone: '(34) 98888-7777', updatedAt: new Date('2026-09-21T12:00:00Z'), receivedAt: new Date('2026-09-20T12:00:00Z') })
  })

  it('generates protocols in the DS-AAMMDD-XXXX format', () => {
    const generator = createRandomProtocolGenerator()
    expect(generator.next(new Date('2026-10-01T02:30:00Z'))).toMatch(/^DS-260930-[A-Z0-9]{4}$/)
  })
})
```

- [ ] **Step 5:** Run `pnpm vitest run src/server/diagnosis`. Expected: FAIL — `protocol`, `drafts`, `submit-diagnosis`, `reports` e os adaptadores não existem.

- [ ] **Step 6: Protocolo e casos de uso**

```ts
// src/server/diagnosis/domain/protocol.ts
import { brasiliaDateParts } from './dates'

export const PROTOCOL_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const PROTOCOL_PATTERN = /^DS-\d{6}-[A-Z0-9]{4}$/

export function formatProtocol(now: Date, suffix: string): string {
  const { year, month, day } = brasiliaDateParts(now)
  return `DS-${year.slice(2)}${month}${day}-${suffix}`
}
```

```ts
// src/server/diagnosis/application/drafts.ts
import { DRAFT_ID_PATTERN, clampStep, draftExpiry, isDraftExpired, stripInternalKeys } from '../domain/draft-rules'
import type { Answers } from '../domain/question-types'
import type { Clock } from '../ports/clock'
import type { CompanyGateway } from '../ports/company-gateway'
import type { DraftRecord, DraftRepository } from '../ports/draft-repository'
import type { InvitationGateway } from '../ports/invitation-gateway'
import type { RateLimiter } from '../ports/rate-limiter'
import type { ResponseRepository } from '../ports/response-repository'

export type LoadedDraft = { draft: DraftRecord; protocol: string | null }
export type SaveDraftResult = { ok: true; draftId: string } | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }

export async function currentDraft(drafts: DraftRepository, clock: Clock, draftId: string | null): Promise<DraftRecord | null> {
  if (!draftId || !DRAFT_ID_PATTERN.test(draftId)) return null
  const draft = await drafts.find(draftId)
  if (!draft) return null
  if (isDraftExpired(draft.expiresAt, clock.now())) {
    await drafts.delete(draft.id)
    return null
  }
  return draft
}

export function makeDraftUseCases({ drafts, responses, clock, rateLimiter, invitations, companies }: {
  drafts: DraftRepository
  responses: ResponseRepository
  clock: Clock
  rateLimiter: RateLimiter
  invitations: InvitationGateway
  companies: CompanyGateway
}) {
  return {
    async loadDraft(draftId: string | null): Promise<LoadedDraft | null> {
      const draft = await currentDraft(drafts, clock, draftId)
      if (!draft) return null
      const response = draft.responseId ? await responses.findById(draft.responseId) : null
      return { draft, protocol: response?.protocol ?? null }
    },

    async saveDraft(input: { draftId: string | null; step: number; answers: Answers; invitationToken: string | null; origin: string | null }): Promise<SaveDraftResult> {
      const answers = stripInternalKeys(input.answers)
      const step = clampStep(input.step)
      const expiresAt = draftExpiry(clock.now())
      const existing = await currentDraft(drafts, clock, input.draftId)
      let draftId: string
      if (existing) {
        await drafts.save(existing.id, { step, answers, requesterInQsa: existing.requesterInQsa, expiresAt })
        draftId = existing.id
      } else {
        const decision = await rateLimiter.check('diagnosis-draft', input.origin)
        if (!decision.allowed) return { ok: false, reason: 'rate_limited', retryAfterSeconds: decision.retryAfterSeconds }
        draftId = (await drafts.create({ step, answers, expiresAt })).id
      }
      if (input.invitationToken && !existing?.invitationToken) await invitations.open(input.invitationToken, draftId)
      return { ok: true, draftId }
    },

    async discardDraft(draftId: string | null): Promise<void> {
      if (draftId && DRAFT_ID_PATTERN.test(draftId)) await drafts.delete(draftId)
    },

    async lookupCompanyForDraft(input: { draftId: string | null; cnpj: string; requesterName?: string }) {
      const result = await companies.lookup({ cnpj: input.cnpj, requesterName: input.requesterName })
      const draft = await currentDraft(drafts, clock, input.draftId)
      if (draft) await drafts.setRequesterInQsa(draft.id, result.ok ? result.requesterInQsa : null)
      return result
    },
  }
}
```

```ts
// src/server/diagnosis/application/submit-diagnosis.ts
import { buildActionPlan } from '../domain/action-plan'
import { diagnose } from '../domain/diagnose'
import { sameAnswers, triageReason } from '../domain/draft-rules'
import { resultView, type ResultView } from '../domain/result-view'
import { buildStoredPayload, readStoredPayload, responseProjections } from '../domain/stored-payload'
import { validateAnswers, type AnswerProblems } from '../domain/validate-answers'
import type { DiagnosisAuditRecorder } from '../ports/audit-recorder'
import type { Clock } from '../ports/clock'
import type { DraftRepository } from '../ports/draft-repository'
import type { ProtocolGenerator } from '../ports/protocol-generator'
import type { RateLimiter } from '../ports/rate-limiter'
import type { ResponseRepository } from '../ports/response-repository'
import { currentDraft } from './drafts'

export type SubmitResult =
  | { ok: true; protocol: string; result: ResultView; created: boolean; updated: boolean }
  | { ok: false; reason: 'no_draft' | 'no_consent' | 'not_applicable' }
  | { ok: false; reason: 'invalid'; problems: AnswerProblems }
  | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }

export function makeSubmitDiagnosis(deps: {
  drafts: DraftRepository
  responses: ResponseRepository
  protocols: ProtocolGenerator
  clock: Clock
  rateLimiter: RateLimiter
  recordAudit: DiagnosisAuditRecorder
}) {
  async function uniqueProtocol(now: Date): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const protocol = deps.protocols.next(now)
      if (!(await deps.responses.protocolExists(protocol))) return protocol
    }
    throw new Error('não foi possível sortear um protocolo livre')
  }

  return async function submitDiagnosis({ draftId, origin }: { draftId: string | null; origin: string | null }): Promise<SubmitResult> {
    const draft = await currentDraft(deps.drafts, deps.clock, draftId)
    if (!draft) return { ok: false, reason: 'no_draft' }
    const { answers } = draft
    if (answers.aceiteLgpd !== 'sim') return { ok: false, reason: 'no_consent' }
    if (triageReason(answers)) return { ok: false, reason: 'not_applicable' }
    const problems = validateAnswers(answers)
    if (Object.keys(problems).length) return { ok: false, reason: 'invalid', problems }

    const now = deps.clock.now()
    const diagnosis = diagnose(answers, now)
    const result = resultView(diagnosis, buildActionPlan(answers, diagnosis))
    const existing = draft.responseId ? await deps.responses.findById(draft.responseId) : null
    if (existing && sameAnswers(readStoredPayload(existing.payload).answers, answers)) {
      return { ok: true, protocol: existing.protocol, result, created: false, updated: false }
    }

    const decision = await deps.rateLimiter.check('diagnosis-submit', origin)
    if (!decision.allowed) return { ok: false, reason: 'rate_limited', retryAfterSeconds: decision.retryAfterSeconds }

    const payload = buildStoredPayload(answers, diagnosis, draft.requesterInQsa)
    const write = { ...responseProjections(payload), payload }
    const company = payload.answers.nomeEmpresa ?? null
    if (existing) {
      await deps.responses.update(existing.id, { ...write, updatedAt: now })
      await deps.recordAudit({ action: 'response_updated', reference: existing.protocol, detail: { id: existing.id, company } })
      return { ok: true, protocol: existing.protocol, result, created: false, updated: true }
    }
    const protocol = await uniqueProtocol(now)
    const created = await deps.responses.create({ ...write, protocol, invitationToken: draft.invitationToken, receivedAt: now })
    await deps.drafts.linkResponse(draft.id, created.id)
    await deps.recordAudit({ action: 'response_received', reference: protocol, detail: { id: created.id, company } })
    return { ok: true, protocol, result, created: true, updated: false }
  }
}
```

```ts
// src/server/diagnosis/application/reports.ts
import { buildActionPlan } from '../domain/action-plan'
import { diagnose } from '../domain/diagnose'
import { reportSheets, type ReportSheets } from '../domain/report-sheets'
import { readStoredPayload } from '../domain/stored-payload'
import type { Clock } from '../ports/clock'
import type { DraftRepository } from '../ports/draft-repository'
import type { ResponseRecord, ResponseRepository } from '../ports/response-repository'
import { currentDraft } from './drafts'

export function makeReports({ drafts, responses, clock }: { drafts: DraftRepository; responses: ResponseRepository; clock: Clock }) {
  function sheets(response: ResponseRecord, diagnosisDate: Date): ReportSheets {
    const { answers } = readStoredPayload(response.payload)
    const diagnosis = diagnose(answers, diagnosisDate)
    return reportSheets({ answers, protocol: response.protocol, issuedOn: clock.now() }, diagnosis, buildActionPlan(answers, diagnosis))
  }

  return {
    async submittedReport(draftId: string | null): Promise<ReportSheets | null> {
      const draft = await currentDraft(drafts, clock, draftId)
      const response = draft?.responseId ? await responses.findById(draft.responseId) : null
      return response ? sheets(response, clock.now()) : null
    },

    // The back office re-emits with the current engine on the date of the last submission, as the legacy portal did.
    async responseReport(id: number): Promise<ReportSheets | null> {
      const response = await responses.findById(id)
      return response ? sheets(response, response.updatedAt ?? response.receivedAt) : null
    },
  }
}
```

- [ ] **Step 7: Adaptadores e composição**

```ts
// src/server/diagnosis/adapters/prisma-draft-repository.ts
import type { DiagnosisDraft, Prisma } from '@/server/shared/prisma/generated/client'
import { prisma } from '@/server/shared/prisma/client'
import type { Answers } from '../domain/question-types'
import { asRecord } from '../domain/stored-payload'
import type { DraftRecord, DraftRepository } from '../ports/draft-repository'

type Row = DiagnosisDraft

const payload = (answers: Answers, requesterInQsa: boolean | null) => ({ answers, requesterInQsa }) as unknown as Prisma.InputJsonValue

const toRecord = (row: Row): DraftRecord => {
  const stored = asRecord(row.payload)
  return {
    id: row.id,
    step: row.step,
    answers: asRecord(stored.answers),
    requesterInQsa: typeof stored.requesterInQsa === 'boolean' ? stored.requesterInQsa : null,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
    responseId: row.responseId,
    invitationToken: row.invitationToken,
    invitationOpened: row.invitationOpened,
  }
}

export const prismaDraftRepository: DraftRepository = {
  find: async (id) => {
    const row = await prisma.diagnosisDraft.findUnique({ where: { id } })
    return row ? toRecord(row) : null
  },
  create: async ({ step, answers, expiresAt }) =>
    toRecord(await prisma.diagnosisDraft.create({ data: { step, payload: payload(answers, null), expiresAt } })),
  save: async (id, { step, answers, requesterInQsa, expiresAt }) =>
    void (await prisma.diagnosisDraft.update({ where: { id }, data: { step, payload: payload(answers, requesterInQsa), expiresAt } })),
  setRequesterInQsa: async (id, value) => {
    const row = await prisma.diagnosisDraft.findUnique({ where: { id } })
    if (row) await prisma.diagnosisDraft.update({ where: { id }, data: { payload: payload(toRecord(row).answers, value) } })
  },
  delete: async (id) => void (await prisma.diagnosisDraft.deleteMany({ where: { id } })),
  linkResponse: async (id, responseId) => void (await prisma.diagnosisDraft.update({ where: { id }, data: { responseId } })),
}
```

```ts
// src/server/diagnosis/adapters/prisma-response-repository.ts
import type { Prisma } from '@/server/shared/prisma/generated/client'
import type { ResponseGetPayload } from '@/server/shared/prisma/generated/models'
import { prisma } from '@/server/shared/prisma/client'
import type { ResponseRecord, ResponseRepository, ResponseWrite } from '../ports/response-repository'

export const responseInclude = { handledBy: { select: { username: true } } } as const

type Row = ResponseGetPayload<{ include: typeof responseInclude }>

export const toResponseRecord = (row: Row): ResponseRecord => ({
  id: row.id,
  protocol: row.protocol,
  invitationToken: row.invitationToken,
  receivedAt: row.receivedAt,
  updatedAt: row.updatedAt,
  companyName: row.companyName,
  cnpj: row.cnpj,
  cnpjDigits: row.cnpjDigits,
  requester: row.requester,
  email: row.email,
  phone: row.phone,
  formVersion: row.formVersion,
  outcome: row.outcome,
  position: row.position,
  certainty: row.certainty,
  urgency: row.urgency,
  confidence: row.confidence,
  requesterInQsa: row.requesterInQsa,
  payload: row.payload,
  status: row.status,
  internalNote: row.internalNote,
  handledByUsername: row.handledBy?.username ?? null,
  handledAt: row.handledAt,
})

const columns = ({ payload, ...projections }: ResponseWrite) => ({ ...projections, payload: payload as unknown as Prisma.InputJsonValue })

export const prismaResponseRepository: ResponseRepository = {
  protocolExists: async (protocol) => (await prisma.response.count({ where: { protocol } })) > 0,
  async create({ protocol, invitationToken, receivedAt, ...write }) {
    const known = invitationToken ? await prisma.invitation.count({ where: { token: invitationToken } }) : 0
    const row = await prisma.response.create({
      data: { ...columns(write), protocol, receivedAt, invitationToken: known ? invitationToken : null },
      include: responseInclude,
    })
    return toResponseRecord(row)
  },
  update: async (id, { updatedAt, ...write }) => void (await prisma.response.update({ where: { id }, data: { ...columns(write), updatedAt } })),
  findById: async (id) => {
    const row = await prisma.response.findUnique({ where: { id }, include: responseInclude })
    return row ? toResponseRecord(row) : null
  },
}
```

O token do rascunho pode apontar para um convite apagado depois da abertura; por isso o adaptador confere antes de gravar (a chave estrangeira recusaria o envio inteiro).

```ts
// src/server/diagnosis/adapters/random-protocol-generator.ts
import { randomBytes } from 'node:crypto'
import { PROTOCOL_ALPHABET, formatProtocol } from '../domain/protocol'
import type { ProtocolGenerator } from '../ports/protocol-generator'

export const createRandomProtocolGenerator = (): ProtocolGenerator => ({
  next: (now) => formatProtocol(now, Array.from(randomBytes(4), (byte) => PROTOCOL_ALPHABET.charAt(byte % PROTOCOL_ALPHABET.length)).join('')),
})
```

```ts
// src/server/diagnosis/adapters/system-clock.ts
import type { Clock } from '../ports/clock'

export const systemClock: Clock = { now: () => new Date() }
```

```ts
// src/server/diagnosis/composition.ts
import { recordAudit } from '@/server/audit/composition'
import { lookupCompany } from '@/server/company-lookup/composition'
import { openInvitation } from '@/server/invitations/composition'
import { checkRateLimit } from '@/server/rate-limit/composition'
import { prismaDraftRepository } from './adapters/prisma-draft-repository'
import { prismaResponseRepository } from './adapters/prisma-response-repository'
import { createRandomProtocolGenerator } from './adapters/random-protocol-generator'
import { systemClock } from './adapters/system-clock'
import { makeDraftUseCases } from './application/drafts'
import { makeReports } from './application/reports'
import { makeSubmitDiagnosis } from './application/submit-diagnosis'
import { toCompanyBadge } from './domain/company-badge'
import type { CompanyGateway } from './ports/company-gateway'
import type { RateLimiter } from './ports/rate-limiter'

const rateLimiter: RateLimiter = { check: (route, origin) => checkRateLimit({ route, origin }) }

const companies: CompanyGateway = {
  async lookup(input) {
    const result = await lookupCompany(input)
    return result.ok ? { ok: true, company: toCompanyBadge(result.company), requesterInQsa: result.requesterInQsa } : result
  },
}

export const diagnosisDrafts = makeDraftUseCases({
  drafts: prismaDraftRepository,
  responses: prismaResponseRepository,
  clock: systemClock,
  rateLimiter,
  invitations: { open: openInvitation },
  companies,
})

export const submitDiagnosis = makeSubmitDiagnosis({
  drafts: prismaDraftRepository,
  responses: prismaResponseRepository,
  protocols: createRandomProtocolGenerator(),
  clock: systemClock,
  rateLimiter,
  recordAudit,
})

export const diagnosisReports = makeReports({ drafts: prismaDraftRepository, responses: prismaResponseRepository, clock: systemClock })

export const todayIso = () => systemClock.now().toISOString()

export type { LoadedDraft, SaveDraftResult } from './application/drafts'
export type { SubmitResult } from './application/submit-diagnosis'
```

- [ ] **Step 8:** Run `pnpm vitest run src/server/diagnosis`. Expected: PASS.
- [ ] **Step 9: Commit e merge**

```bash
git add src/server/diagnosis
git commit -m "feat(diagnostico): rascunho no banco, envio recalculado no servidor com protocolo de Brasília e relatório da versão enviada"
pnpm lint && pnpm typecheck && pnpm test
git switch teste && git merge --no-ff feat/envio-do-diagnostico -m "merge: envio do diagnóstico" && git branch -d feat/envio-do-diagnostico && git push origin teste
```

---
### Task 5: Server functions do diagnóstico e cookie do rascunho

**Files:**
- Create: `src/server/shared/http/draft-cookie.ts`, `src/features/diagnosis/types/diagnosis.ts`, `src/features/diagnosis/api/schemas.ts`, `src/features/diagnosis/api/diagnosis.ts`, `src/features/diagnosis/api/client.ts`
- Test: `src/server/shared/http/draft-cookie.test.ts`, `src/features/diagnosis/api/schemas.test.ts`

**Interfaces:**
- Consumes: Tarefa 4 (`diagnosisDrafts`, `submitDiagnosis`, `diagnosisReports`, `todayIso`); Tarefa 3 (`invitationPrefill`); `requestOrigin` (`server/shared/http/request-origin.ts`); `getCookie`, `setCookie`, `deleteCookie`, `getRequest` (`@tanstack/react-start/server`).
- Produces:
  - `server/shared/http/draft-cookie.ts`: `DRAFT_COOKIE = 'draft_id'`, `DRAFT_COOKIE_MAX_AGE = 604800`, `draftCookieOptions(nodeEnv?: string): { httpOnly: true; sameSite: 'lax'; secure: boolean; path: '/'; maxAge: number }`, `readDraftCookie(): string | null`, `writeDraftCookie(id: string): void`, `clearDraftCookie(): void`, `requestClientIp(): string | null`
  - `features/diagnosis/types/diagnosis.ts`: `DiagnosisBootstrap`, `SaveDraftWireResult`, `SubmitWireResult`, `DiagnosisApi`
  - `features/diagnosis/api/diagnosis.ts` (server functions da spec): `loadDraft({ data: { invite?: string } }): Promise<DiagnosisBootstrap>`, `saveDraft({ data: { step, answers, invitationToken } }): Promise<SaveDraftWireResult>`, `discardDraft(): Promise<void>`, `lookupCnpj({ data: { cnpj, requesterName? } }): Promise<CompanyBadgeLookup>`, `submitDiagnosis(): Promise<SubmitWireResult>`, `getSubmittedReport(): Promise<ReportSheets | null>`
  - `features/diagnosis/api/client.ts`: `diagnosisApi: DiagnosisApi`

O cookie só carrega o id; o servidor nunca aceita respostas nem diagnóstico do navegador no envio (`submitDiagnosis` não tem entrada). `saveDraft` grava o que o navegador manda, limitado pelo esquema Zod (e pelos 256 KB da fundação), e não entra no rate limit; quem entra é a criação do rascunho e o envio.

- [ ] **Step 1: Branch** — `git switch teste && git pull --ff-only && git switch -c feat/funcoes-do-diagnostico`

- [ ] **Step 2: Testes que falham**

```ts
// src/server/shared/http/draft-cookie.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookies = vi.hoisted(() => ({ getCookie: vi.fn(), setCookie: vi.fn(), deleteCookie: vi.fn(), getRequest: vi.fn() }))
vi.mock('@tanstack/react-start/server', () => cookies)

import { DRAFT_COOKIE, clearDraftCookie, draftCookieOptions, readDraftCookie, requestClientIp, writeDraftCookie } from './draft-cookie'

describe('draft cookie', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is httpOnly, Lax, seven days, and Secure only in production', () => {
    expect(draftCookieOptions('production')).toEqual({ httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 604_800 })
    expect(draftCookieOptions('test').secure).toBe(false)
  })

  it('reads, writes and clears only the id', () => {
    cookies.getCookie.mockReturnValueOnce('abc').mockReturnValueOnce(undefined)
    expect(readDraftCookie()).toBe('abc')
    expect(readDraftCookie()).toBeNull()
    writeDraftCookie('id-1')
    expect(cookies.setCookie).toHaveBeenCalledWith(DRAFT_COOKIE, 'id-1', draftCookieOptions())
    clearDraftCookie()
    expect(cookies.deleteCookie).toHaveBeenCalledWith(DRAFT_COOKIE, { path: '/' })
  })

  it('takes the client address the same way as the login rate limit', () => {
    cookies.getRequest.mockReturnValue(new Request('http://x', { headers: { 'x-real-ip': '203.0.113.9' } }))
    expect(requestClientIp()).toBe('203.0.113.9')
  })
})
```

```ts
// src/features/diagnosis/api/schemas.test.ts
import { describe, expect, it } from 'vitest'
import { loadDraftInput, lookupCnpjInput, saveDraftInput } from './schemas'

describe('diagnosis input schemas', () => {
  it('accepts answers made of strings and string maps only', () => {
    expect(saveDraftInput.safeParse({ step: 3, answers: { a: 'x', receitaPorCliente: { pessoa_fisica: 'zero' } }, invitationToken: null }).success).toBe(true)
    expect(saveDraftInput.safeParse({ step: 3, answers: { a: ['x'] }, invitationToken: null }).success).toBe(false)
    expect(saveDraftInput.safeParse({ step: 3, answers: { a: { b: { c: 'd' } } }, invitationToken: null }).success).toBe(false)
    expect(saveDraftInput.safeParse({ step: 8, answers: {}, invitationToken: null }).success).toBe(false)
    expect(saveDraftInput.safeParse({ step: 1, answers: { a: 'x'.repeat(5001) }, invitationToken: null }).success).toBe(false)
  })

  it('bounds the invite and the CNPJ lookup', () => {
    expect(loadDraftInput.safeParse({}).success).toBe(true)
    expect(loadDraftInput.safeParse({ invite: 'x'.repeat(33) }).success).toBe(false)
    expect(lookupCnpjInput.safeParse({ cnpj: '11.222.333/0001-81', requesterName: 'Maria' }).success).toBe(true)
  })
})
```

- [ ] **Step 3:** Run `pnpm vitest run src/server/shared/http/draft-cookie.test.ts src/features/diagnosis/api/schemas.test.ts`. Expected: FAIL — módulos não existem.

- [ ] **Step 4: Cookie e tipos**

```ts
// src/server/shared/http/draft-cookie.ts
import { deleteCookie, getCookie, getRequest, setCookie } from '@tanstack/react-start/server'
import { getEnv } from '../env'
import { requestOrigin } from './request-origin'

export const DRAFT_COOKIE = 'draft_id'
export const DRAFT_COOKIE_MAX_AGE = 7 * 24 * 3600

export const draftCookieOptions = (nodeEnv: string = getEnv().NODE_ENV) => ({
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: nodeEnv === 'production',
  path: '/' as const,
  maxAge: DRAFT_COOKIE_MAX_AGE,
})

export const readDraftCookie = (): string | null => getCookie(DRAFT_COOKIE) ?? null
export const writeDraftCookie = (id: string): void => setCookie(DRAFT_COOKIE, id, draftCookieOptions())
export const clearDraftCookie = (): void => deleteCookie(DRAFT_COOKIE, { path: '/' })
export const requestClientIp = (): string | null => requestOrigin(getRequest().headers).ip
```

O cookie é regravado a cada salvamento: o rascunho vence 7 dias depois do último salvamento, e o cookie acompanha.

```ts
// src/features/diagnosis/types/diagnosis.ts
import type { CompanyBadgeLookup } from '@/server/diagnosis/domain/company-badge'
import type { WireAnswers } from '@/server/diagnosis/domain/draft-rules'
import type { ResultView } from '@/server/diagnosis/domain/result-view'

export interface DiagnosisBootstrap {
  today: string
  draft: { step: number; answers: WireAnswers; savedAt: string; protocol: string | null } | null
  invitation: { token: string; companyName: string | null; cnpj: string | null } | null
}

export type SaveDraftWireResult = { ok: true } | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }

export type SubmitWireResult =
  | { ok: true; protocol: string; result: ResultView }
  | { ok: false; reason: 'no_draft' | 'no_consent' | 'not_applicable' | 'invalid' }
  | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }

export interface DiagnosisApi {
  saveDraft(input: { step: number; answers: WireAnswers; invitationToken: string | null }): Promise<SaveDraftWireResult>
  discardDraft(): Promise<void>
  lookupCnpj(input: { cnpj: string; requesterName?: string }): Promise<CompanyBadgeLookup>
  submitDiagnosis(): Promise<SubmitWireResult>
}
```

- [ ] **Step 5: Esquemas, server functions e cliente**

```ts
// src/features/diagnosis/api/schemas.ts
import { z } from 'zod'

const answerValue = z.union([z.string().max(5000), z.record(z.string().max(64), z.string().max(64))])

export const saveDraftInput = z.object({
  step: z.number().int().min(1).max(7),
  answers: z.record(z.string().max(64), answerValue),
  invitationToken: z.string().max(32).nullable(),
})

export const loadDraftInput = z.object({ invite: z.string().max(32).optional() })

export const lookupCnpjInput = z.object({ cnpj: z.string().max(32), requesterName: z.string().max(200).optional() })
```

```ts
// src/features/diagnosis/api/diagnosis.ts
import { createServerFn } from '@tanstack/react-start'
import { diagnosisDrafts, diagnosisReports, submitDiagnosis as submitDraft, todayIso } from '@/server/diagnosis/composition'
import { toWireAnswers } from '@/server/diagnosis/domain/draft-rules'
import { invitationPrefill } from '@/server/invitations/composition'
import { clearDraftCookie, readDraftCookie, requestClientIp, writeDraftCookie } from '@/server/shared/http/draft-cookie'
import type { DiagnosisBootstrap, SaveDraftWireResult, SubmitWireResult } from '../types/diagnosis'
import { loadDraftInput, lookupCnpjInput, saveDraftInput } from './schemas'

export const loadDraft = createServerFn({ method: 'GET' })
  .inputValidator(loadDraftInput)
  .handler(async ({ data }): Promise<DiagnosisBootstrap> => {
    const cookie = readDraftCookie()
    const loaded = await diagnosisDrafts.loadDraft(cookie)
    if (cookie && !loaded) clearDraftCookie()
    return {
      today: todayIso(),
      draft: loaded
        ? { step: loaded.draft.step, answers: toWireAnswers(loaded.draft.answers), savedAt: loaded.draft.updatedAt.toISOString(), protocol: loaded.protocol }
        : null,
      invitation: data.invite ? await invitationPrefill(data.invite) : null,
    }
  })

export const saveDraft = createServerFn({ method: 'POST' })
  .inputValidator(saveDraftInput)
  .handler(async ({ data }): Promise<SaveDraftWireResult> => {
    const result = await diagnosisDrafts.saveDraft({ draftId: readDraftCookie(), ...data, origin: requestClientIp() })
    if (!result.ok) return result
    writeDraftCookie(result.draftId)
    return { ok: true }
  })

export const discardDraft = createServerFn({ method: 'POST' }).handler(async () => {
  await diagnosisDrafts.discardDraft(readDraftCookie())
  clearDraftCookie()
})

export const lookupCnpj = createServerFn({ method: 'POST' })
  .inputValidator(lookupCnpjInput)
  .handler(({ data }) => diagnosisDrafts.lookupCompanyForDraft({ draftId: readDraftCookie(), ...data }))

export const submitDiagnosis = createServerFn({ method: 'POST' }).handler(async (): Promise<SubmitWireResult> => {
  const result = await submitDraft({ draftId: readDraftCookie(), origin: requestClientIp() })
  if (!result.ok) return result.reason === 'invalid' ? { ok: false, reason: 'invalid' } : result
  return { ok: true, protocol: result.protocol, result: result.result }
})

export const getSubmittedReport = createServerFn({ method: 'GET' }).handler(() => diagnosisReports.submittedReport(readDraftCookie()))
```

```ts
// src/features/diagnosis/api/client.ts
import type { DiagnosisApi } from '../types/diagnosis'
import { discardDraft, lookupCnpj, saveDraft, submitDiagnosis } from './diagnosis'

export const diagnosisApi: DiagnosisApi = {
  saveDraft: (input) => saveDraft({ data: input }),
  discardDraft: () => discardDraft(),
  lookupCnpj: (input) => lookupCnpj({ data: input }),
  submitDiagnosis: () => submitDiagnosis(),
}
```

Se o TypeScript do Start reclamar que algum retorno não é serializável, o culpado é um `unknown` vazando de `Answers`: troque por `toWireAnswers`, nunca por `as`.

- [ ] **Step 6:** Run `pnpm vitest run src/server/shared/http src/features/diagnosis/api && pnpm lint && pnpm typecheck`. Expected: PASS e lint limpo (a fronteira `feature-api → server/shared/http` e `→ composition` é permitida).
- [ ] **Step 7: Commit e merge**

```bash
git add src/server/shared/http/draft-cookie.ts src/server/shared/http/draft-cookie.test.ts src/features/diagnosis
git commit -m "feat(diagnostico): server functions do rascunho, do envio e do relatório com cookie httpOnly draft_id"
pnpm lint && pnpm typecheck && pnpm test
git switch teste && git merge --no-ff feat/funcoes-do-diagnostico -m "merge: server functions do diagnóstico" && git branch -d feat/funcoes-do-diagnostico && git push origin teste
```

---

### Task 6: Testes de componente e o hook `useDiagnosisForm`

**Files:**
- Modify: `package.json`, `vitest.config.ts`
- Create: `tests/setup-dom.ts`, `src/features/diagnosis/hooks/form-state.ts`, `src/features/diagnosis/hooks/use-diagnosis-form.ts`
- Test: `src/features/diagnosis/hooks/form-state.test.ts`, `src/features/diagnosis/hooks/use-diagnosis-form.test.tsx`

**Interfaces:**
- Consumes: Tarefa 2 (`cleanInvisibleAnswers`, `triageReason`, `stepProblems`, `fieldProblem`, `applyCompanyPrefill`, `toWireAnswers`, `resultView`, `RESULT_STEP`…), `diagnose`, `buildActionPlan`; Tarefa 5 (`DiagnosisApi`, `DiagnosisBootstrap`).
- Produces:
  - Projeto Vitest `dom` (jsdom) para `src/**/*.test.tsx`; script `pnpm test:dom`.
  - `form-state.ts`: `View`, `CompanyState`, `SubmissionState`, `Resumable`, `FormState`, `FormAction`, `stepOf(view: View): number`, `initialFormState(bootstrap: DiagnosisBootstrap, options: { resume: boolean }): FormState`, `formReducer(state: FormState, action: FormAction): FormState`, `SUBMIT_FAILURES`
  - `use-diagnosis-form.ts`: `SAVE_DELAY_MS = 600`, `useDiagnosisForm(bootstrap: DiagnosisBootstrap, options: { api: DiagnosisApi; resume?: boolean }): DiagnosisForm` com `DiagnosisForm = { state: FormState; shownResult: ResultView | null; actions: { setAnswer(key: string, value: string): void; setMatrixAnswer(key: string, row: string, value: string): void; blurField(key: string): void; next(): void; back(): void; goTo(step: number): void; goToField(block: number, key: string): void; clearHighlight(): void; resume(): void; startOver(): void; retrySubmit(): void } }`

| Antigo (`modelo.html`) | Novo |
|---|---|
| `R`, `etapa`, `erros`, `R._retomavel`, `R._encaminhar`, `R._etapaAntesDoDesvio`, `R._cadastro*`, `R._envio*` | `FormState` (`answers`, `view`, `errors`, `resumable`, `view.kind === 'referral'`, `view.returnStep`, `company`, `submission`) |
| `window.set` / `setMatriz` / `setTexto` | `answer` / `answerMatrix` (texto e matriz também limpam o invisível — a matriz abre e fecha `conheceRegimeClientes` na mesma etapa) |
| `window.avancar` / `voltar` / `irPara` / `irParaCampo` | `next` / `back` / `goTo` / `goToField` |
| `retomarRascunho` / `comecarDeNovo` | `resume` / `startOver` (+ `discardDraft` no servidor) |
| `salvarRascunho` (600 ms, `localStorage`) | salvamento com espera de 600 ms por `api.saveDraft` |
| `buscarCadastro` / `conferirSolicitanteNoQsa` | `blurField('cnpj')` → `api.lookupCnpj`; `blurField('solicitante')` reconsulta sem mexer no selo (o servidor guarda só `requesterInQsa`) |
| `enviarAoConcluir` + `enviarRespostas` | efeito que, ao entrar no resultado, grava o rascunho na hora e chama `api.submitDiagnosis` uma vez |

- [ ] **Step 1: Branch e dependências**

```bash
git switch teste && git pull --ff-only && git switch -c test/componentes-e-formulario
pnpm add -D jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: Vitest com projeto `dom`**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    passWithNoTests: true,
    setupFiles: ['tests/setup.ts'],
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'], exclude: ['**/*.int.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'dom', include: ['src/**/*.test.tsx'], environment: 'jsdom', setupFiles: ['tests/setup.ts', 'tests/setup-dom.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.int.test.ts'],
          globalSetup: ['tests/integration/global-setup.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
})
```

```ts
// tests/setup-dom.ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
```

Em `package.json`, acrescente o script `"test:dom": "vitest run --project dom"`. Se o Vitest juntar os `setupFiles` do projeto aos da raiz e rodar `tests/setup.ts` duas vezes, nada quebra (só define `TZ` e lê `.env.test`); deixe a lista explícita assim mesmo, para o projeto `dom` não depender da regra de junção.

- [ ] **Step 3: Testes que falham**

```ts
// src/features/diagnosis/hooks/form-state.test.ts
import { describe, expect, it } from 'vitest'
import { applicableFill } from '@/server/diagnosis/domain/testing/applicable-fill'
import { formReducer, initialFormState, stepOf, type FormState } from './form-state'

const empty = () => initialFormState({ today: '2026-09-15T13:00:00.000Z', draft: null, invitation: null }, { resume: false })
const run = (state: FormState, ...actions: Parameters<typeof formReducer>[1][]) => actions.reduce(formReducer, state)

describe('form state', () => {
  it('blocks the step with the legacy messages', () => {
    const state = run(empty(), { type: 'next' })
    expect(state.view).toEqual({ kind: 'form', step: 1 })
    expect(state.errors.cnpj).toBe('Obrigatório')
  })

  it('detours to the referral and comes back to the same step', () => {
    const answers = applicableFill(3)
    let state: FormState = { ...empty(), answers: { ...answers, ehSimei: 'sim' } }
    state = run(state, { type: 'next' })
    expect(state.view).toEqual({ kind: 'referral', reason: 'mei', returnStep: 1 })
    expect(run(state, { type: 'back' }).view).toEqual({ kind: 'form', step: 1 })
  })

  it('walks the five steps, the review and the result, and only goes back by the step bar', () => {
    let state: FormState = { ...empty(), answers: applicableFill(3) }
    for (let i = 0; i < 5; i++) state = run(state, { type: 'next' })
    expect(state.view).toEqual({ kind: 'review' })
    state = run(state, { type: 'next' })
    expect(stepOf(state.view)).toBe(7)
    expect(run(state, { type: 'goTo', step: 6 }).view).toEqual({ kind: 'review' })
    const atTwo = run(state, { type: 'goTo', step: 2 })
    expect(run(atTwo, { type: 'goTo', step: 4 }).view).toEqual({ kind: 'form', step: 2 })
  })

  it('resets the submission when an answer changes after sending', () => {
    const sent: FormState = { ...empty(), submission: { status: 'failed', reason: 'x' } }
    expect(run(sent, { type: 'answer', key: 'telefone', value: '(34) 99999-9999' }).submission).toEqual({ status: 'idle' })
  })

  it('fills only blank company fields from the registry and drops a stale badge', () => {
    let state = run(empty(), { type: 'answer', key: 'cnpj', value: '11.222.333/0001-81' }, { type: 'answer', key: 'nomeEmpresa', value: 'Meu nome' })
    state = run(state, { type: 'companyLookupStarted', cnpj: '11.222.333/0001-81' }, {
      type: 'companyLookupFound', cnpj: '11.222.333/0001-81',
      company: { legalName: 'RAZÃO', city: 'UBERLANDIA', state: 'MG', simplesOptant: true, meiOptant: false, active: true, registrationStatus: 'ATIVA' },
    })
    expect(state.answers).toMatchObject({ nomeEmpresa: 'Meu nome', ehSimei: 'nao', regimeAtual: 'simples' })
    expect(state.company.status).toBe('found')
    expect(run(state, { type: 'answer', key: 'cnpj', value: '11.222.333/0001-8' }).company).toEqual({ status: 'idle' })
  })
})
```

```tsx
// src/features/diagnosis/hooks/use-diagnosis-form.test.tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildActionPlan } from '@/server/diagnosis/domain/action-plan'
import { diagnose } from '@/server/diagnosis/domain/diagnose'
import { toWireAnswers } from '@/server/diagnosis/domain/draft-rules'
import { resultView } from '@/server/diagnosis/domain/result-view'
import { applicableFill } from '@/server/diagnosis/domain/testing/applicable-fill'
import type { DiagnosisApi, DiagnosisBootstrap } from '../types/diagnosis'
import { SAVE_DELAY_MS, useDiagnosisForm } from './use-diagnosis-form'

const TODAY = '2026-09-15T13:00:00.000Z'
const bootstrap = (extra: Partial<DiagnosisBootstrap> = {}): DiagnosisBootstrap => ({ today: TODAY, draft: null, invitation: null, ...extra })

function fakeApi(overrides: Partial<DiagnosisApi> = {}) {
  return {
    saveDraft: vi.fn<DiagnosisApi['saveDraft']>(async () => ({ ok: true })),
    discardDraft: vi.fn<DiagnosisApi['discardDraft']>(async () => undefined),
    lookupCnpj: vi.fn<DiagnosisApi['lookupCnpj']>(async () => ({ ok: false, reason: 'indisponível' })),
    submitDiagnosis: vi.fn<DiagnosisApi['submitDiagnosis']>(async () => ({ ok: false, reason: 'no_draft' })),
    ...overrides,
  }
}

afterEach(() => vi.useRealTimers())

describe('useDiagnosisForm', () => {
  it('erases the answer of a question that became invisible', () => {
    const { result } = renderHook(() => useDiagnosisForm(bootstrap(), { api: fakeApi() }))
    act(() => result.current.actions.setAnswer('segmento', 'servico_saude'))
    act(() => result.current.actions.setAnswer('servicoHospitalar', 'sim'))
    expect(result.current.state.answers.servicoHospitalar).toBe('sim')
    act(() => result.current.actions.setAnswer('segmento', 'comercio'))
    expect(result.current.state.answers).not.toHaveProperty('servicoHospitalar')
  })

  it('saves once, 600 ms after the last change, with the latest answers', async () => {
    vi.useFakeTimers()
    const api = fakeApi()
    const { result } = renderHook(() => useDiagnosisForm(bootstrap(), { api }))
    act(() => result.current.actions.setAnswer('versaoFormulario', 'sintetico'))
    act(() => vi.advanceTimersByTime(300))
    act(() => result.current.actions.setAnswer('nomeEmpresa', 'Empresa X'))
    act(() => vi.advanceTimersByTime(SAVE_DELAY_MS - 1))
    expect(api.saveDraft).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(1))
    expect(api.saveDraft).toHaveBeenCalledTimes(1)
    expect(api.saveDraft).toHaveBeenCalledWith({ step: 1, answers: { versaoFormulario: 'sintetico', nomeEmpresa: 'Empresa X' }, invitationToken: null })
  })

  it('shows a save failure and clears it on the next successful save', async () => {
    vi.useFakeTimers()
    const api = fakeApi()
    api.saveDraft.mockResolvedValueOnce({ ok: false, reason: 'rate_limited', retryAfterSeconds: 10 })
    const { result } = renderHook(() => useDiagnosisForm(bootstrap(), { api }))
    act(() => result.current.actions.setAnswer('versaoFormulario', 'sintetico'))
    await act(async () => vi.advanceTimersByTime(SAVE_DELAY_MS))
    expect(result.current.state.saveFailed).toBe(true)
    act(() => result.current.actions.setAnswer('versaoFormulario', 'completo'))
    await act(async () => vi.advanceTimersByTime(SAVE_DELAY_MS))
    expect(result.current.state.saveFailed).toBe(false)
  })

  it('offers to resume, resumes at the saved step and starts over on request', async () => {
    const api = fakeApi()
    const draft = { step: 3, answers: { versaoFormulario: 'completo', nomeEmpresa: 'Antiga' }, savedAt: '2026-09-14T12:00:00.000Z', protocol: null }
    const { result } = renderHook(() => useDiagnosisForm(bootstrap({ draft }), { api }))
    expect(result.current.state.resumable).not.toBeNull()
    expect(result.current.state.view).toEqual({ kind: 'form', step: 1 })
    act(() => result.current.actions.resume())
    expect(result.current.state.view).toEqual({ kind: 'form', step: 3 })
    expect(result.current.state.answers.nomeEmpresa).toBe('Antiga')
    await act(async () => result.current.actions.startOver())
    expect(result.current.state.answers).toEqual({})
    expect(api.discardDraft).toHaveBeenCalledTimes(1)
  })

  it('prefills the invitation and sends its token with the save', async () => {
    vi.useFakeTimers()
    const api = fakeApi()
    const invitation = { token: 'ABCDEFGHJK', companyName: 'Convidada', cnpj: '11.222.333/0001-81' }
    const { result } = renderHook(() => useDiagnosisForm(bootstrap({ invitation }), { api }))
    expect(result.current.state.answers).toEqual({ nomeEmpresa: 'Convidada', cnpj: '11.222.333/0001-81' })
    act(() => result.current.actions.setAnswer('versaoFormulario', 'sintetico'))
    await act(async () => vi.advanceTimersByTime(SAVE_DELAY_MS))
    expect(api.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ invitationToken: 'ABCDEFGHJK' }))
  })

  it('on reaching the result, saves at once, submits once and shows the server result', async () => {
    const answers = applicableFill(7)
    const diagnosis = diagnose(answers, new Date(TODAY))
    const serverView = { ...resultView(diagnosis, buildActionPlan(answers, diagnosis)), windowText: 'do servidor' }
    const api = fakeApi({ submitDiagnosis: vi.fn<DiagnosisApi['submitDiagnosis']>(async () => ({ ok: true, protocol: 'DS-260915-AB12', result: serverView })) })
    const draft = { step: 6, answers: toWireAnswers(answers), savedAt: TODAY, protocol: null }
    const { result } = renderHook(() => useDiagnosisForm(bootstrap({ draft }), { api, resume: true }))
    expect(result.current.state.view).toEqual({ kind: 'review' })
    act(() => result.current.actions.next())
    expect(result.current.shownResult).not.toBeNull()
    await waitFor(() => expect(result.current.state.submission.status).toBe('sent'))
    expect(api.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ step: 7 }))
    expect(api.submitDiagnosis).toHaveBeenCalledTimes(1)
    expect(result.current.shownResult?.windowText).toBe('do servidor')
  })

  it('shows the wait time when the server answers 429', async () => {
    const answers = applicableFill(7)
    const api = fakeApi({ submitDiagnosis: vi.fn<DiagnosisApi['submitDiagnosis']>(async () => ({ ok: false, reason: 'rate_limited', retryAfterSeconds: 90 })) })
    const draft = { step: 7, answers: toWireAnswers(answers), savedAt: TODAY, protocol: null }
    const { result } = renderHook(() => useDiagnosisForm(bootstrap({ draft }), { api, resume: true }))
    await waitFor(() => expect(result.current.state.submission).toEqual({ status: 'rate_limited', retryAfterSeconds: 90 }))
  })

  it('looks the CNPJ up on blur and fills the blank company fields', async () => {
    const api = fakeApi({
      lookupCnpj: vi.fn<DiagnosisApi['lookupCnpj']>(async () => ({
        ok: true, requesterInQsa: null,
        company: { legalName: 'RAZÃO LTDA', city: 'UBERLANDIA', state: 'MG', simplesOptant: true, meiOptant: false, active: true, registrationStatus: 'ATIVA' },
      })),
    })
    const { result } = renderHook(() => useDiagnosisForm(bootstrap(), { api }))
    act(() => result.current.actions.setAnswer('cnpj', '11.222.333/0001-81'))
    act(() => result.current.actions.blurField('cnpj'))
    await waitFor(() => expect(result.current.state.company.status).toBe('found'))
    expect(api.lookupCnpj).toHaveBeenCalledWith({ cnpj: '11.222.333/0001-81', requesterName: undefined })
    expect(result.current.state.answers).toMatchObject({ nomeEmpresa: 'RAZÃO LTDA', ehSimei: 'nao', regimeAtual: 'simples' })
  })
})
```

- [ ] **Step 4:** Run `pnpm vitest run src/features/diagnosis/hooks`. Expected: FAIL — `form-state` e `use-diagnosis-form` não existem.

- [ ] **Step 5: Estado puro**

```ts
// src/features/diagnosis/hooks/form-state.ts
import { applyCompanyPrefill, type CompanyBadge } from '@/server/diagnosis/domain/company-badge'
import { FORM_STEPS, RESULT_STEP, REVIEW_STEP, cleanInvisibleAnswers, triageReason, type TriageReason } from '@/server/diagnosis/domain/draft-rules'
import type { Answers, MatrixAnswer } from '@/server/diagnosis/domain/question-types'
import type { ResultView } from '@/server/diagnosis/domain/result-view'
import { fieldProblem, stepProblems, type AnswerProblems } from '@/server/diagnosis/domain/validate-answers'
import type { DiagnosisBootstrap, SubmitWireResult } from '../types/diagnosis'

export type View =
  | { kind: 'form'; step: number }
  | { kind: 'review' }
  | { kind: 'result' }
  | { kind: 'referral'; reason: TriageReason; returnStep: number }

export type CompanyState =
  | { status: 'idle' }
  | { status: 'loading'; cnpj: string }
  | { status: 'failed'; cnpj: string; reason: string }
  | { status: 'found'; cnpj: string; company: CompanyBadge }

export type SubmissionState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent'; protocol: string; result: ResultView }
  | { status: 'failed'; reason: string }
  | { status: 'rate_limited'; retryAfterSeconds: number }

export interface Resumable {
  step: number
  answers: Answers
  savedAt: string
  protocol: string | null
}

export interface FormState {
  view: View
  answers: Answers
  errors: AnswerProblems
  resumable: Resumable | null
  invitationToken: string | null
  company: CompanyState
  saveFailed: boolean
  submission: SubmissionState
  highlight: string | null
  revision: number
}

export type FormAction =
  | { type: 'answer'; key: string; value: string }
  | { type: 'answerMatrix'; key: string; row: string; value: string }
  | { type: 'blur'; key: string }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'goTo'; step: number }
  | { type: 'goToField'; block: number; key: string }
  | { type: 'clearHighlight' }
  | { type: 'resume' }
  | { type: 'startOver' }
  | { type: 'companyLookupStarted'; cnpj: string }
  | { type: 'companyLookupFailed'; cnpj: string; reason: string }
  | { type: 'companyLookupFound'; cnpj: string; company: CompanyBadge }
  | { type: 'saveFailed' }
  | { type: 'saveSucceeded' }
  | { type: 'submitStarted' }
  | { type: 'submitSucceeded'; protocol: string; result: ResultView }
  | { type: 'submitFailed'; reason: string }
  | { type: 'submitRateLimited'; retryAfterSeconds: number }

type FailureReason = Exclude<Extract<SubmitWireResult, { ok: false }>['reason'], 'rate_limited'>

export const SUBMIT_FAILURES: Record<FailureReason, string> = {
  no_draft: 'o rascunho não foi encontrado',
  no_consent: 'falta o aceite de privacidade',
  not_applicable: 'este diagnóstico não se aplica ao seu caso',
  invalid: 'há respostas obrigatórias em branco',
}

const digits = (value: string) => value.replace(/[^0-9A-Za-z]/g, '').toUpperCase()

export function stepOf(view: View): number {
  if (view.kind === 'form') return view.step
  if (view.kind === 'review') return REVIEW_STEP
  if (view.kind === 'result') return RESULT_STEP
  return view.returnStep
}

const viewOf = (step: number): View =>
  step >= RESULT_STEP ? { kind: 'result' } : step === REVIEW_STEP ? { kind: 'review' } : { kind: 'form', step: Math.max(1, step) }

const withoutKey = (errors: AnswerProblems, key: string): AnswerProblems =>
  Object.fromEntries(Object.entries(errors).filter(([name]) => name !== key))

function changeAnswers(state: FormState, answers: Answers, key: string): FormState {
  const company =
    key === 'cnpj' && state.company.status !== 'idle' && digits(String(answers.cnpj ?? '')) !== digits(state.company.cnpj)
      ? ({ status: 'idle' } as const)
      : state.company
  return {
    ...state,
    answers: cleanInvisibleAnswers(answers),
    errors: withoutKey(state.errors, key),
    company,
    submission: state.submission.status === 'sending' ? state.submission : { status: 'idle' },
    revision: state.revision + 1,
  }
}

const navigate = (state: FormState, view: View): FormState => ({ ...state, view, errors: {}, revision: state.revision + 1 })

export function initialFormState(bootstrap: DiagnosisBootstrap, { resume }: { resume: boolean }): FormState {
  const answers: Answers = {}
  if (bootstrap.invitation?.companyName) answers.nomeEmpresa = bootstrap.invitation.companyName
  if (bootstrap.invitation?.cnpj) answers.cnpj = bootstrap.invitation.cnpj
  const state: FormState = {
    view: { kind: 'form', step: 1 },
    answers,
    errors: {},
    resumable: bootstrap.draft ? { ...bootstrap.draft } : null,
    invitationToken: bootstrap.invitation?.token ?? null,
    company: { status: 'idle' },
    saveFailed: false,
    submission: { status: 'idle' },
    highlight: null,
    revision: 0,
  }
  return resume && state.resumable ? formReducer(state, { type: 'resume' }) : state
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'answer':
      return changeAnswers(state, { ...state.answers, [action.key]: action.value }, action.key)
    case 'answerMatrix': {
      const matrix = (state.answers[action.key] as MatrixAnswer | undefined) ?? {}
      return changeAnswers(state, { ...state.answers, [action.key]: { ...matrix, [action.row]: action.value } }, action.key)
    }
    case 'blur': {
      const problem = fieldProblem(state.answers, action.key)
      return { ...state, errors: problem ? { ...state.errors, [action.key]: problem } : withoutKey(state.errors, action.key) }
    }
    case 'next': {
      if (state.view.kind === 'review') return navigate(state, { kind: 'result' })
      if (state.view.kind !== 'form') return state
      const step = state.view.step
      const problems = stepProblems(state.answers, step)
      if (Object.keys(problems).length) return { ...state, errors: problems }
      const reason = triageReason(state.answers)
      if (reason) return navigate(state, { kind: 'referral', reason, returnStep: step })
      return navigate(state, step < FORM_STEPS ? { kind: 'form', step: step + 1 } : { kind: 'review' })
    }
    case 'back': {
      const { view } = state
      if (view.kind === 'referral') return navigate(state, { kind: 'form', step: view.returnStep })
      if (view.kind === 'result') return navigate(state, { kind: 'review' })
      if (view.kind === 'review') return navigate(state, { kind: 'form', step: FORM_STEPS })
      return view.step > 1 ? navigate(state, { kind: 'form', step: view.step - 1 }) : state
    }
    case 'goTo':
      if (state.view.kind === 'referral' || action.step < stepOf(state.view)) return navigate(state, viewOf(action.step))
      return state
    case 'goToField':
      return { ...navigate(state, { kind: 'form', step: action.block }), highlight: action.key }
    case 'clearHighlight':
      return { ...state, highlight: null }
    case 'resume':
      if (!state.resumable) return state
      return { ...state, answers: { ...state.answers, ...state.resumable.answers }, view: viewOf(state.resumable.step), resumable: null }
    case 'startOver':
      return { ...state, answers: {}, errors: {}, view: { kind: 'form', step: 1 }, resumable: null, company: { status: 'idle' }, submission: { status: 'idle' } }
    case 'companyLookupStarted':
      return { ...state, company: { status: 'loading', cnpj: action.cnpj } }
    case 'companyLookupFailed':
      if (digits(action.cnpj) !== digits(String(state.answers.cnpj ?? ''))) return state
      return { ...state, company: { status: 'failed', cnpj: action.cnpj, reason: action.reason } }
    case 'companyLookupFound': {
      if (digits(action.cnpj) !== digits(String(state.answers.cnpj ?? ''))) return state
      return {
        ...state,
        answers: cleanInvisibleAnswers(applyCompanyPrefill(state.answers, action.company)),
        company: { status: 'found', cnpj: action.cnpj, company: action.company },
        revision: state.revision + 1,
      }
    }
    case 'saveFailed':
      return { ...state, saveFailed: true }
    case 'saveSucceeded':
      return { ...state, saveFailed: false }
    case 'submitStarted':
      return { ...state, submission: { status: 'sending' } }
    case 'submitSucceeded':
      return { ...state, submission: { status: 'sent', protocol: action.protocol, result: action.result } }
    case 'submitFailed':
      return { ...state, submission: { status: 'failed', reason: action.reason } }
    case 'submitRateLimited':
      return { ...state, submission: { status: 'rate_limited', retryAfterSeconds: action.retryAfterSeconds } }
  }
}
```

`startOver` limpa tudo, inclusive o que veio do convite, como o `comecarDeNovo` antigo; o token do convite continua no estado e volta a ligar o próximo rascunho.

- [ ] **Step 6: O hook**

```ts
// src/features/diagnosis/hooks/use-diagnosis-form.ts
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { buildActionPlan } from '@/server/diagnosis/domain/action-plan'
import { diagnose } from '@/server/diagnosis/domain/diagnose'
import { toWireAnswers } from '@/server/diagnosis/domain/draft-rules'
import { resultView, type ResultView } from '@/server/diagnosis/domain/result-view'
import { fieldProblem } from '@/server/diagnosis/domain/validate-answers'
import type { DiagnosisApi, DiagnosisBootstrap, SaveDraftWireResult } from '../types/diagnosis'
import { SUBMIT_FAILURES, formReducer, initialFormState, stepOf, type FormState } from './form-state'

export const SAVE_DELAY_MS = 600

export interface DiagnosisForm {
  state: FormState
  shownResult: ResultView | null
  actions: {
    setAnswer(key: string, value: string): void
    setMatrixAnswer(key: string, row: string, value: string): void
    blurField(key: string): void
    next(): void
    back(): void
    goTo(step: number): void
    goToField(block: number, key: string): void
    clearHighlight(): void
    resume(): void
    startOver(): void
    retrySubmit(): void
  }
}

const textAnswer = (state: FormState, key: string) => {
  const value = state.answers[key]
  return typeof value === 'string' ? value : ''
}

export function useDiagnosisForm(bootstrap: DiagnosisBootstrap, { api, resume = false }: { api: DiagnosisApi; resume?: boolean }): DiagnosisForm {
  const [state, dispatch] = useReducer(formReducer, bootstrap, (initial) => initialFormState(initial, { resume }))
  const latest = useRef(state)
  latest.current = state
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submitting = useRef(false)
  const today = useMemo(() => new Date(bootstrap.today), [bootstrap.today])

  const cancelPendingSave = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const persist = useCallback(async (): Promise<SaveDraftWireResult | null> => {
    const current = latest.current
    try {
      const saved = await api.saveDraft({ step: stepOf(current.view), answers: toWireAnswers(current.answers), invitationToken: current.invitationToken })
      dispatch({ type: saved.ok ? 'saveSucceeded' : 'saveFailed' })
      return saved
    } catch {
      dispatch({ type: 'saveFailed' })
      return null
    }
  }, [api])

  const submit = useCallback(async () => {
    if (submitting.current) return
    submitting.current = true
    dispatch({ type: 'submitStarted' })
    cancelPendingSave()
    try {
      const saved = await persist()
      if (!saved) return dispatch({ type: 'submitFailed', reason: 'sem conexão' })
      if (!saved.ok) return dispatch({ type: 'submitRateLimited', retryAfterSeconds: saved.retryAfterSeconds })
      const sent = await api.submitDiagnosis()
      if (sent.ok) dispatch({ type: 'submitSucceeded', protocol: sent.protocol, result: sent.result })
      else if (sent.reason === 'rate_limited') dispatch({ type: 'submitRateLimited', retryAfterSeconds: sent.retryAfterSeconds })
      else dispatch({ type: 'submitFailed', reason: SUBMIT_FAILURES[sent.reason] })
    } catch {
      dispatch({ type: 'submitFailed', reason: 'sem conexão' })
    } finally {
      submitting.current = false
    }
  }, [api, persist])

  // Declared before the submit effect: on entering the result the debounce is armed and the submit effect cancels it.
  useEffect(() => {
    if (state.revision === 0) return
    cancelPendingSave()
    timer.current = setTimeout(() => {
      timer.current = null
      void persist()
    }, SAVE_DELAY_MS)
    return cancelPendingSave
  }, [state.revision, persist])

  useEffect(() => {
    if (state.view.kind === 'result' && state.submission.status === 'idle') void submit()
  }, [state.view.kind, state.submission.status, submit])

  const lookup = useCallback(
    async (cnpj: string, quiet: boolean) => {
      if (!quiet) dispatch({ type: 'companyLookupStarted', cnpj })
      try {
        const requesterName = textAnswer(latest.current, 'solicitante') || undefined
        const result = await api.lookupCnpj({ cnpj, requesterName })
        if (quiet) return
        dispatch(result.ok ? { type: 'companyLookupFound', cnpj, company: result.company } : { type: 'companyLookupFailed', cnpj, reason: result.reason })
      } catch {
        if (!quiet) dispatch({ type: 'companyLookupFailed', cnpj, reason: 'indisponível' })
      }
    },
    [api],
  )

  const blurField = useCallback(
    (key: string) => {
      dispatch({ type: 'blur', key })
      const current = latest.current
      const value = textAnswer(current, key)
      if (!value.trim() || fieldProblem(current.answers, key)) return
      const { company } = current
      if (key === 'cnpj') {
        const sameCnpj = (company.status === 'found' || company.status === 'loading') && company.cnpj.replace(/\W/g, '') === value.replace(/\W/g, '')
        if (!sameCnpj) void lookup(value, false)
      }
      if (key === 'solicitante' && company.status === 'found') void lookup(company.cnpj, true)
    },
    [lookup],
  )

  const shownResult = useMemo(() => {
    if (state.view.kind !== 'result') return null
    if (state.submission.status === 'sent') return state.submission.result
    const diagnosis = diagnose(state.answers, today)
    return resultView(diagnosis, buildActionPlan(state.answers, diagnosis))
  }, [state.view.kind, state.submission, state.answers, today])

  return {
    state,
    shownResult,
    actions: {
      setAnswer: (key, value) => dispatch({ type: 'answer', key, value }),
      setMatrixAnswer: (key, row, value) => dispatch({ type: 'answerMatrix', key, row, value }),
      blurField,
      next: () => dispatch({ type: 'next' }),
      back: () => dispatch({ type: 'back' }),
      goTo: (step) => dispatch({ type: 'goTo', step }),
      goToField: (block, key) => dispatch({ type: 'goToField', block, key }),
      clearHighlight: () => dispatch({ type: 'clearHighlight' }),
      resume: () => dispatch({ type: 'resume' }),
      startOver: () => {
        cancelPendingSave()
        dispatch({ type: 'startOver' })
        void api.discardDraft().catch(() => undefined)
      },
      retrySubmit: () => void submit(),
    },
  }
}
```

O resultado provisório usa a data que veio do servidor (`bootstrap.today`), nunca o relógio do computador de quem responde — a mesma regra do `agora()` antigo.

- [ ] **Step 7:** Run `pnpm vitest run --project dom src/features/diagnosis/hooks && pnpm vitest run src/features/diagnosis/hooks/form-state.test.ts`. Expected: PASS.
- [ ] **Step 8: Commit e merge**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts tests/setup-dom.ts src/features/diagnosis/hooks
git commit -m "feat(diagnostico): estado do formulário com limpeza do invisível, salvamento em 600 ms e envio automático"
pnpm lint && pnpm typecheck && pnpm test
git switch teste && git merge --no-ff test/componentes-e-formulario -m "merge: estado do formulário do diagnóstico" && git branch -d test/componentes-e-formulario && git push origin teste
```

---
### Task 7: Telas do formulário (etapas 1 a 5, matriz, CNPJ, privacidade, triagem, retomada)

**Files:**
- Create: `public/brand/logo-contabil-negativa.png`, `public/brand/logo-contabil-positiva.png`, `src/styles/diagnosis.css`, `src/components/brand/site-header.tsx`, `src/features/diagnosis/components/{step-bar,question-field,matrix-field,cnpj-badge,privacy-consent,resume-banner,step-form,triage-referral,diagnosis-page}.tsx`, `src/app/routes/diagnosis/index.tsx`
- Modify: `src/styles/app.css`, `tests/setup-dom.ts`
- Test: `src/features/diagnosis/components/matrix-field.test.tsx`, `src/features/diagnosis/components/cnpj-badge.test.tsx`, `src/features/diagnosis/components/diagnosis-page.test.tsx`

**Interfaces:**
- Consumes: Tarefa 6 (`useDiagnosisForm`, `DiagnosisForm`, `CompanyState`, `Resumable`, `stepOf`); Tarefa 5 (`loadDraft`, `diagnosisApi`, `DiagnosisApi`, `DiagnosisBootstrap`); Tarefa 2 (`matrixFooter`, `TriageReason`); `BLOCKS`, `QUESTIONS`, `visibleQuestions`, `VALIDATORS`.
- Produces (componentes, todos de função):
  - `SiteHeader({ subtitle }: { subtitle: string })`
  - `StepBar({ current, onGoTo }: { current: number; onGoTo(step: number): void })`
  - `QuestionField(props: { question: Question; answers: Answers; error?: string; highlighted: boolean; company: CompanyState; onAnswer(key: string, value: string): void; onMatrixAnswer(key: string, row: string, value: string): void; onBlur(key: string): void; onHighlightEnd(): void })`
  - `MatrixField({ question, answers, onChange }: { question: Question; answers: Answers; onChange(row: string, value: string): void })`
  - `CnpjBadge({ state }: { state: CompanyState })`
  - `PrivacyConsent({ question, checked, onChange }: { question: Question; checked: boolean; onChange(checked: boolean): void })`
  - `ResumeBanner({ resumable, onResume, onStartOver }: { resumable: Resumable; onResume(): void; onStartOver(): void })`
  - `StepForm({ form, step }: { form: DiagnosisForm; step: number })`
  - `TriageReferral({ reason, onBack }: { reason: TriageReason; onBack(): void })`
  - `DiagnosisPage({ bootstrap, api, resume }: { bootstrap: DiagnosisBootstrap; api: DiagnosisApi; resume: boolean })`
  - rota `/diagnosis/` com `validateSearch` `{ invite?: string; resume?: '1' }` e `loader` → `loadDraft({ data: { invite } })`

Porte (de `git show 22b3cfc:legacy/modelo.html`):

| Antigo | Novo | O que portar literalmente |
|---|---|---|
| `<header>` (linhas 498–520) | `SiteHeader` | as duas imagens (`is-screen`, `is-paper`), `alt="auster Inteligência Contábil"`, subtítulo `Diagnóstico — Simples padrão ou regime regular de IBS e CBS` |
| `trilhaDePassos` | `StepBar` | rótulos `${i + 1}. ${titulo}` e "Conferência"; só passos anteriores ao atual viram `<button>` |
| `campo(p)` (todos os ramos) | `QuestionField` + `MatrixField` + `PrivacyConsent` | marca `*` quando `required !== 'never'`; dica (função ou texto); `select` com "Selecione…"; `textarea` com `placeholder="Opcional"`; grade `is-short` quando toda opção não tem descrição e tem até 26 caracteres; `inputmode="numeric"` no telefone; tipos `email`/`tel`/`text` |
| `rodapeMatriz` / `somaMatriz` | `matrixFooter` (Tarefa 2) | — |
| `seloCadastro` | `CnpjBadge` | os quatro textos, sem o ramo "bloqueado por abrir o arquivo direto" |
| bloco `consentimento` de `campo` | `PrivacyConsent` | os cinco parágrafos, `CONFIG.controlador = 'Auster Inteligência Contábil'`, `CONFIG.emailPrivacidade = 'contato@austercontabil.com.br'`, `CONFIG.guardaMeses = 24` |
| `faixaDeRetomada` | `ResumeBanner` | texto igual, **exceto** a segunda linha (abaixo) |
| `renderFormulario` | `StepForm` | título, `Etapa N de 5`, aviso `.dx-scope`, glossário, botões "Voltar" (desabilitado na etapa 1) e "Próximo"/"Conferir respostas" |
| `renderEncaminhamento` + `DIAGNOSTICO_OFICIAL` | `TriageReferral` | os dois textos (MEI e fora do Simples), botão-link "Ir para a Avaliação Prévia da Reforma" (`target="_blank" rel="noopener"`), botão "Voltar e corrigir" |
| `window.setTexto` (máscara e cursor) | `QuestionField` | aplica `VALIDATORS[validator].mask` no `onChange`; se o cursor não estava no fim, devolve o cursor para `Math.min(cursor, mascarado.length)` depois do render |
| `window.irParaCampo` + `.campo.destacado` | `QuestionField` com `highlighted` | `scrollIntoView({ behavior: 'smooth', block: 'center' })`, classe `is-highlighted` por 1 800 ms, depois `onHighlightEnd()` |
| `window.avancar` (rolagem ao primeiro erro) | `StepForm` | depois de um "Próximo" com erro, rola até o primeiro `.dx-field` com `.dx-error` |

A primeira linha da `ResumeBanner` vai inteira dentro de um `<b>` (como no antigo). Frase alterada na `ResumeBanner`: a segunda linha do antigo dizia "Fica guardado só neste navegador — nada foi enviado.", o que deixou de ser verdade (o rascunho fica no servidor, ligado ao navegador pelo cookie). Use: **"Fica guardado por 7 dias, ligado a este navegador — nada foi enviado à equipe."** A primeira linha fica: `Você tem um preenchimento começado${data}${nome ? `, de ${nome}` : ''}.` com `data = ` de ${dd/mm/aaaa} às ${hh:mm}`` a partir de `resumable.savedAt` (`toLocaleDateString('pt-BR')` e `toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })`, com `timeZone: 'America/Sao_Paulo'`).

Acessibilidade: campo de texto, e-mail, telefone, CNPJ, `select` e `textarea` têm `id={`field-${key}`}` e o rótulo `<label htmlFor>`; grupos de opção são `<div className="dx-options" role="radiogroup" aria-labelledby={`label-${key}`}>`, com o enunciado em `<label id={`label-${key}`}>`. Cada `.dx-field` leva `data-field={key}` (o ponta a ponta e o "alterar" da conferência usam).

- [ ] **Step 1: Branch e logos**

```bash
git switch teste && git pull --ff-only && git switch -c feat/formulario-do-diagnostico
mkdir -p public/brand
git show 22b3cfc:legacy/ativos/logo-contabil-negativa.png > public/brand/logo-contabil-negativa.png
git show 22b3cfc:legacy/ativos/logo-contabil-positiva.png > public/brand/logo-contabil-positiva.png
file public/brand/*.png
```

Rode no Git Bash (o redirecionamento do PowerShell corrompe binário). Expected: `PNG image data` nas duas.

- [ ] **Step 2: Testes que falham**

```tsx
// src/features/diagnosis/components/matrix-field.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CUSTOMER_TYPES, PERCENT_BANDS, QUESTIONS } from '@/server/diagnosis/domain/questions'
import { MatrixField } from './matrix-field'

const question = QUESTIONS.find((q) => q.type === 'matrix')
if (!question) throw new Error('sem matriz no formulário')

describe('MatrixField (U-01)', () => {
  it('names every row and every cell for screen readers and for the phone list', () => {
    const { container } = render(<MatrixField question={question} answers={{}} onChange={() => undefined} />)
    const cells = CUSTOMER_TYPES.length * PERCENT_BANDS.length
    expect(screen.getAllByRole('rowheader')).toHaveLength(CUSTOMER_TYPES.length)
    expect(screen.getAllByRole('radio')).toHaveLength(cells)
    expect(container.querySelectorAll('td .dx-matrix-band')).toHaveLength(cells)
    expect(screen.getByRole('radio', { name: 'Órgão público: não sei' })).toBeInTheDocument()
    expect(screen.getAllByText('não sei', { selector: '.dx-matrix-band' })).toHaveLength(CUSTOMER_TYPES.length)
  })

  it('reports the row and band that were clicked and shows the sum', async () => {
    const onChange = vi.fn()
    render(<MatrixField question={question} answers={{ receitaPorCliente: { pessoa_fisica: 'acima_80', simples_mei: 'ate_20' } }} onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Exterior: até 20%' }))
    expect(onChange).toHaveBeenCalledWith('exterior', 'ate_20')
    expect(screen.getByText('Soma aproximada: 100%')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Pessoa física / consumidor final: acima de 80%' })).toBeChecked()
  })
})
```

```tsx
// src/features/diagnosis/components/cnpj-badge.test.tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CnpjBadge } from './cnpj-badge'

const company = { legalName: 'EMPRESA TESTE LTDA', city: 'UBERLANDIA', state: 'MG', simplesOptant: true, meiOptant: false, active: true, registrationStatus: 'ATIVA' }
const text = (node: HTMLElement) => node.textContent?.replace(/\s+/g, ' ').trim()

describe('CnpjBadge', () => {
  it('says what was found, with Simples and MEI', () => {
    const { container } = render(<CnpjBadge state={{ status: 'found', cnpj: '11.222.333/0001-81', company: { ...company, meiOptant: true } }} />)
    expect(text(container)).toBe('EMPRESA TESTE LTDA · UBERLANDIA/MG · optante pelo Simples · MEI')
    expect(container.querySelector('.dx-company.is-found')).not.toBeNull()
  })

  it('warns when the company is not active', () => {
    const { container } = render(<CnpjBadge state={{ status: 'found', cnpj: 'x', company: { ...company, simplesOptant: false, active: false, registrationStatus: 'BAIXADA' } }} />)
    expect(text(container)).toBe('EMPRESA TESTE LTDA · UBERLANDIA/MG · não optante pelo Simples Situação cadastral: BAIXADA. Confirme antes de seguir.')
    expect(container.querySelector('.dx-company.is-warning')).not.toBeNull()
  })

  it('never blocks: failure asks for the name by hand, loading says so, idle shows nothing', () => {
    expect(text(render(<CnpjBadge state={{ status: 'failed', cnpj: 'x', reason: 'tempo esgotado' }} />).container))
      .toBe('Não deu para consultar o CNPJ agora (tempo esgotado). Preencha o nome da empresa à mão — o diagnóstico segue igual.')
    expect(text(render(<CnpjBadge state={{ status: 'loading', cnpj: 'x' }} />).container)).toBe('Conferindo o cadastro na Receita…')
    expect(render(<CnpjBadge state={{ status: 'idle' }} />).container.innerHTML).toBe('')
  })
})
```

```tsx
// src/features/diagnosis/components/diagnosis-page.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { toWireAnswers } from '@/server/diagnosis/domain/draft-rules'
import { applicableFill } from '@/server/diagnosis/domain/testing/applicable-fill'
import type { DiagnosisApi, DiagnosisBootstrap } from '../types/diagnosis'
import { DiagnosisPage } from './diagnosis-page'

const bootstrap = (extra: Partial<DiagnosisBootstrap> = {}): DiagnosisBootstrap => ({ today: '2026-09-15T13:00:00.000Z', draft: null, invitation: null, ...extra })
const api = () => ({
  saveDraft: vi.fn<DiagnosisApi['saveDraft']>(async () => ({ ok: true })),
  discardDraft: vi.fn<DiagnosisApi['discardDraft']>(async () => undefined),
  lookupCnpj: vi.fn<DiagnosisApi['lookupCnpj']>(async () => ({ ok: false, reason: 'indisponível' })),
  submitDiagnosis: vi.fn<DiagnosisApi['submitDiagnosis']>(async () => ({ ok: false, reason: 'no_draft' })),
})

describe('DiagnosisPage — form', () => {
  it('erases and stops saving the answer of a question that became invisible', async () => {
    const fake = api()
    render(<DiagnosisPage bootstrap={bootstrap()} api={fake} resume={false} />)
    await userEvent.selectOptions(screen.getByLabelText(/Segmento de atuação/), 'servico_saude')
    await userEvent.click(screen.getByLabelText('Sim, as duas'))
    await userEvent.selectOptions(screen.getByLabelText(/Segmento de atuação/), 'comercio')
    expect(screen.queryByText(/sociedade empresária/)).not.toBeInTheDocument()
    await waitFor(() => expect(fake.saveDraft).toHaveBeenCalled())
    const [last] = fake.saveDraft.mock.lastCall ?? []
    expect(last?.answers).toEqual({ segmento: 'comercio' })
  })

  it('shows the legacy required message on "Próximo" and stays on the step', async () => {
    render(<DiagnosisPage bootstrap={bootstrap()} api={api()} resume={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getAllByText('Obrigatório').length).toBeGreaterThan(5)
    expect(screen.getByText('Etapa 1 de 5')).toBeInTheDocument()
  })

  it('offers to resume a saved draft and starts over on request', async () => {
    const fake = api()
    const draft = { step: 2, answers: { versaoFormulario: 'completo', nomeEmpresa: 'Antiga Ltda' }, savedAt: '2026-09-14T15:30:00.000Z', protocol: null }
    render(<DiagnosisPage bootstrap={bootstrap({ draft })} api={fake} resume={false} />)
    expect(screen.getByText(/Você tem um preenchimento começado de 14\/09\/2026 às 12:30, de Antiga Ltda\./)).toBeInTheDocument()
    expect(screen.getByText('Fica guardado por 7 dias, ligado a este navegador — nada foi enviado à equipe.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Começar de novo' }))
    expect(fake.discardDraft).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/preenchimento começado/)).not.toBeInTheDocument()
  })

  it('detours a MEI to the Avaliação Prévia and comes back to step 1', async () => {
    const answers = toWireAnswers({ ...applicableFill(3), ehSimei: 'sim' })
    render(<DiagnosisPage bootstrap={bootstrap({ draft: { step: 1, answers, savedAt: '2026-09-14T15:30:00.000Z', protocol: null } })} api={api()} resume />)
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByRole('heading', { name: 'Como MEI, essa escolha não se aplica a você.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para a Avaliação Prévia da Reforma' })).toHaveAttribute('href', 'https://consultoria.austercontabil.com.br/diagnostico-reforma')
    await userEvent.click(screen.getByRole('button', { name: 'Voltar e corrigir' }))
    expect(screen.getByText('Etapa 1 de 5')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3:** Run `pnpm vitest run --project dom src/features/diagnosis/components`. Expected: FAIL — componentes não existem.

- [ ] **Step 4: Tokens e CSS**

Em `src/styles/app.css`: troque `@theme {` por `@theme static {` (o Tailwind 4 só emite variável de tema usada por utilitário; `static` emite todas, e o CSS portado usa as variáveis diretamente), acrescente dentro dele

```css
  --text-meta: 12px;
  --text-body: 14px;
  --text-lead: 16px;
  --text-title: 20px;
  --text-screen: 28px;
  --shadow-auster: 0 1px 2px rgba(5, 44, 71, 0.06), 0 4px 12px rgba(5, 44, 71, 0.05);
```

e, logo depois de `@import 'tailwindcss';`, a linha `@import './diagnosis.css';`.

Crie `src/styles/diagnosis.css` com o porte, pelas três trocas do "Mapa do CSS antigo para o novo", das regras do `<style>` de `modelo.html` cujos seletores antigos são: `header` e filhos (com a consulta de mídia de 560 px), `main`, `.etapa-conta`, `.passos`/`.passo`, `.cartao`, `h1`/`h2`/`h3`, `.campo`, `.obr`, `.opcoes`/`.opcao` (todas as variantes), `textarea`/`input[type=…]`/`select` (com `:focus`), `.matriz-rolo`/`table.matriz` (com a consulta de mídia U-01 de 560 px inteira), `.soma`, `.rodape-nav`, `button` (com `.principal`, `.secundario`, `:hover`, `:disabled`), `.erro`, `.dica`, `.cadastro`, `.privacidade`, `.opcao.aceite`, `.retomar`, `.escopo`, `.encaminha` (com `a.cta`), `.glossario`, `.aviso`, `.campo.destacado` + `@keyframes pisca` e a consulta de mídia final de 560 px (só as regras de `main` e `.cartao` nesta tarefa). `button` vira `.dx-button`; `h1`/`h2`/`h3` viram `.dx h1`/`.dx h2`/`.dx h3`; `main` vira `.dx` (com `max-width:820px;margin:0 auto;padding:28px 24px 48px`). As regras de resultado, conferência, envio e relatório entram nas Tarefas 8 e 9.

- [ ] **Step 5: Componentes**

`SiteHeader`:

```tsx
// src/components/brand/site-header.tsx
export function SiteHeader({ subtitle }: { subtitle: string }) {
  return (
    <header className="dx-header">
      <div className="dx-header-brand">
        <img className="dx-logo is-screen" alt="auster Inteligência Contábil" src="/brand/logo-contabil-negativa.png" />
        <img className="dx-logo is-paper" alt="auster Inteligência Contábil" src="/brand/logo-contabil-positiva.png" />
      </div>
      <div className="dx-header-sub">{subtitle}</div>
    </header>
  )
}
```

`MatrixField` (porte do ramo `matriz` de `campo`):

```tsx
// src/features/diagnosis/components/matrix-field.tsx
import { matrixFooter } from '@/server/diagnosis/domain/matrix-footer'
import type { Answers, MatrixAnswer, Question } from '@/server/diagnosis/domain/question-types'

export function MatrixField({ question, answers, onChange }: { question: Question; answers: Answers; onChange(row: string, value: string): void }) {
  const matrix = (answers[question.key] as MatrixAnswer | undefined) ?? {}
  const columns = question.columns ?? []
  const footer = matrixFooter(answers, question.key)
  const unknown = (value: string) => (value === question.unknownValue ? 'is-unknown' : undefined)
  return (
    <>
      <div className="dx-matrix-scroll">
        <table className="dx-matrix">
          <thead>
            <tr>
              <th />
              {columns.map((column) => (
                <th key={column.value} scope="col" className={unknown(column.value)}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(question.rows ?? []).map((row) => (
              <tr key={row.key}>
                <th scope="row" className="dx-matrix-row">{row.label}</th>
                {columns.map((column) => (
                  <td key={column.value} className={unknown(column.value)}>
                    <label>
                      <input
                        type="radio"
                        name={`${question.key}__${row.key}`}
                        value={column.value}
                        checked={matrix[row.key] === column.value}
                        aria-label={`${row.label}: ${column.label}`}
                        onChange={() => onChange(row.key, column.value)}
                      />
                      <span className="dx-matrix-band">{column.label}</span>
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={footer.warning ? 'dx-matrix-sum is-warning' : 'dx-matrix-sum'}>{footer.text}</div>
    </>
  )
}
```

`CnpjBadge` (porte de `seloCadastro`):

```tsx
// src/features/diagnosis/components/cnpj-badge.tsx
import type { CompanyState } from '../hooks/form-state'

export function CnpjBadge({ state }: { state: CompanyState }) {
  if (state.status === 'idle') return null
  if (state.status === 'loading') return <div className="dx-company is-loading">Conferindo o cadastro na Receita…</div>
  if (state.status === 'failed') {
    return (
      <div className="dx-company is-warning">
        Não deu para consultar o CNPJ agora ({state.reason || 'indisponível'}). <b>Preencha o nome da empresa à mão</b> — o diagnóstico segue igual.
      </div>
    )
  }
  const { company } = state
  const parts = [company.city ? `${company.city}/${company.state}` : null, company.simplesOptant ? 'optante pelo Simples' : 'não optante pelo Simples', company.meiOptant ? 'MEI' : null]
    .filter((part): part is string => part !== null)
  return (
    <div className={company.active ? 'dx-company is-found' : 'dx-company is-warning'}>
      <b>{company.legalName}</b>
      {parts.map((part) => ` · ${part}`).join('')}
      {company.active ? null : (
        <>
          <br />
          Situação cadastral: <b>{company.registrationStatus || 'não ativa'}</b>. Confirme antes de seguir.
        </>
      )}
    </div>
  )
}
```

`PrivacyConsent`: porte literal do ramo `consentimento` de `campo` — a `<div className="dx-privacy">` com os cinco parágrafos ("Para que servem", "Quando são enviadas", "O que é coletado", "Por quanto tempo: 24 meses, contados do envio.", "Seus direitos" com o `mailto:contato@austercontabil.com.br` e "(LGPD, art. 18)"), seguida de `<label className={`dx-option is-consent${checked ? ' is-checked' : ''}`}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span className="dx-option-text"><b>{question.acceptLabel}</b></span></label>`. O rótulo do campo e o erro ficam no `QuestionField`. O parágrafo "Quando são enviadas: ao terminar o preenchimento, automaticamente…" fica como no antigo (E1), embora o rascunho agora vá ao servidor durante o preenchimento (E4): ajustar esse texto é decisão de conteúdo, pendente com o Victor, fora desta etapa.

`QuestionField`: porte de `campo(p)`. Estrutura comum: `<div className={`dx-field${highlighted ? ' is-highlighted' : ''}`} data-field={question.key} ref={ref}>`, rótulo (`<label id={`label-${key}`} htmlFor={textual ? `field-${key}` : undefined}>{question.prompt}{required ? <> <span className="dx-required">*</span></> : null}</label>`), dica (`<div className="dx-hint">`, com `typeof question.hint === 'function' ? question.hint(answers) : question.hint`), o controle pelo tipo, `{error ? <div className="dx-error">{error}</div> : null}` e, só no `cnpj`, `<CnpjBadge state={company} />` depois do erro. Controles:
- `single`: `<div className={`dx-options${short ? ' is-short' : ''}`} role="radiogroup" aria-labelledby={`label-${key}`}>` com uma `<label className={`dx-option${checked ? ' is-checked' : ''}${option.description ? ' has-description' : ''}`}>` por opção: `<input type="radio" name={key} value={option.value} checked={checked} onChange={() => onAnswer(key, option.value)} />` e `<span className="dx-option-text"><b>{option.label}</b>{option.description ? <span className="dx-option-description">{option.description}</span> : null}</span>`.
- `select`: `<select id={`field-${key}`} value={value} onChange={(e) => onAnswer(key, e.target.value)}><option value="">Selecione…</option>{options}</select>`.
- `matrix`: `<MatrixField question={question} answers={answers} onChange={(row, value) => onMatrixAnswer(key, row, value)} />`.
- `consent`: `<PrivacyConsent question={question} checked={answers[key] === 'sim'} onChange={(checked) => onAnswer(key, checked ? 'sim' : '')} />`.
- `textarea`: `<textarea id={`field-${key}`} rows={3} placeholder="Opcional" value={value} onChange={(e) => onAnswer(key, e.target.value)} />`.
- `text`/`email`/`phone`/`cnpj`: `<input id={`field-${key}`} type={type === 'email' ? 'email' : type === 'phone' ? 'tel' : 'text'} inputMode={type === 'phone' ? 'numeric' : 'text'} value={value} onChange={handleText} onBlur={() => onBlur(key)} />`, com `handleText` aplicando a máscara e o cursor como na tabela. 

O destaque: `useEffect(() => { if (!highlighted) return; ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); const t = setTimeout(onHighlightEnd, 1800); return () => clearTimeout(t) }, [highlighted, onHighlightEnd])`.

`StepBar`:

```tsx
// src/features/diagnosis/components/step-bar.tsx
import { BLOCKS } from '@/server/diagnosis/domain/questions'
import { REVIEW_STEP } from '@/server/diagnosis/domain/draft-rules'

export function StepBar({ current, onGoTo }: { current: number; onGoTo(step: number): void }) {
  const steps = [...BLOCKS.map((block) => ({ number: block.number, title: block.title })), { number: REVIEW_STEP, title: 'Conferência' }]
  return (
    <nav className="dx-steps" aria-label="Etapas">
      {steps.map((step, index) => {
        const label = `${index + 1}. ${step.title}`
        if (step.number < current) {
          return <button key={step.number} type="button" className="dx-step is-done" onClick={() => onGoTo(step.number)}>{label}</button>
        }
        return <div key={step.number} className={step.number === current ? 'dx-step is-active' : 'dx-step'} aria-current={step.number === current ? 'step' : undefined}>{label}</div>
      })}
    </nav>
  )
}
```

`ResumeBanner`: porte de `faixaDeRetomada` com a frase alterada; botões `<button className="dx-button is-primary" onClick={onResume}>Retomar</button>` e `<button className="dx-button is-secondary" onClick={onStartOver}>Começar de novo</button>` dentro de `.dx-resume-actions`.

`TriageReferral`: porte literal de `renderEncaminhamento(motivo)` com `reason === 'mei'` no lugar de `mei`; o link usa `https://consultoria.austercontabil.com.br/diagnostico-reforma`; "Voltar e corrigir" chama `onBack`.

`StepForm`:

```tsx
// src/features/diagnosis/components/step-form.tsx
import { useEffect, useRef } from 'react'
import { BLOCKS, visibleQuestions } from '@/server/diagnosis/domain/questions'
import { FORM_STEPS } from '@/server/diagnosis/domain/draft-rules'
import type { DiagnosisForm } from '../hooks/use-diagnosis-form'
import { QuestionField } from './question-field'

export function StepForm({ form, step }: { form: DiagnosisForm; step: number }) {
  const { state, actions } = form
  const block = BLOCKS[step - 1]
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    root.current?.querySelector('.dx-error')?.closest('.dx-field')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [state.errors])

  if (!block) return null
  const questions = visibleQuestions(state.answers).filter((question) => question.block === block.number)
  return (
    <div className="dx-card" ref={root}>
      <h1>{block.title}</h1>
      <p className="dx-step-count">Etapa {step} de {FORM_STEPS}</p>
      {block.notice ? <div className="dx-scope">{block.notice}</div> : null}
      {block.glossary ? (
        <dl className="dx-glossary">
          {block.glossary.map((entry) => (
            <div key={entry.term}>
              <dt>{entry.term}</dt>
              <dd>{entry.meaning}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {questions.map((question) => (
        <QuestionField
          key={question.key}
          question={question}
          answers={state.answers}
          error={state.errors[question.key]}
          highlighted={state.highlight === question.key}
          company={state.company}
          onAnswer={actions.setAnswer}
          onMatrixAnswer={actions.setMatrixAnswer}
          onBlur={actions.blurField}
          onHighlightEnd={actions.clearHighlight}
        />
      ))}
      <div className="dx-nav">
        <button type="button" className="dx-button is-secondary" disabled={step === 1} onClick={actions.back}>Voltar</button>
        <button type="button" className="dx-button is-primary" onClick={actions.next}>{step === FORM_STEPS ? 'Conferir respostas' : 'Próximo'}</button>
      </div>
    </div>
  )
}
```

O glossário antigo era `dt`/`dd` direto no `dl`; o `div` agrupador é HTML válido e não muda o CSS portado (`.dx-glossary dt:first-child` vira `.dx-glossary div:first-child dt`).

`DiagnosisPage` (nesta tarefa, só formulário e encaminhamento; a Tarefa 8 acrescenta conferência e resultado):

```tsx
// src/features/diagnosis/components/diagnosis-page.tsx
import { useEffect } from 'react'
import { SiteHeader } from '@/components/brand/site-header'
import { stepOf } from '../hooks/form-state'
import { useDiagnosisForm } from '../hooks/use-diagnosis-form'
import type { DiagnosisApi, DiagnosisBootstrap } from '../types/diagnosis'
import { ResumeBanner } from './resume-banner'
import { StepBar } from './step-bar'
import { StepForm } from './step-form'
import { TriageReferral } from './triage-referral'

export function DiagnosisPage({ bootstrap, api, resume }: { bootstrap: DiagnosisBootstrap; api: DiagnosisApi; resume: boolean }) {
  const form = useDiagnosisForm(bootstrap, { api, resume })
  const { state, actions } = form
  const { view } = state
  const step = stepOf(view)

  useEffect(() => {
    if (!state.highlight) window.scrollTo(0, 0)
  }, [view.kind, step, state.highlight])

  return (
    <>
      <SiteHeader subtitle="Diagnóstico — Simples padrão ou regime regular de IBS e CBS" />
      <main className="dx">
        {state.saveFailed ? <div className="dx-notice" role="status">Não salvamos suas últimas respostas. Vamos tentar de novo no próximo salvamento.</div> : null}
        {view.kind === 'referral' ? <TriageReferral reason={view.reason} onBack={() => actions.goTo(1)} /> : null}
        {view.kind === 'form' ? (
          <>
            {state.resumable && view.step === 1 ? <ResumeBanner resumable={state.resumable} onResume={actions.resume} onStartOver={actions.startOver} /> : null}
            <StepBar current={step} onGoTo={actions.goTo} />
            <StepForm form={form} step={view.step} />
          </>
        ) : null}
      </main>
    </>
  )
}
```

A mensagem de falha de salvamento é texto novo: o antigo não salvava no servidor. "Voltar e corrigir" volta à etapa 1, como o `irPara(1)` antigo.

Em `tests/setup-dom.ts`, acrescente (o jsdom não implementa rolagem):

```ts
window.scrollTo = () => undefined
Element.prototype.scrollIntoView = () => undefined
```

- [ ] **Step 6: Rota**

```tsx
// src/app/routes/diagnosis/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { diagnosisApi } from '@/features/diagnosis/api/client'
import { loadDraft } from '@/features/diagnosis/api/diagnosis'
import { DiagnosisPage } from '@/features/diagnosis/components/diagnosis-page'

export const Route = createFileRoute('/diagnosis/')({
  validateSearch: z.object({
    invite: z.string().max(32).optional().catch(undefined),
    resume: z.literal('1').optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({ invite: search.invite }),
  loader: ({ deps }) => loadDraft({ data: { invite: deps.invite } }),
  head: () => ({
    meta: [
      { title: 'Diagnóstico — Simples padrão ou híbrido | auster' },
      { name: 'description', content: 'Em 4 a 10 minutos, descubra se a sua empresa do Simples Nacional deve recolher IBS e CBS na guia única ou por fora do DAS. A opção é feita até 30 de setembro de 2026.' },
      { name: 'theme-color', content: '#052C47' },
    ],
  }),
  staleTime: Infinity,
  component: DiagnosisRoute,
})

function DiagnosisRoute() {
  const bootstrap = Route.useLoaderData()
  const { resume } = Route.useSearch()
  return <DiagnosisPage bootstrap={bootstrap} api={diagnosisApi} resume={resume === '1'} />
}
```

`staleTime: Infinity` impede que o roteador recarregue o rascunho por cima do que a pessoa está digitando.

- [ ] **Step 7:** Run `pnpm vitest run --project dom src/features/diagnosis/components && pnpm build && grep -c "color-auster-border-strong" dist/client/assets/*.css`. Expected: PASS; o build regenera `routeTree.gen.ts`; o `grep` acha a variável no CSS publicado. Depois, `pnpm dev` e abra `http://localhost:3000/diagnosis`: etapa 1 com o visual do antigo; em 375 px de largura, a matriz da etapa 3 vira lista sem rolagem lateral.
- [ ] **Step 8: Commit e merge**

```bash
git add public/brand src/styles src/components/brand/site-header.tsx src/features/diagnosis src/app/routes/diagnosis tests/setup-dom.ts
git commit -m "feat(diagnostico): etapas do formulário, matriz acessível, selo do CNPJ, privacidade, triagem e retomada do rascunho"
pnpm lint && pnpm typecheck && pnpm test
git switch teste && git merge --no-ff feat/formulario-do-diagnostico -m "merge: formulário do diagnóstico" && git branch -d feat/formulario-do-diagnostico && git push origin teste
```

---

### Task 8: Conferência, resultado e envio automático

**Files:**
- Create: `src/features/diagnosis/components/review-screen.tsx`, `result-screen.tsx`, `submission-card.tsx`
- Modify: `src/features/diagnosis/components/diagnosis-page.tsx`, `src/features/diagnosis/components/diagnosis-page.test.tsx`, `src/app/routes/diagnosis/index.tsx`, `src/styles/diagnosis.css`
- Test: `src/features/diagnosis/components/review-screen.test.tsx`, `result-screen.test.tsx`, `submission-card.test.tsx`

**Interfaces:**
- Consumes: `reviewItems`, `ReviewView`, `ResultView`, `SubmissionState`, `DiagnosisForm`.
- Produces:
  - `ReviewScreen({ review, onBack, onNext, onChange }: { review: ReviewView; onBack(): void; onNext(): void; onChange(block: number, key: string): void })`
  - `ResultScreen({ view, submission, onRetry, onReview, onDownload }: { view: ResultView; submission: SubmissionState; onRetry(): void; onReview(): void; onDownload(): void })`
  - `SubmissionCard({ submission, onRetry }: { submission: SubmissionState; onRetry(): void })`, `retryWaitText(seconds: number): string`
  - `DiagnosisPage` ganha a prop `onDownloadReport(): void`

Porte (de `git show 22b3cfc:legacy/modelo.html`):

| Antigo | Novo | Regras |
|---|---|---|
| `renderRevisao` (799–851) | `ReviewScreen` | textos literais ("Confira antes de ver o resultado", "Último passo · N respostas", o parágrafo sobre `decide`, o bloco `rev-aviso` com singular/plural, "Etapa N · N resposta(s)", "não respondido", botões "Voltar" e "Ver diagnóstico"); `respostaLegivel` vem pronto em `row.answer` (matriz: uma `.dx-matrix-line` por linha, `is-gap` no "não sei"); "alterar" chama `onChange(row.block, row.key)` |
| `renderResultado` (1214–1412) | `ResultScreen` | mesma ordem e mesmos textos: aviso de baixa confiança, cartão da decisão (`.dx-decision` com `data-certainty`/`data-family`), "Isto é uma leitura de perfil…" + ressalva de método, "O que isso significa para a sua empresa", as quatro `.dx-mini`, radar (com "O radar não influencia a recomendação…"), "O que fazer na sua empresa" ("Antes de 30 de setembro", "Nos próximos meses", "Nada a fazer de imediato do seu lado."), "Como a Auster pode ajudar" (intro, itens, `.dx-fit` com o link da Avaliação Prévia), `SubmissionCard`, "Três coisas para não errar" (as três `.dx-caution` com as fontes legais), conflito, assimetria, notas de pé, botões "Revisar respostas" e "Baixar o plano de ação em PDF". **Saem** o envio por WhatsApp e o painel `?motor=1`. Os valores dinâmicos vêm de `ResultView` (Tarefa 2), campo por campo |
| bloco `bloco-envio` + `enviarRespostas` | `SubmissionCard` | estados abaixo |

`SubmissionCard` (o protocolo vem do servidor; enquanto ele não volta, o título é "Protocolo …"):

| `submission.status` | Conteúdo |
|---|---|
| `idle` / `sending` | `<h2>Protocolo …</h2><p className="dx-submission-text">Enviando…</p>` |
| `sent` | `<h2>Protocolo {protocol}</h2><p className="dx-submission-text is-ok"><b>Respostas enviadas automaticamente.</b> A equipe recebe com este protocolo e retoma o contato pelo e-mail que você informou.</p>` |
| `failed` | `<h2>Protocolo …</h2><p className="dx-submission-text is-error"><b>Não deu para enviar agora</b> ({reason}). Tente outra vez — suas respostas não foram perdidas.</p>` + botão "Enviar minhas respostas agora" |
| `rate_limited` | `<h2>Protocolo …</h2><p className="dx-submission-text is-error"><b>Não deu para enviar agora</b> (muitos envios seguidos deste endereço). Tente de novo em {retryWaitText(s)} — suas respostas não foram perdidas.</p>` + o mesmo botão |

`retryWaitText`: menos de 60 s → `1 segundo` / `N segundos`; senão `1 minuto` / `N minutos` com `Math.ceil(s / 60)`.

"Baixar o plano de ação em PDF" fica desabilitado até `submission.status === 'sent'` (o relatório é da resposta gravada) e então chama `onDownload`.

- [ ] **Step 1: Branch** — `git switch teste && git pull --ff-only && git switch -c feat/resultado-do-diagnostico`

- [ ] **Step 2: Testes que falham**

```tsx
// src/features/diagnosis/components/submission-card.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildActionPlan } from '@/server/diagnosis/domain/action-plan'
import { diagnose } from '@/server/diagnosis/domain/diagnose'
import { resultView } from '@/server/diagnosis/domain/result-view'
import { applicableFill } from '@/server/diagnosis/domain/testing/applicable-fill'
import { SubmissionCard, retryWaitText } from './submission-card'

const answers = applicableFill(7)
const diagnosis = diagnose(answers, new Date('2026-09-15T10:00:00-03:00'))
const result = resultView(diagnosis, buildActionPlan(answers, diagnosis))

describe('SubmissionCard', () => {
  it('says the answers were sent, with the server protocol', () => {
    render(<SubmissionCard submission={{ status: 'sent', protocol: 'DS-260915-AB12', result }} onRetry={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Protocolo DS-260915-AB12' })).toBeInTheDocument()
    expect(screen.getByText(/Respostas enviadas automaticamente\./)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers to try again after a failure and shows the wait after a 429', async () => {
    const onRetry = vi.fn()
    const { rerender } = render(<SubmissionCard submission={{ status: 'failed', reason: 'sem conexão' }} onRetry={onRetry} />)
    expect(screen.getByText(/Não deu para enviar agora/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar minhas respostas agora' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    rerender(<SubmissionCard submission={{ status: 'rate_limited', retryAfterSeconds: 90 }} onRetry={onRetry} />)
    expect(screen.getByText(/Tente de novo em 2 minutos/)).toBeInTheDocument()
  })

  it('formats the wait', () => {
    expect([retryWaitText(1), retryWaitText(45), retryWaitText(60), retryWaitText(61)]).toEqual(['1 segundo', '45 segundos', '1 minuto', '2 minutos'])
  })
})
```

```tsx
// src/features/diagnosis/components/result-screen.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildActionPlan } from '@/server/diagnosis/domain/action-plan'
import { diagnose } from '@/server/diagnosis/domain/diagnose'
import { triageReason } from '@/server/diagnosis/domain/draft-rules'
import { resultView, type ResultView } from '@/server/diagnosis/domain/result-view'
import { generateFills } from '@/server/diagnosis/domain/testing/fill-generator'
import { affirmsMerit } from '@/server/diagnosis/domain/testing/screen-text'
import { ResultScreen } from './result-screen'

const TODAY = new Date('2026-09-15T10:00:00-03:00')
const views: ResultView[] = []
for (const answers of generateFills({ count: 600, seed: 99 })) {
  if (triageReason(answers)) continue
  const diagnosis = diagnose(answers, TODAY)
  views.push(resultView(diagnosis, buildActionPlan(answers, diagnosis)))
}
const sent = { status: 'sent' as const, protocol: 'DS-260915-AB12', result: views[0] as ResultView }
const draw = (view: ResultView) => render(<ResultScreen view={view} submission={sent} onRetry={() => undefined} onReview={() => undefined} onDownload={() => undefined} />)

describe('ResultScreen', () => {
  it('shows the November protection on hybrid decisions', () => {
    const hybrid = views.find((view) => view.decision.family === 'hibrido')
    if (!hybrid) throw new Error('a amostra não gerou decisão híbrida')
    draw(hybrid)
    expect(screen.getByText('Setembro não volta; novembro ainda dá.')).toBeInTheDocument()
    expect(document.body.textContent).toContain('30 de novembro de 2026')
  })

  it('never shows undefined, NaN, null or an economic merit claim, and dropped WhatsApp and the engine panel', () => {
    for (const view of views.slice(0, 200)) {
      const { container, unmount } = draw(view)
      const text = container.textContent ?? ''
      expect(text).not.toMatch(/\b(undefined|NaN|null)\b/)
      expect(affirmsMerit(text)).toBeNull()
      expect(text).not.toMatch(/WhatsApp|dados do motor/)
      unmount()
    }
  })

  it('keeps the three cautions and the two closing buttons', () => {
    draw(views[0] as ResultView)
    expect(screen.getByText('Três coisas para não errar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar respostas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Baixar o plano de ação em PDF' })).toBeEnabled()
  })
})
```

```tsx
// src/features/diagnosis/components/review-screen.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { reviewItems } from '@/server/diagnosis/domain/review'
import { visibleQuestions } from '@/server/diagnosis/domain/questions'
import { applicableFill } from '@/server/diagnosis/domain/testing/applicable-fill'
import { ReviewScreen } from './review-screen'

describe('ReviewScreen', () => {
  it('lists every visible question, tags the deciding ones and jumps to the field', async () => {
    const answers = applicableFill(5)
    const onChange = vi.fn()
    const { container } = render(<ReviewScreen review={reviewItems(answers)} onBack={() => undefined} onNext={() => undefined} onChange={onChange} />)
    expect(container.querySelectorAll('.dx-review-row')).toHaveLength(visibleQuestions(answers).length)
    expect(screen.getAllByText('decide').length).toBeGreaterThan(1)
    await userEvent.click(screen.getAllByRole('button', { name: 'alterar' })[0] as HTMLElement)
    expect(onChange).toHaveBeenCalledWith(1, expect.any(String))
  })

  it('lists the gaps that weigh on the decision', () => {
    const answers = { ...applicableFill(5), margemLiquida: 'nao_sei' }
    render(<ReviewScreen review={reviewItems(answers)} onBack={() => undefined} onNext={() => undefined} onChange={() => undefined} />)
    expect(screen.getByText(/em "não sei"/)).toBeInTheDocument()
  })
})
```

`margemLiquida` é essencial e sempre visível, e `nao_sei` é o seu `unknownValue`: o segundo caso sempre tem uma lacuna que pesa na decisão.

- [ ] **Step 3:** Run `pnpm vitest run --project dom src/features/diagnosis/components`. Expected: FAIL — `review-screen`, `result-screen`, `submission-card` não existem.

- [ ] **Step 4: CSS** — acrescente a `src/styles/diagnosis.css` o porte das regras antigas de `.selo`, `.saida`, `.regime` (todas), `.precisa-numeros`, `.rev-*` e `.campo.destacado`/`@keyframes pisca` se ainda não vieram, `.bloco-envio`, `.envio`, `.encaixe`, `.grade`, `.mini`, `.eixo`, `.barra`, `.acao`, `.cartao.significa`, `.bloco-auster`, `.conflito`, `.assimetria`, `.fonte-legal`, `.atencao`, `.notas-pe`, `.ressalva`, e as regras restantes da consulta de mídia final de 560 px (`.regime`, `.precisa-numeros`, `.atencao`, `.grade`), pela tabela de nomes. `.debug` não é portado.

- [ ] **Step 5: Componentes**

`SubmissionCard`:

```tsx
// src/features/diagnosis/components/submission-card.tsx
import type { SubmissionState } from '../hooks/form-state'

export function retryWaitText(seconds: number): string {
  if (seconds < 60) return seconds === 1 ? '1 segundo' : `${seconds} segundos`
  const minutes = Math.ceil(seconds / 60)
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`
}

export function SubmissionCard({ submission, onRetry }: { submission: SubmissionState; onRetry(): void }) {
  const retry = (
    <button type="button" className="dx-button is-primary" onClick={onRetry}>Enviar minhas respostas agora</button>
  )
  return (
    <div className="dx-card dx-submission">
      <h2>Protocolo {submission.status === 'sent' ? submission.protocol : '…'}</h2>
      {submission.status === 'sent' ? (
        <p className="dx-submission-text is-ok">
          <b>Respostas enviadas automaticamente.</b> A equipe recebe com este protocolo e retoma o contato pelo e-mail que você informou.
        </p>
      ) : null}
      {submission.status === 'idle' || submission.status === 'sending' ? <p className="dx-submission-text">Enviando…</p> : null}
      {submission.status === 'failed' ? (
        <>
          <p className="dx-submission-text is-error">
            <b>Não deu para enviar agora</b> ({submission.reason}). Tente outra vez — suas respostas não foram perdidas.
          </p>
          {retry}
        </>
      ) : null}
      {submission.status === 'rate_limited' ? (
        <>
          <p className="dx-submission-text is-error">
            <b>Não deu para enviar agora</b> (muitos envios seguidos deste endereço). Tente de novo em {retryWaitText(submission.retryAfterSeconds)} — suas respostas não foram perdidas.
          </p>
          {retry}
        </>
      ) : null}
    </div>
  )
}
```

`ReviewScreen` e `ResultScreen`: porte literal pelas tabelas desta tarefa. Em `ResultScreen`, cada `${…}` do antigo vira o campo do `ResultView`:

| Antigo | `ResultView` |
|---|---|
| `d.preliminar`, `d.confianca.lacunas.length`, `d.confianca.lacunasLegiveis` | `lowConfidence` (`gapCount`, `readableGaps.join('; ')`) |
| `d.posicao.{certeza,familia,rotulo,qualificador,acaoUnica,pontosEmAberto,detalhe}` | `decision.{certainty,family,label,qualifier,singleAction,openPoints,detail}` |
| `d.leituraPreliminar.condicao`, `.modalidade.rotulo` | `decision.preliminaryReading.{condition,modalityLabel}` |
| prefixo "Indicação preliminar —", `d.saida.titulo`, `d.saida.resumo` | `decision.why.{preliminary,title,summary}` |
| cartão `trava` | `decision.showWithdrawalNotice` |
| `d.saida.significa` | `meaning` |
| caixa "Janela legal" | `windowText` |
| caixa "Protocolar até" | `filingDeadline.{value,note}` |
| `d.urgencia` | `urgency` (`<span className="dx-level" data-level={urgency}>`) |
| `d.confianca.nivel` + nota de DAS estimado | `confidence.{level,dasEstimated}` |
| `d.radar[]` (`titulo`, `score`, `faixa`, classe da barra, `width`) | `radar[]` (`title`, `scoreText`, `band`, `tone` → `data-tone`, `width` → `style={{ width: `${width}%` }}`) |
| `plano.clienteAgora/clienteDepois/auster`, `i.acao/porque/precisa/fundamento` | `plan.{clientNow,clientLater,auster}`, `item.action/reason/requires/legalBasis` |
| `d.conflito.{conflito,decide,levantar}` | `conflict.{conflict,decides,gather}` |
| `d.assimetria.{titulo,texto,paraQuemFica,fonte}` | `asymmetry.{title,text,forWhom,source}` (`forWhom` já vem nulo fora de `padrao`) |

`{` `}` de JSX substituem o `esc()` antigo; não use `dangerouslySetInnerHTML`.

`DiagnosisPage`: acrescente a prop `onDownloadReport(): void` e os ramos

```tsx
        {view.kind === 'review' ? (
          <>
            <StepBar current={step} onGoTo={actions.goTo} />
            <ReviewScreen review={reviewItems(state.answers)} onBack={actions.back} onNext={actions.next} onChange={actions.goToField} />
          </>
        ) : null}
        {view.kind === 'result' && form.shownResult ? (
          <ResultScreen view={form.shownResult} submission={state.submission} onRetry={actions.retrySubmit} onReview={() => actions.goTo(6)} onDownload={onDownloadReport} />
        ) : null}
```

(com os imports de `ReviewScreen`, `ResultScreen` e `reviewItems`). Em `diagnosis-page.test.tsx`, acrescente `onDownloadReport={() => undefined}` a cada `<DiagnosisPage …/>`. Na rota, passe `onDownloadReport={() => window.location.assign('/diagnosis/report?print=1')}`: o relatório abre em carga de página inteira (SSR com o título do arquivo já no `<head>`), e a rota não depende do tipo da rota que só nasce na Tarefa 9.

- [ ] **Step 6:** Run `pnpm vitest run --project dom src/features/diagnosis`. Expected: PASS. Depois `pnpm dev`, faça o caminho curto até o resultado e confira no banco de desenvolvimento: `docker compose exec postgres psql -U app -d forms_victor_dev -c "select protocol, outcome, position from responses order by id desc limit 1"`.
- [ ] **Step 7: Commit e merge**

```bash
git add src/features/diagnosis src/app/routes/diagnosis src/styles/diagnosis.css
git commit -m "feat(diagnostico): conferência, resultado com os textos do antigo e envio automático com nova tentativa e espera do 429"
pnpm lint && pnpm typecheck && pnpm test
git switch teste && git merge --no-ff feat/resultado-do-diagnostico -m "merge: resultado do diagnóstico" && git branch -d feat/resultado-do-diagnostico && git push origin teste
```

---

### Task 9: Relatório de 6 folhas, impressão e título do arquivo

**Files:**
- Create: `src/features/diagnosis/components/report-document.tsx`, `src/lib/print.ts`, `src/app/routes/diagnosis/report.tsx`
- Modify: `src/styles/diagnosis.css`
- Test: `src/features/diagnosis/components/report-document.test.tsx`, `src/lib/print.test.ts`

**Interfaces:**
- Consumes: `ReportSheets` (Tarefa 2), `getSubmittedReport` (Tarefa 5).
- Produces:
  - `ReportDocument({ sheets, toolbar }: { sheets: ReportSheets; toolbar: React.ReactNode })`
  - `src/lib/print.ts`: `FONT_WAIT_CEILING_MS = 1500`, `printWhenReady(title: string): Promise<void>`
  - rota `/diagnosis/report` com `validateSearch` `{ print?: '1' }`, `loader` → `getSubmittedReport()`, `head` com o título = `sheets.fileName`

Porte de `renderRelatorio` (linhas 1062–1212 de `modelo.html`) em `ReportDocument`, com os textos literais e a mesma ordem das seis `<section className="rp-sheet">`: capa (`is-cover`, "Diagnóstico preliminar", título em duas linhas, tabela `rp-header-table` com Empresa/CNPJ/Quem respondeu/Protocolo/Emitido em/Versão respondida, `rp-decision` com `data-certainty`, `rp-open`, `rp-note`); "O que isso significa para a sua empresa" (conflito, assimetria com `forWhom`, "Os três nomes, para não confundir" e, quando `meaning.showDeadlines`, "Os prazos, em ordem" com as três linhas e a fonte); "O que fazer na sua empresa" (`rp-action` numerada); "Como a Auster pode ajudar" só quando `auster.length > 0`; "Resumo do que foi preenchido" (uma `<table className="rp-summary">` por bloco, `<td className="rp-summary-question">` + `<td className="rp-summary-answer">`, "—" quando `answer` é nulo, matriz em `.dx-matrix-line`, `is-gap` em âmbar; "Em suas palavras" com `rp-free`); "Três coisas para não errar" (`rp-cautions`, `rp-note`, `rp-footer` com `sheets.footer` e "auster Inteligência Contábil"). O `toolbar` vai em `<div className="rp-toolbar">` antes das folhas. A raiz é `<div className="rp">`.

`printWhenReady` é o porte de `imprimirQuandoPronto` + `doisQuadros` + a troca de `document.title` de `imprimirRelatorio`: dois `requestAnimationFrame`, depois `Promise.race([document.fonts.ready, espera de 1 500 ms])`, troca o título, `window.print()`, e devolve o título anterior no `afterprint`.

- [ ] **Step 1: Branch** — `git switch teste && git pull --ff-only && git switch -c feat/relatorio-do-diagnostico`

- [ ] **Step 2: Testes que falham**

```ts
// src/lib/print.test.ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FONT_WAIT_CEILING_MS, printWhenReady } from './print'

afterEach(() => vi.useRealTimers())

describe('printWhenReady', () => {
  it('waits for the fonts, prints with the file name as title and restores it afterwards', async () => {
    const print = vi.fn()
    window.print = print
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
    document.title = 'Diagnóstico'
    await printWhenReady('Plano-De-Acao-SN-Empresa')
    expect(print).toHaveBeenCalledTimes(1)
    expect(document.title).toBe('Plano-De-Acao-SN-Empresa')
    window.dispatchEvent(new Event('afterprint'))
    expect(document.title).toBe('Diagnóstico')
  })

  it('does not wait more than 1.5 s for fonts that never arrive', async () => {
    vi.useFakeTimers()
    const print = vi.fn()
    window.print = print
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise(() => undefined) } })
    const done = printWhenReady('X')
    await vi.advanceTimersByTimeAsync(FONT_WAIT_CEILING_MS + 50)
    await done
    expect(print).toHaveBeenCalledTimes(1)
  })
})
```

```tsx
// src/features/diagnosis/components/report-document.test.tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildActionPlan } from '@/server/diagnosis/domain/action-plan'
import { diagnose } from '@/server/diagnosis/domain/diagnose'
import { triageReason } from '@/server/diagnosis/domain/draft-rules'
import { reportSheets } from '@/server/diagnosis/domain/report-sheets'
import { generateFills } from '@/server/diagnosis/domain/testing/fill-generator'
import { affirmsMerit } from '@/server/diagnosis/domain/testing/screen-text'
import { ReportDocument } from './report-document'

const TODAY = new Date('2026-09-15T10:00:00-03:00')

describe('ReportDocument', () => {
  it('draws 5 or 6 sheets, one summary row per choice question, the protocol and no merit claim', () => {
    let drawn = 0
    for (const answers of generateFills({ count: 300, seed: 31 })) {
      if (triageReason(answers)) continue
      const diagnosis = diagnose(answers, TODAY)
      const sheets = reportSheets({ answers, protocol: 'DS-260915-AB12', issuedOn: TODAY }, diagnosis, buildActionPlan(answers, diagnosis))
      const { container, unmount } = render(<ReportDocument sheets={sheets} toolbar={null} />)
      const text = container.textContent ?? ''
      expect(container.querySelectorAll('.rp-sheet')).toHaveLength(sheets.sheetCount)
      expect(container.querySelectorAll('td.rp-summary-question')).toHaveLength(sheets.summary.blocks.reduce((n, b) => n + b.rows.length, 0))
      expect(text).toContain('DS-260915-AB12')
      expect(text).not.toMatch(/\b(undefined|NaN|null)\b/)
      expect(affirmsMerit(text)).toBeNull()
      if (sheets.meaning.showDeadlines) expect(text).toContain('30 de novembro de 2026')
      unmount()
      drawn++
    }
    expect(drawn).toBeGreaterThan(100)
  })
})
```

- [ ] **Step 3:** Run `pnpm vitest run src/lib/print.test.ts && pnpm vitest run --project dom src/features/diagnosis/components/report-document.test.tsx`. Expected: FAIL — `print` e `report-document` não existem.

- [ ] **Step 4: Impressão**

```ts
// src/lib/print.ts
export const FONT_WAIT_CEILING_MS = 1500

const twoFrames = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame !== 'function') return resolve()
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

// Printing before Kanit arrives yields Arial, which has no Light or Medium: the PDF loses every weight.
export async function printWhenReady(title: string): Promise<void> {
  const ceiling = new Promise<void>((resolve) => setTimeout(resolve, FONT_WAIT_CEILING_MS))
  await twoFrames()
  await Promise.race([document.fonts?.ready ?? ceiling, ceiling])
  const previous = document.title
  document.title = title
  window.addEventListener('afterprint', () => void (document.title = previous), { once: true })
  window.print()
}
```

- [ ] **Step 5: CSS do relatório e da impressão** — acrescente a `src/styles/diagnosis.css` o porte de `.barra-doc` até `.doc-rodape`, da consulta de mídia de 560 px das folhas e dos **dois** blocos `@media print` do antigo, pela tabela de nomes. No segundo bloco, `@page { margin: 10mm; }` fica como está; `header` vira `.dx-header`, `main` vira `.dx`; a lista de coisas escondidas na impressão vira `.dx-steps, .dx-nav, .dx-resume, .dx-needs-numbers button, .dx-submission button, .dx-fit a.dx-cta { display: none !important }`; e acrescente `.rp-toolbar { display: none !important }` no primeiro.

- [ ] **Step 6: `ReportDocument` e a rota** — porte literal descrito acima, consumindo `ReportSheets` campo por campo (`cover.*`, `meaning.*`, `plan.clientNow/clientLater` com `number`, `auster`, `summary.blocks/freeText`, `footer`).

```tsx
// src/app/routes/diagnosis/report.tsx
import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'
import { SiteHeader } from '@/components/brand/site-header'
import { getSubmittedReport } from '@/features/diagnosis/api/diagnosis'
import { ReportDocument } from '@/features/diagnosis/components/report-document'
import { printWhenReady } from '@/lib/print'

export const Route = createFileRoute('/diagnosis/report')({
  validateSearch: z.object({ print: z.literal('1').optional().catch(undefined) }),
  loader: () => getSubmittedReport(),
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.fileName ?? 'Plano de ação | auster' }] }),
  component: ReportRoute,
})

function ReportRoute() {
  const sheets = Route.useLoaderData()
  const { print } = Route.useSearch()

  useEffect(() => {
    if (sheets && print === '1') void printWhenReady(sheets.fileName)
  }, [sheets, print])

  return (
    <>
      <SiteHeader subtitle="Diagnóstico — Simples padrão ou regime regular de IBS e CBS" />
      <main className="dx">
        {sheets ? (
          <ReportDocument
            sheets={sheets}
            toolbar={
              <>
                <Link to="/diagnosis" search={{ resume: '1' }} className="dx-button is-secondary">Voltar ao diagnóstico</Link>
                <button type="button" className="dx-button is-primary" onClick={() => void printWhenReady(sheets.fileName)}>Imprimir ou salvar em PDF</button>
              </>
            }
          />
        ) : (
          <div className="dx-card">
            <h1>Nenhum diagnóstico enviado neste navegador</h1>
            <p>O plano de ação sai da resposta enviada. Faça o diagnóstico até o resultado e baixe o PDF de lá.</p>
            <Link to="/diagnosis" className="dx-button is-primary">Fazer o diagnóstico</Link>
          </div>
        )}
      </main>
    </>
  )
}
```

"Voltar ao diagnóstico" leva a `/diagnosis?resume=1`, que retoma direto no resultado (o rascunho guarda a etapa 7), como o `voltarDoRelatorio` antigo. Os dois textos do caso sem relatório são novos (o antigo não tinha essa rota).

- [ ] **Step 7:** Run `pnpm build && pnpm vitest run src/lib && pnpm vitest run --project dom src/features/diagnosis`. Expected: PASS. Em `pnpm dev`, do resultado, "Baixar o plano de ação em PDF" abre o relatório, a caixa de impressão aparece com o nome `Plano-De-Acao-SN-<EMPRESA>` e a pré-visualização tem 5 ou 6 páginas, sem trilha, botões nem sombras.
- [ ] **Step 8: Commit e merge**

```bash
git add src/lib/print.ts src/lib/print.test.ts src/features/diagnosis src/app/routes/diagnosis src/styles/diagnosis.css
git commit -m "feat(diagnostico): relatório de seis folhas com CSS de impressão, espera da fonte e nome do arquivo no título"
pnpm lint && pnpm typecheck && pnpm test
git switch teste && git merge --no-ff feat/relatorio-do-diagnostico -m "merge: relatório do diagnóstico" && git branch -d feat/relatorio-do-diagnostico && git push origin teste
```

---
### Task 10: Backoffice de respostas (lista, ficha, tratamento, relatório e CSV)

**Files:**
- Create: `src/server/diagnosis/ports/response-backoffice-repository.ts`, `src/server/diagnosis/application/backoffice-responses.ts`, `src/features/backoffice-responses/api/responses.ts`, `src/features/backoffice-responses/api/queries.ts`, `src/features/backoffice-responses/components/responses-panel.tsx`, `src/features/backoffice-responses/components/response-detail.tsx`, `src/components/backoffice/backoffice-shell.tsx`, `src/styles/backoffice.css`, `src/app/routes/backoffice/responses/$id/report.tsx`, `src/app/routes/backoffice/responses[.]csv.ts`
- Modify: `src/server/diagnosis/application/testing/fakes.ts`, `src/server/diagnosis/adapters/prisma-response-repository.ts`, `src/server/diagnosis/composition.ts`, `src/app/routes/backoffice/index.tsx`, `src/styles/app.css`
- Test: `src/server/diagnosis/application/backoffice-responses.test.ts`, `src/server/diagnosis/adapters/prisma-response-backoffice.int.test.ts`, `src/features/backoffice-responses/components/response-detail.test.tsx`

**Interfaces:**
- Consumes: Tarefa 2 (`readStoredPayload`, `answerBlocks`, `csvRows`, `toCsv`, `csvFileName`, `RESPONSE_STATUSES`, `RESPONSE_STATUS_LABELS`, `formatShortDateTime`), Tarefa 4 (`ResponseRecord`, `toResponseRecord`, `responseInclude`, `diagnosisReports.responseReport`), Tarefa 9 (`ReportDocument`, `printWhenReady`), `sessionMiddleware`, `getSessionUser`, `LogoutButton`.
- Produces:
  - Porta `ResponseBackofficeRepository { list(filter: ResponseFilter, page: { skip: number; take: number }): Promise<{ items: ResponseRecord[]; total: number }>; countByStatus(): Promise<Record<ResponseStatus, number>>; findById(id: number): Promise<ResponseRecord | null>; listForExport(filter: ResponseFilter, limit: number): Promise<ResponseRecord[]>; setNote(id: number, note: string): Promise<boolean>; setStatus(id: number, change: { status: ResponseStatus; note: string; handledById: string; handledAt: Date }): Promise<boolean> }`, `ResponseFilter = { status?: ResponseStatus; search?: string }`
  - `@/server/diagnosis/composition`: `responseBackoffice.listResponses(input: ResponseFilter & { page?: number }): Promise<ResponseList>`, `responseBackoffice.getResponse(id: number): Promise<ResponseDetail | null>`, `responseBackoffice.handleResponse(actor: BackofficeActor, input: { id: number; status: ResponseStatus | null; note: string }): Promise<{ ok: true } | { ok: false; message: string }>`, `responseBackoffice.exportResponses(actor: BackofficeActor, filter: ResponseFilter): Promise<{ fileName: string; body: string; count: number }>`; `PAGE_SIZE = 50`, `EXPORT_LIMIT = 5000`
  - Server functions: `listResponsesFn`, `getResponseFn`, `handleResponseFn`, `getResponseReportFn` (todas com `sessionMiddleware`); `responsesQuery(filter)`, `responseQuery(id)` (`queryOptions`)
  - Componentes: `BackofficeShell({ userName, nav, logout, children })`, `ResponsesPanel({ filter, onFilterChange })`, `ResponseDetail({ detail, pending, onHandle, onClose })`
  - Rotas: `/backoffice/` com `validateSearch` `{ tab?: 'responses'; status?: ResponseStatus; q?: string; page?: number }`; `/backoffice/responses/$id/report`; `/backoffice/responses.csv`

Porte (de `git show 22b3cfc:legacy/backoffice.html`, `servidor.mjs` e `banco.mjs`):

| Antigo | Novo |
|---|---|
| cabeçalho + `.abas` | `BackofficeShell` (a aba Usuários só para admin chega na Tarefa 12) |
| `verRespostas` (contagem, filtros, tabela, nota) | `ResponsesPanel` (mesmos textos, mais a paginação de 50: "Anterior", "Página N de M", "Próxima") |
| `abrirFicha` + `valorLegivel` | `ResponseDetail` (dialog do `radix-ui`), lendo `ResponseDetail.answers` (`answerBlocks`) |
| `window.tratar(id, situacao)` / `banco.tratarResposta` | `handleResponse` — **"Só salvar a nota" não muda quem tratou nem quando** (o antigo mudava) |
| `banco.respostas({ situacao, busca })` (LIKE em empresa, CNPJ, protocolo, solicitante; 200 linhas) | `list` (ILIKE nos mesmos campos e no `cnpjDigits`; página de 50) |
| `banco.contagem()` | `countByStatus` + `total` |
| `/api/backoffice/planilha.csv` + `planilha_exportada` | `/backoffice/responses.csv` + `spreadsheet_exported` (`detail: { kind: 'responses', count, status, search }`) |
| `/backoffice/relatorio?id=` | `/backoffice/responses/$id/report` (o 301 já existe em `legacy-redirects.ts`) |

Texto novo na ficha (o antigo não tinha alteração pelo cliente): quando `changedAfterHandling`, um `.bo-alert` com **"Alterada pelo cliente em {data}, depois do último tratamento. Confira as respostas de novo."**

- [ ] **Step 1: Branch** — `git switch teste && git pull --ff-only && git switch -c feat/backoffice-respostas`

- [ ] **Step 2: Porta e fakes**

```ts
// src/server/diagnosis/ports/response-backoffice-repository.ts
import type { ResponseStatus } from '../domain/response-status'
import type { ResponseRecord } from './response-repository'

export interface ResponseFilter {
  status?: ResponseStatus
  search?: string
}

export interface ResponseBackofficeRepository {
  list(filter: ResponseFilter, page: { skip: number; take: number }): Promise<{ items: ResponseRecord[]; total: number }>
  countByStatus(): Promise<Record<ResponseStatus, number>>
  findById(id: number): Promise<ResponseRecord | null>
  listForExport(filter: ResponseFilter, limit: number): Promise<ResponseRecord[]>
  setNote(id: number, note: string): Promise<boolean>
  setStatus(id: number, change: { status: ResponseStatus; note: string; handledById: string; handledAt: Date }): Promise<boolean>
}
```

Em `src/server/diagnosis/application/testing/fakes.ts`, o `memoryResponses()` passa a implementar as duas portas e recebe um mapa de usuários para resolver o nome de quem tratou. Substitua a função inteira por:

```ts
export function memoryResponses(usernames: Record<string, string> = {}) {
  const rows = new Map<number, ResponseRecord>()
  let sequence = 0
  const repository: ResponseRepository = {
    protocolExists: async (protocol) => [...rows.values()].some((row) => row.protocol === protocol),
    create: async (input) => {
      const record: ResponseRecord = { ...input, id: ++sequence, updatedAt: null, status: 'new', internalNote: null, handledByUsername: null, handledAt: null }
      rows.set(record.id, record)
      return record
    },
    update: async (id, input) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, ...input })
    },
    findById: async (id) => rows.get(id) ?? null,
  }
  const matches = (row: ResponseRecord, filter: ResponseFilter) =>
    (!filter.status || row.status === filter.status) &&
    (!filter.search || [row.companyName, row.protocol, row.cnpj, row.requester].some((value) => value?.toLowerCase().includes(filter.search?.toLowerCase() ?? '')))
  const sorted = () => [...rows.values()].sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime() || b.id - a.id)
  const backoffice: ResponseBackofficeRepository = {
    list: async (filter, { skip, take }) => {
      const found = sorted().filter((row) => matches(row, filter))
      return { items: found.slice(skip, skip + take), total: found.length }
    },
    countByStatus: async () => {
      const counts = { new: 0, in_review: 0, validated: 0, discarded: 0 }
      for (const row of rows.values()) counts[row.status]++
      return counts
    },
    findById: async (id) => rows.get(id) ?? null,
    listForExport: async (filter, limit) => sorted().filter((row) => matches(row, filter)).slice(0, limit),
    setNote: async (id, note) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, internalNote: note })
      return Boolean(row)
    },
    setStatus: async (id, { status, note, handledById, handledAt }) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, status, internalNote: note, handledByUsername: usernames[handledById] ?? handledById, handledAt })
      return Boolean(row)
    },
  }
  const both: ResponseRepository & ResponseBackofficeRepository = { ...repository, ...backoffice }
  return { rows, repository: both }
}
```

(com `import type { ResponseBackofficeRepository, ResponseFilter } from '../../ports/response-backoffice-repository'`).

- [ ] **Step 3: Testes que falham**

```ts
// src/server/diagnosis/application/backoffice-responses.test.ts
import { describe, expect, it } from 'vitest'
import { buildStoredPayload, responseProjections } from '../domain/stored-payload'
import { diagnose } from '../domain/diagnose'
import { applicableFill } from '../domain/testing/applicable-fill'
import { PAGE_SIZE, makeResponseBackoffice } from './backoffice-responses'
import { fakeClock, memoryResponses } from './testing/fakes'

const answers = applicableFill(13)
const payload = buildStoredPayload(answers, diagnose(answers, new Date('2026-09-15T12:00:00Z')), true)
const actor = { id: 'u-bia', username: 'bia' }

async function setup(count = 3) {
  const responses = memoryResponses({ 'u-maria': 'maria', 'u-bia': 'bia' })
  for (let i = 0; i < count; i++) {
    await responses.repository.create({ ...responseProjections(payload), payload, protocol: `DS-260915-A${String(i).padStart(3, '0')}`, invitationToken: i === 0 ? 'ABCDEFGHJK' : null, receivedAt: new Date(Date.UTC(2026, 8, 15, 12, i)) })
  }
  const audits: { action: string; reference: string; detail: Record<string, unknown> }[] = []
  const clock = fakeClock('2026-10-01T02:00:00Z')
  const backoffice = makeResponseBackoffice({ responses: responses.repository, clock, recordAudit: async (entry) => void audits.push(entry) })
  return { responses, audits, backoffice }
}

describe('response back office', () => {
  it('pages by 50, newest first, with the counters', async () => {
    const { backoffice } = await setup(120)
    const third = await backoffice.listResponses({ page: 3 })
    expect(PAGE_SIZE).toBe(50)
    expect(third).toMatchObject({ total: 120, page: 3, pageCount: 3, counts: { total: 120, new: 120, in_review: 0 } })
    expect(third.items).toHaveLength(20)
    const first = await backoffice.listResponses({})
    expect(first.items[0]?.protocol).toBe('DS-260915-A119')
    expect(first.items.at(-1)?.viaInvitation).toBe(false)
  })

  it('records who handled it, and saving only the note keeps the last handler', async () => {
    const { backoffice, responses, audits } = await setup()
    await backoffice.handleResponse({ id: 'u-maria', username: 'maria' }, { id: 1, status: 'in_review', note: 'conferir CNPJ' })
    await backoffice.handleResponse(actor, { id: 1, status: null, note: 'CNPJ conferido' })
    const detail = await backoffice.getResponse(1)
    expect(detail).toMatchObject({ status: 'in_review', internalNote: 'CNPJ conferido', handledBy: 'maria', handledAt: '2026-10-01T02:00:00.000Z' })
    expect(responses.rows.get(1)?.handledByUsername).toBe('maria')
    expect(audits.map((a) => [a.action, a.detail.noteOnly])).toEqual([['response_handled', false], ['response_handled', true]])
  })

  it('warns when the client changed the response after the last handling', async () => {
    const { backoffice, responses } = await setup()
    await backoffice.handleResponse(actor, { id: 2, status: 'validated', note: '' })
    await responses.repository.update(2, { ...responseProjections(payload), payload, updatedAt: new Date('2026-10-02T12:00:00Z') })
    expect((await backoffice.getResponse(2))?.changedAfterHandling).toBe(true)
    expect((await backoffice.getResponse(3))?.changedAfterHandling).toBe(false)
    expect(await backoffice.getResponse(99)).toBeNull()
  })

  it('exports what the screen filters, audits it and names the file by the Brasília date', async () => {
    const { backoffice, audits } = await setup()
    await backoffice.handleResponse(actor, { id: 1, status: 'discarded', note: '' })
    const file = await backoffice.exportResponses(actor, { status: 'discarded' })
    expect(file.fileName).toBe('respostas-simples-2026-09-30.csv')
    expect(file.count).toBe(1)
    expect(file.body.startsWith('﻿protocolo;')).toBe(true)
    expect(file.body.split('\r\n')).toHaveLength(3)
    expect(audits.at(-1)).toMatchObject({ action: 'spreadsheet_exported', reference: '1', detail: { kind: 'responses', status: 'discarded' } })
  })

  it('refuses to handle a response that does not exist', async () => {
    const { backoffice } = await setup()
    expect(await backoffice.handleResponse(actor, { id: 99, status: 'validated', note: '' })).toEqual({ ok: false, message: 'Resposta não encontrada.' })
  })
})
```

```ts
// src/server/diagnosis/adapters/prisma-response-backoffice.int.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import { prismaResponseBackofficeRepository } from './prisma-response-repository'

const base = { payload: {}, status: 'new' as const }

describe('prismaResponseBackofficeRepository', () => {
  beforeEach(async () => {
    await resetDatabase()
    await prisma.user.create({ data: { id: 'u1', name: 'Maria', email: 'maria@users.invalid', username: 'maria' } })
    await prisma.response.createMany({
      data: [
        { ...base, protocol: 'DS-260915-AAAA', companyName: 'Padaria Boa', cnpj: '11.222.333/0001-81', cnpjDigits: '11222333000181', requester: 'Ana', receivedAt: new Date('2026-09-15T12:00:00Z') },
        { ...base, protocol: 'DS-260916-BBBB', companyName: 'Oficina Nova', requester: 'Bruno', receivedAt: new Date('2026-09-16T12:00:00Z'), status: 'validated' },
      ],
    })
  })

  it('searches company, CNPJ with or without mask, protocol and requester, newest first', async () => {
    const page = { skip: 0, take: 50 }
    expect((await prismaResponseBackofficeRepository.list({}, page)).items.map((r) => r.protocol)).toEqual(['DS-260916-BBBB', 'DS-260915-AAAA'])
    for (const search of ['padaria', '11222333', '11.222.333', 'bbbb', 'bruno']) {
      expect((await prismaResponseBackofficeRepository.list({ search }, page)).total).toBe(1)
    }
    expect((await prismaResponseBackofficeRepository.list({ status: 'validated' }, page)).items[0]?.companyName).toBe('Oficina Nova')
    expect(await prismaResponseBackofficeRepository.countByStatus()).toEqual({ new: 1, in_review: 0, validated: 1, discarded: 0 })
  })

  it('sets status with handler, and the note alone without touching the handler', async () => {
    const [first] = (await prismaResponseBackofficeRepository.list({ search: 'padaria' }, { skip: 0, take: 1 })).items
    if (!first) throw new Error('sem resposta')
    const at = new Date('2026-09-20T12:00:00Z')
    expect(await prismaResponseBackofficeRepository.setStatus(first.id, { status: 'in_review', note: 'a', handledById: 'u1', handledAt: at })).toBe(true)
    expect(await prismaResponseBackofficeRepository.setNote(first.id, 'b')).toBe(true)
    expect(await prismaResponseBackofficeRepository.findById(first.id)).toMatchObject({ status: 'in_review', internalNote: 'b', handledByUsername: 'maria', handledAt: at })
    expect(await prismaResponseBackofficeRepository.setNote(999, 'x')).toBe(false)
  })
})
```

```tsx
// src/features/backoffice-responses/components/response-detail.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ResponseDetail as Detail } from '@/server/diagnosis/application/backoffice-responses'
import { ResponseDetail } from './response-detail'

const detail: Detail = {
  id: 7, protocol: 'DS-260915-AB12', invitationToken: null, viaInvitation: false, companyName: 'Padaria Boa', cnpj: '11.222.333/0001-81',
  requester: 'Ana', email: 'ana@padaria.com', phone: '(34) 99999-9999', receivedAt: '2026-09-15T12:00:00.000Z',
  updatedAt: '2026-09-21T12:00:00.000Z', formVersion: 'sintetico',
  position: 'Simples híbrido', outcome: 'B', certainty: 'aberta', urgency: 'ALTA', confidence: 'MÉDIA',
  engine: { outcome: 'B', position: 'Simples híbrido', certainty: 'aberta', urgency: 'ALTA', confidence: 'MÉDIA', gaps: ['margemLiquida'], triggers: [], openPoints: ['conferir a margem'] },
  requesterInQsa: false,
  answers: { blocks: [{ number: 1, title: 'Identificação', rows: [{ key: 'regimeAtual', prompt: 'Regime tributário atual', value: { kind: 'text', text: 'Simples Nacional' } }] }], outsideForm: [{ key: 'campoAntigo', value: { kind: 'text', text: 'x' } }], total: 2 },
  status: 'in_review', internalNote: 'nota', handledBy: 'maria', handledAt: '2026-09-20T12:00:00.000Z', changedAfterHandling: true,
}

describe('ResponseDetail', () => {
  it('shows the QSA alert, the client change warning, the last handling and the answers by block', () => {
    render(<ResponseDetail detail={detail} pending={false} onHandle={() => undefined} onClose={() => undefined} />)
    expect(screen.getByText(/Quem respondeu não consta do quadro de sócios/)).toBeInTheDocument()
    expect(screen.getByText(/Alterada pelo cliente em .*, depois do último tratamento\./)).toBeInTheDocument()
    expect(screen.getByText(/Último tratamento: maria em/)).toBeInTheDocument()
    expect(screen.getByText('Simples Nacional')).toBeInTheDocument()
    expect(screen.getByText('fora do formulário atual')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir plano de ação (PDF)' })).toHaveAttribute('href', '/backoffice/responses/7/report')
  })

  it('changes the status with the note, or saves only the note', async () => {
    const onHandle = vi.fn()
    render(<ResponseDetail detail={detail} pending={false} onHandle={onHandle} onClose={() => undefined} />)
    await userEvent.clear(screen.getByRole('textbox'))
    await userEvent.type(screen.getByRole('textbox'), 'ok')
    await userEvent.click(screen.getByRole('button', { name: 'Validada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Só salvar a nota' }))
    expect(onHandle.mock.calls).toEqual([['validated', 'ok'], [null, 'ok']])
  })
})
```

- [ ] **Step 4:** Run `pnpm vitest run src/server/diagnosis && pnpm vitest run --project dom src/features/backoffice-responses`. Expected: FAIL — caso de uso, adaptador e componente não existem.

- [ ] **Step 5: Caso de uso**

```ts
// src/server/diagnosis/application/backoffice-responses.ts
import { csvFileName, csvRows, toCsv } from '../domain/csv'
import { RESPONSE_STATUSES, type ResponseStatus } from '../domain/response-status'
import { answerBlocks, readStoredPayload, type AnswerBlocks, type EngineSnapshot } from '../domain/stored-payload'
import type { DiagnosisAuditRecorder } from '../ports/audit-recorder'
import type { Clock } from '../ports/clock'
import type { ResponseBackofficeRepository, ResponseFilter } from '../ports/response-backoffice-repository'
import type { ResponseRecord } from '../ports/response-repository'

export const PAGE_SIZE = 50
export const EXPORT_LIMIT = 5000

export type BackofficeActor = { id: string; username: string }

export interface ResponseSummary {
  id: number
  protocol: string
  companyName: string | null
  cnpj: string | null
  requester: string | null
  email: string | null
  position: string | null
  outcome: string | null
  certainty: string | null
  urgency: string | null
  confidence: string | null
  receivedAt: string
  formVersion: string | null
  viaInvitation: boolean
  status: ResponseStatus
}

export interface ResponseList {
  counts: Record<'total' | ResponseStatus, number>
  items: ResponseSummary[]
  total: number
  page: number
  pageCount: number
}

export interface ResponseDetail extends ResponseSummary {
  invitationToken: string | null
  phone: string | null
  updatedAt: string | null
  engine: EngineSnapshot
  requesterInQsa: boolean | null
  answers: AnswerBlocks
  internalNote: string
  handledBy: string | null
  handledAt: string | null
  changedAfterHandling: boolean
}

const summary = (row: ResponseRecord): ResponseSummary => ({
  id: row.id,
  protocol: row.protocol,
  companyName: row.companyName,
  cnpj: row.cnpj,
  requester: row.requester,
  email: row.email,
  position: row.position,
  outcome: row.outcome,
  certainty: row.certainty,
  urgency: row.urgency,
  confidence: row.confidence,
  receivedAt: row.receivedAt.toISOString(),
  formVersion: row.formVersion,
  viaInvitation: row.invitationToken !== null,
  status: row.status,
})

export function makeResponseBackoffice({ responses, clock, recordAudit }: {
  responses: ResponseBackofficeRepository
  clock: Clock
  recordAudit: DiagnosisAuditRecorder
}) {
  return {
    async listResponses({ status, search, page = 1 }: ResponseFilter & { page?: number }): Promise<ResponseList> {
      const filter = { status, search: search?.trim() || undefined }
      const [{ items, total }, byStatus] = await Promise.all([
        responses.list(filter, { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
        responses.countByStatus(),
      ])
      const counts = { total: RESPONSE_STATUSES.reduce((sum, key) => sum + byStatus[key], 0), ...byStatus }
      return { counts, items: items.map(summary), total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
    },

    async getResponse(id: number): Promise<ResponseDetail | null> {
      const row = await responses.findById(id)
      if (!row) return null
      const payload = readStoredPayload(row.payload)
      return {
        ...summary(row),
        invitationToken: row.invitationToken,
        phone: row.phone,
        updatedAt: row.updatedAt?.toISOString() ?? null,
        engine: payload.engine,
        requesterInQsa: row.requesterInQsa ?? payload.requesterInQsa,
        answers: answerBlocks(payload.answers),
        internalNote: row.internalNote ?? '',
        handledBy: row.handledByUsername,
        handledAt: row.handledAt?.toISOString() ?? null,
        changedAfterHandling: Boolean(row.updatedAt && row.handledAt && row.updatedAt > row.handledAt),
      }
    },

    async handleResponse(actor: BackofficeActor, { id, status, note }: { id: number; status: ResponseStatus | null; note: string }) {
      const current = await responses.findById(id)
      if (!current) return { ok: false as const, message: 'Resposta não encontrada.' }
      if (status) await responses.setStatus(id, { status, note, handledById: actor.id, handledAt: clock.now() })
      else await responses.setNote(id, note)
      await recordAudit({ action: 'response_handled', actorId: actor.id, actorUsername: actor.username, reference: String(id), detail: { from: current.status, to: status ?? current.status, noteOnly: status === null } })
      return { ok: true as const }
    },

    async exportResponses(actor: BackofficeActor, filter: ResponseFilter) {
      const rows = await responses.listForExport({ status: filter.status, search: filter.search?.trim() || undefined }, EXPORT_LIMIT)
      const body = toCsv(csvRows(rows.map((row) => ({
        protocol: row.protocol,
        receivedAt: row.receivedAt,
        status: row.status,
        handledBy: row.handledByUsername,
        handledAt: row.handledAt,
        invitationToken: row.invitationToken,
        payload: readStoredPayload(row.payload),
      }))))
      await recordAudit({ action: 'spreadsheet_exported', actorId: actor.id, actorUsername: actor.username, reference: String(rows.length), detail: { kind: 'responses', count: rows.length, status: filter.status ?? null, search: filter.search ?? null } })
      return { fileName: csvFileName(clock.now()), body, count: rows.length }
    },
  }
}
```

- [ ] **Step 6: Adaptador e composição**

Em `src/server/diagnosis/adapters/prisma-response-repository.ts`, acrescente:

```ts
import type { ResponseWhereInput } from '@/server/shared/prisma/generated/models'
import type { ResponseBackofficeRepository, ResponseFilter } from '../ports/response-backoffice-repository'

function responseWhere({ status, search }: ResponseFilter): ResponseWhereInput {
  const term = search?.trim()
  if (!term) return status ? { status } : {}
  const digits = term.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  return {
    ...(status ? { status } : {}),
    OR: [
      { companyName: { contains: term, mode: 'insensitive' } },
      { cnpj: { contains: term } },
      { protocol: { contains: term, mode: 'insensitive' } },
      { requester: { contains: term, mode: 'insensitive' } },
      ...(digits.length >= 2 ? [{ cnpjDigits: { contains: digits } }] : []),
    ],
  }
}

const newestFirst = [{ receivedAt: 'desc' as const }, { id: 'desc' as const }]

export const prismaResponseBackofficeRepository: ResponseBackofficeRepository = {
  async list(filter, { skip, take }) {
    const where = responseWhere(filter)
    const [rows, total] = await prisma.$transaction([
      prisma.response.findMany({ where, include: responseInclude, orderBy: newestFirst, skip, take }),
      prisma.response.count({ where }),
    ])
    return { items: rows.map(toResponseRecord), total }
  },
  async countByStatus() {
    const counts = { new: 0, in_review: 0, validated: 0, discarded: 0 }
    for (const group of await prisma.response.groupBy({ by: ['status'], _count: { _all: true } })) counts[group.status] = group._count._all
    return counts
  },
  findById: prismaResponseRepository.findById,
  listForExport: async (filter, limit) =>
    (await prisma.response.findMany({ where: responseWhere(filter), include: responseInclude, orderBy: newestFirst, take: limit })).map(toResponseRecord),
  setNote: async (id, note) => (await prisma.response.updateMany({ where: { id }, data: { internalNote: note } })).count > 0,
  setStatus: async (id, { status, note, handledById, handledAt }) =>
    (await prisma.response.updateMany({ where: { id }, data: { status, internalNote: note, handledById, handledAt } })).count > 0,
}
```

Em `src/server/diagnosis/composition.ts`, acrescente:

```ts
import { prismaResponseBackofficeRepository } from './adapters/prisma-response-repository'
import { makeResponseBackoffice } from './application/backoffice-responses'

export const responseBackoffice = makeResponseBackoffice({ responses: prismaResponseBackofficeRepository, clock: systemClock, recordAudit })
export type { BackofficeActor, ResponseDetail, ResponseList, ResponseSummary } from './application/backoffice-responses'
```

- [ ] **Step 7: Server functions e consultas**

```ts
// src/features/backoffice-responses/api/responses.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { diagnosisReports, responseBackoffice } from '@/server/diagnosis/composition'
import { RESPONSE_STATUSES } from '@/server/diagnosis/domain/response-status'
import { sessionMiddleware } from '@/server/shared/http/session-middleware'

const filterInput = z.object({
  status: z.enum(RESPONSE_STATUSES).optional(),
  search: z.string().max(200).optional(),
  page: z.number().int().min(1).max(10_000).optional(),
})
const idInput = z.object({ id: z.number().int().positive() })

export const listResponsesFn = createServerFn({ method: 'GET' })
  .middleware([sessionMiddleware])
  .inputValidator(filterInput)
  .handler(({ data }) => responseBackoffice.listResponses(data))

export const getResponseFn = createServerFn({ method: 'GET' })
  .middleware([sessionMiddleware])
  .inputValidator(idInput)
  .handler(({ data }) => responseBackoffice.getResponse(data.id))

export const handleResponseFn = createServerFn({ method: 'POST' })
  .middleware([sessionMiddleware])
  .inputValidator(idInput.extend({ status: z.enum(RESPONSE_STATUSES).nullable(), note: z.string().max(5000) }))
  .handler(({ data, context }) => responseBackoffice.handleResponse({ id: context.session.user.id, username: context.session.user.username }, data))

export const getResponseReportFn = createServerFn({ method: 'GET' })
  .middleware([sessionMiddleware])
  .inputValidator(idInput)
  .handler(({ data }) => diagnosisReports.responseReport(data.id))
```

```ts
// src/features/backoffice-responses/api/queries.ts
import { queryOptions } from '@tanstack/react-query'
import type { ResponseStatus } from '@/server/diagnosis/domain/response-status'
import { getResponseFn, listResponsesFn } from './responses'

export type ResponsesFilter = { status?: ResponseStatus; q?: string; page: number }

export const responsesQuery = (filter: ResponsesFilter) =>
  queryOptions({ queryKey: ['responses', filter], queryFn: () => listResponsesFn({ data: { status: filter.status, search: filter.q, page: filter.page } }) })

export const responseQuery = (id: number) =>
  queryOptions({ queryKey: ['responses', 'detail', id], queryFn: () => getResponseFn({ data: { id } }) })
```

- [ ] **Step 8: CSS, casca e componentes**

`src/styles/backoffice.css`: porte do `<style>` de `backoffice.html` (linhas 11–136) pelas três trocas e pela tabela de nomes do backoffice, escopo `.bo` (cabeçalho em `.bo-header`); acrescente, no lugar de `dialog`/`dialog::backdrop`, `.bo-overlay { position: fixed; inset: 0; background: rgba(5, 44, 71, 0.45) }` e, em `.bo-dialog`, `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 90vh; overflow: auto; background: #fff` mais as regras antigas de `dialog`. Em `src/styles/app.css`, `@import './backoffice.css';` depois do `diagnosis.css`.

```tsx
// src/components/backoffice/backoffice-shell.tsx
import type { ReactNode } from 'react'

export function BackofficeShell({ userName, nav, logout, children }: { userName: string; nav: ReactNode; logout: ReactNode; children: ReactNode }) {
  return (
    <>
      <header className="bo-header">
        <div className="bo-brand">
          <img className="bo-logo" alt="auster" src="/brand/logo-contabil-negativa.png" />
          <div>
            <h1>Conferência</h1>
            <div className="bo-tagline">Diagnóstico e termos de opção — Simples Nacional 2027</div>
          </div>
        </div>
        <div className="bo-header-actions">
          <span className="bo-who">{userName}</span>
          {logout}
        </div>
      </header>
      <main className="bo">
        {nav}
        <div className="bo-panel">{children}</div>
      </main>
    </>
  )
}
```

`ResponseDetail` (`src/features/backoffice-responses/components/response-detail.tsx`): porte literal de `abrirFicha`, presentacional, com `props: { detail: ResponseDetail; pending: boolean; onHandle(status: ResponseStatus | null, note: string): void; onClose(): void }`:
- `.bo-protocol`: `Protocolo {protocol}{invitationToken ? ` · convite ${invitationToken}` : ' · link aberto'}`; `<h2>{companyName ?? '(sem nome)'}</h2>`;
- `.bo-grid` com CNPJ, Quem respondeu, E-mail, Telefone, Recebido em (`formatShortDateTime`), Versão;
- "O que o motor devolveu" com Posição, Certeza, Saída, Urgência, Confiança (de `engine`); "Pontos em aberto" e "Campos em "não sei"" quando houver;
- alerta do QSA: `requesterInQsa === false` → texto antigo do `qsa === 'nao'`; `true` → "Quem respondeu consta do quadro de sócios." com o estilo verde do antigo (`.bo-alert.is-ok`); `null` → nada;
- o alerta novo de `changedAfterHandling`, com a data de `updatedAt`;
- "Todas as respostas" com `{answers.total} campos respondidos`, um `<h4>` `{number}. {title}` e um `.bo-answers` por bloco (texto ou, na matriz, `label: <b>value</b>` por linha, separados por `<br />`), e o grupo "fora do formulário atual" com `outsideForm`; a nota "O formulário tem perguntas condicionais…";
- "Tratamento interno": `<textarea>` com estado local iniciado em `internalNote` e o placeholder antigo; `Último tratamento: {handledBy} em {data}` ou "Nunca tratada.";
- `.bo-sheet-actions`: um botão por status (`RESPONSE_STATUS_LABELS`; o atual sem `is-light`) → `onHandle(status, note)`; `<a href={`/backoffice/responses/${id}/report`} target="_blank" rel="noopener" className="bo-button is-light">Abrir plano de ação (PDF)</a>`; "Só salvar a nota" → `onHandle(null, note)`; "Fechar" → `onClose()`. Todos desabilitados com `pending`.

`ResponsesPanel` (`src/features/backoffice-responses/components/responses-panel.tsx`): porte de `verRespostas` com `props: { filter: ResponsesFilter; onFilterChange(next: ResponsesFilter): void }`:
- `useQuery(responsesQuery(filter))`; enquanto carrega, "carregando…"; erro → `.bo-empty` "Falha ao carregar: {mensagem}";
- `.bo-counts` com Total e os quatro status (`RESPONSE_STATUS_LABELS`);
- `.bo-filters`: `<input type="text" placeholder="Empresa, CNPJ, protocolo ou respondente">` (estado local, Enter aplica), `<select>` com "Todas as situações" e os quatro status, botão "Filtrar" → `onFilterChange({ status, q, page: 1 })`, e `<a className="bo-button is-light" href={`/backoffice/responses.csv?${params}`}>Baixar planilha (CSV)</a>` com os mesmos `status` e `q` da tela;
- a tabela (Empresa, Quem respondeu, Posição, Urgência, Recebido, Situação) com as linhas do antigo (`tr.bo-row`, clique abre a ficha; "saída {outcome} · {certainty === 'fechada' ? 'fechada' : 'aberta'}"; "confiança {confidence}"; `{formVersion}{viaInvitation ? ' · convite' : ''}`); vazio → texto antigo;
- paginação: "Anterior" (desabilitado na 1), "Página {page} de {pageCount}", "Próxima" (desabilitado na última);
- a nota final antiga ("A conferência existe porque a resposta é autodeclarada…");
- ficha: estado `openId`; com ele, `useQuery(responseQuery(openId))` e um `Dialog.Root open onOpenChange` do `radix-ui` com `Dialog.Overlay className="bo-overlay"` e `Dialog.Content className="bo-dialog"` (com `Dialog.Title` visualmente igual ao `<h2>` da ficha) contendo `ResponseDetail`; `onHandle` usa `useMutation(handleResponseFn)` e, ao concluir, `queryClient.invalidateQueries({ queryKey: ['responses'] })` e fecha a ficha (como o antigo).

- [ ] **Step 9: Rotas**

```tsx
// src/app/routes/backoffice/index.tsx
import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { BackofficeShell } from '@/components/backoffice/backoffice-shell'
import { LogoutButton } from '@/features/auth/components/logout-button'
import { ResponsesPanel } from '@/features/backoffice-responses/components/responses-panel'
import { RESPONSE_STATUSES } from '@/server/diagnosis/domain/response-status'

const TAB_KEYS = ['responses'] as const
type TabKey = (typeof TAB_KEYS)[number]
const TABS: { key: TabKey; label: string; adminOnly: boolean }[] = [{ key: 'responses', label: 'Respostas', adminOnly: false }]

export const Route = createFileRoute('/backoffice/')({
  validateSearch: z.object({
    tab: z.enum(TAB_KEYS).optional().catch(undefined),
    status: z.enum(RESPONSE_STATUSES).optional().catch(undefined),
    q: z.string().max(200).optional().catch(undefined),
    page: z.number().int().min(1).optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: 'Conferência — Diagnóstico Simples | auster' }] }),
  component: BackofficeHome,
})

function BackofficeHome() {
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const tab = search.tab ?? 'responses'
  const nav = (
    <div className="bo-tabs">
      {TABS.filter((item) => !item.adminOnly || user.role === 'admin').map((item) => (
        <Link key={item.key} to="/backoffice" search={{ tab: item.key }} className={item.key === tab ? 'bo-tab is-active' : 'bo-tab'}>{item.label}</Link>
      ))}
    </div>
  )
  return (
    <BackofficeShell userName={user.username} nav={nav} logout={<LogoutButton className="bo-logout" />}>
      {tab === 'responses' ? (
        <ResponsesPanel
          filter={{ status: search.status, q: search.q, page: search.page ?? 1 }}
          onFilterChange={(next) => void navigate({ search: { tab: 'responses', status: next.status, q: next.q, page: next.page } })}
        />
      ) : null}
    </BackofficeShell>
  )
}
```

As Tarefas 11 e 12 acrescentam itens a `TAB_KEYS` e a `TABS`.

```tsx
// src/app/routes/backoffice/responses/$id/report.tsx
import { createFileRoute, notFound } from '@tanstack/react-router'
import { SiteHeader } from '@/components/brand/site-header'
import { getResponseReportFn } from '@/features/backoffice-responses/api/responses'
import { ReportDocument } from '@/features/diagnosis/components/report-document'
import { printWhenReady } from '@/lib/print'

export const Route = createFileRoute('/backoffice/responses/$id/report')({
  loader: async ({ params }) => {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id < 1) throw notFound()
    const sheets = await getResponseReportFn({ data: { id } })
    if (!sheets) throw notFound()
    return sheets
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.fileName ?? 'Plano de ação | auster' }] }),
  notFoundComponent: () => <main className="dx"><div className="dx-card">Resposta não encontrada.</div></main>,
  component: ResponseReport,
})

function ResponseReport() {
  const sheets = Route.useLoaderData()
  return (
    <>
      <SiteHeader subtitle="Diagnóstico — Simples padrão ou regime regular de IBS e CBS" />
      <main className="dx">
        <ReportDocument
          sheets={sheets}
          toolbar={<button type="button" className="dx-button is-primary" onClick={() => void printWhenReady(sheets.fileName)}>Imprimir ou salvar em PDF</button>}
        />
      </main>
    </>
  )
}
```

```ts
// src/app/routes/backoffice/responses[.]csv.ts
import { createFileRoute } from '@tanstack/react-router'
import { responseBackoffice } from '@/server/diagnosis/composition'
import { isResponseStatus } from '@/server/diagnosis/domain/response-status'
import { getSessionUser } from '@/server/shared/http/session'

export const Route = createFileRoute('/backoffice/responses.csv')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request.headers)
        if (!user) return new Response('Entre no backoffice para baixar a planilha.', { status: 401 })
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        const file = await responseBackoffice.exportResponses(
          { id: user.id, username: user.username },
          { status: isResponseStatus(status) ? status : undefined, search: url.searchParams.get('q') ?? undefined },
        )
        return new Response(file.body, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${file.fileName}"`,
            'Cache-Control': 'no-store',
          },
        })
      },
    },
  },
})
```

O handler confere a sessão por conta própria: o `beforeLoad` de `/backoffice` não roda para handlers de servidor.

- [ ] **Step 10:** Run `pnpm build && pnpm vitest run src/server/diagnosis && pnpm vitest run --project dom src/features/backoffice-responses`. Expected: PASS. Em `pnpm dev`, entre em `/backoffice`, abra uma resposta, mude o status, salve só a nota (o "Último tratamento" não muda), baixe o CSV (abre no Excel com acento e colunas) e abra o PDF da resposta.
- [ ] **Step 11: Commit e merge**

```bash
git add src/server/diagnosis src/features/backoffice-responses src/components/backoffice src/styles src/app/routes/backoffice
git commit -m "feat(backoffice): respostas com contadores, busca, paginação, ficha, tratamento, relatório e planilha"
pnpm lint && pnpm typecheck && pnpm test
git switch teste && git merge --no-ff feat/backoffice-respostas -m "merge: backoffice de respostas" && git branch -d feat/backoffice-respostas && git push origin teste
```

---

### Task 11: Backoffice de convites

**Files:**
- Create: `src/features/backoffice-invitations/api/invitations.ts`, `src/features/backoffice-invitations/components/invitations-view.tsx`, `src/features/backoffice-invitations/components/invitations-panel.tsx`
- Modify: `src/app/routes/backoffice/index.tsx`
- Test: `src/features/backoffice-invitations/components/invitations-view.test.tsx`

**Interfaces:**
- Consumes: Tarefa 3 (`createInvitation`, `listInvitations`, `deleteInvitation`, `InvitationView`, `InvitationInput`); `sessionMiddleware`; `formatShortDateTime`.
- Produces: `listInvitationsFn()`, `createInvitationFn({ data: InvitationInput })`, `deleteInvitationFn({ data: { token: string } })` (todas com `sessionMiddleware`); `InvitationsView({ invitations, error, pending, onCreate, onDelete, onCopy })`; `InvitationsPanel()`; aba `invitations` ("Convites").

Porte de `verConvites`, `criarConvite`, `apagarConvite` e `copiar` (`backoffice.html` 969–1044): título "Um link por cliente", o parágrafo de ajuda com `?c=` trocado por `?invite=` (o endereço mudou), campos "Razão social", "CNPJ", "E-mail de contato (opcional)", botão "Gerar link", tabela Cliente/Link/Aberturas/Respostas/Criado, botões "Diagnóstico", "Adesão" e "Apagar", o `confirm` antigo antes de apagar e o vazio antigo. Sai o aviso de `AUSTER_ENDERECO_PUBLICO` (o `APP_PUBLIC_URL` é obrigatório no ambiente). "Apagar" só aparece quando `responseCount === 0 && adhesionCount === 0`; a recusa do servidor aparece no lugar do `alert`, num `.bo-error`. A validação "nome ou CNPJ" é do servidor; a tela só repete a mensagem que ele devolve.

- [ ] **Step 1: Branch** — `git switch teste && git pull --ff-only && git switch -c feat/backoffice-convites`

- [ ] **Step 2: Teste que falha**

```tsx
// src/features/backoffice-invitations/components/invitations-view.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { InvitationView } from '@/server/invitations/composition'
import { InvitationsView } from './invitations-view'

const invitation = (token: string, extra: Partial<InvitationView> = {}): InvitationView => ({
  token, companyName: `Empresa ${token}`, cnpj: null, email: null, openCount: 2, lastOpenedAt: '2026-09-20T12:00:00.000Z',
  createdAt: '2026-09-19T12:00:00.000Z', createdBy: 'maria', responseCount: 0, adhesionCount: 0,
  links: { diagnosis: `https://hml.example/diagnosis?invite=${token}`, adhesion: `https://hml.example/adhesion?invite=${token}` },
  ...extra,
})

describe('InvitationsView', () => {
  it('lists the diagnosis link and hides "Apagar" for invitations already used', () => {
    render(<InvitationsView invitations={[invitation('AAAAAAAAAA'), invitation('BBBBBBBBBB', { responseCount: 1 }), invitation('CCCCCCCCCC', { adhesionCount: 1 })]} error={null} pending={false} onCreate={vi.fn()} onDelete={vi.fn()} onCopy={vi.fn()} />)
    expect(screen.getByText('https://hml.example/diagnosis?invite=AAAAAAAAAA')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Apagar' })).toHaveLength(1)
  })

  it('sends the typed fields, copies both links and shows the server refusal', async () => {
    const onCreate = vi.fn()
    const onCopy = vi.fn()
    render(<InvitationsView invitations={[invitation('AAAAAAAAAA')]} error="Informe ao menos o nome da empresa ou o CNPJ — o link serve para amarrar a resposta a alguém." pending={false} onCreate={onCreate} onDelete={vi.fn()} onCopy={onCopy} />)
    await userEvent.type(screen.getByPlaceholderText('Razão social'), ' Padaria Boa ')
    await userEvent.click(screen.getByRole('button', { name: 'Gerar link' }))
    expect(onCreate).toHaveBeenCalledWith({ companyName: 'Padaria Boa', cnpj: '', email: '' })
    const row = screen.getByText('Empresa AAAAAAAAAA').closest('tr')
    if (!row) throw new Error('sem linha')
    await userEvent.click(within(row).getByRole('button', { name: 'Diagnóstico' }))
    await userEvent.click(within(row).getByRole('button', { name: 'Adesão' }))
    expect(onCopy.mock.calls).toEqual([['https://hml.example/diagnosis?invite=AAAAAAAAAA'], ['https://hml.example/adhesion?invite=AAAAAAAAAA']])
    expect(screen.getByText(/Informe ao menos o nome da empresa ou o CNPJ/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3:** Run `pnpm vitest run --project dom src/features/backoffice-invitations`. Expected: FAIL.

- [ ] **Step 4: Implementar**

```ts
// src/features/backoffice-invitations/api/invitations.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { createInvitation, deleteInvitation, listInvitations } from '@/server/invitations/composition'
import { sessionMiddleware } from '@/server/shared/http/session-middleware'

const actorOf = (user: { id: string; username: string }) => ({ id: user.id, username: user.username })

export const listInvitationsFn = createServerFn({ method: 'GET' }).middleware([sessionMiddleware]).handler(() => listInvitations())

export const createInvitationFn = createServerFn({ method: 'POST' })
  .middleware([sessionMiddleware])
  .inputValidator(z.object({ companyName: z.string().max(200), cnpj: z.string().max(32), email: z.string().max(254) }))
  .handler(({ data, context }) => createInvitation(actorOf(context.session.user), data))

export const deleteInvitationFn = createServerFn({ method: 'POST' })
  .middleware([sessionMiddleware])
  .inputValidator(z.object({ token: z.string().max(32) }))
  .handler(({ data, context }) => deleteInvitation(actorOf(context.session.user), data.token))
```

`InvitationsView` (presentacional, `props: { invitations: InvitationView[]; error: string | null; pending: boolean; onCreate(input: { companyName: string; cnpj: string; email: string }): void; onDelete(token: string): void; onCopy(link: string): void }`): porte literal descrito acima; os três campos com estado local, enviados com `trim()`; "Apagar" pede `window.confirm('Apagar este convite? O link para de funcionar na hora, inclusive para quem já o recebeu.')` antes de `onDelete`; a coluna Aberturas mostra `openCount` e, com `lastOpenedAt`, a data em `formatShortDateTime`; Criado mostra a data e `createdBy`.

`InvitationsPanel`: `useQuery({ queryKey: ['invitations'], queryFn: () => listInvitationsFn() })`; `useMutation` para criar e apagar, guardando `message` de `{ ok: false }` em `error` e invalidando `['invitations']` no sucesso; `onCopy = (link) => navigator.clipboard.writeText(link).catch(() => window.prompt('Copie o link:', link))`.

Na rota `/backoffice/`: acrescente `'invitations'` a `TAB_KEYS`, `{ key: 'invitations', label: 'Convites', adminOnly: false }` a `TABS` e `{tab === 'invitations' ? <InvitationsPanel /> : null}`.

- [ ] **Step 5:** Run `pnpm build && pnpm vitest run --project dom src/features/backoffice-invitations`. Expected: PASS. Em `pnpm dev`: gere um convite, copie o link do diagnóstico, abra numa janela anônima — empresa e CNPJ vêm preenchidos; depois da primeira resposta, a aba mostra 1 abertura.
- [ ] **Step 6: Commit e merge**

```bash
git add src/features/backoffice-invitations src/app/routes/backoffice/index.tsx
git commit -m "feat(backoffice): convites com links do diagnóstico e da adesão, aberturas e trava de apagar"
pnpm lint && pnpm typecheck && pnpm test
git switch teste && git merge --no-ff feat/backoffice-convites -m "merge: backoffice de convites" && git branch -d feat/backoffice-convites && git push origin teste
```

---

### Task 12: Backoffice de usuários (admin) e auditoria

**Files:**
- Create: `src/features/backoffice-users/api/users.ts`, `src/features/backoffice-users/components/password-dialog.tsx`, `src/features/backoffice-users/components/users-view.tsx`, `src/features/backoffice-users/components/users-panel.tsx`, `src/features/backoffice-audit/api/audit.ts`, `src/features/backoffice-audit/components/audit-view.tsx`, `src/features/backoffice-audit/components/audit-panel.tsx`
- Modify: `src/server/identity/adapters/better-auth-user-accounts.ts`, `src/app/routes/backoffice/index.tsx`
- Test: `src/server/identity/adapters/better-auth-user-accounts.int.test.ts`, `src/features/backoffice-users/components/password-dialog.test.tsx`, `src/features/backoffice-users/components/users-view.test.tsx`, `src/features/backoffice-audit/components/audit-view.test.tsx`

**Interfaces:**
- Consumes: `listUsers`, `createUser`, `updateUser`, `IdentityError`, `Actor`, `Role`, `UserChanges` (`server/identity/composition`); `MINIMUM_PASSWORD` (`server/identity/domain/user-rules`); `listAudit` (`server/audit/composition`); `AUDIT_ACTION_LABELS`, `AuditAction` (`server/audit/domain/audit-entry`); `adminMiddleware`, `sessionMiddleware`.
- Produces:
  - `listUsersFn(): Promise<UserRow[]>` com `UserRow = { id; username; name; role: Role; active: boolean; lastLoginAt: string | null; createdAt: string }`; `createUserFn({ data: { username, name, password, role } }): Promise<{ ok: true } | { ok: false; message: string }>`; `updateUserFn({ data: { username, changes: UserChanges } }): Promise<{ ok: true } | { ok: false; message: string }>` — as três com `adminMiddleware`
  - `listAuditFn(): Promise<AuditRow[]>` com `AuditRow = { id: number; occurredAt: string; actorUsername: string | null; action: string; reference: string | null; detail: string }` — `sessionMiddleware`, últimas 200
  - `PasswordDialog({ open, title, onSubmit, onCancel })`, `UsersView({ users, currentUserId, error, pending, onCreate, onChange })`, `UsersPanel()`, `AuditView({ entries })`, `AuditPanel()`
  - abas `users` ("Usuários", só admin) e `audit` ("Auditoria")
  - `betterAuthUserAccounts.setPassword` cria a credencial quando o usuário não tem (usuário migrado sem senha)

Porte de `verUsuarios`, `pedirSenha`, `criarUsuario`, `alterar`, `trocarSenhaDe`, `alternarPapel`, `alternarAtivo` e `verEventos` (`backoffice.html` 1046–1239), com os textos literais, menos: o aviso e a tela da "senha de implantação" (não existe mais; o primeiro admin vem do `auth:bootstrap-admin`), a frase sobre `scrypt` no parágrafo de ajuda (troque por "A senha nunca é guardada: guarda-se só o resumo dela."), e o "Trocar minha senha" do cabeçalho (fora da spec desta etapa). Acrescente o botão "Renomear" por linha (spec: renomear), que pede o nome novo com `window.prompt('Novo nome de {usuario}', nomeAtual)`. A auditoria mostra o rótulo de `AUDIT_ACTION_LABELS` (ou a ação crua, se for desconhecida) e o `detail` como JSON compacto.

- [ ] **Step 1: Branch** — `git switch teste && git pull --ff-only && git switch -c feat/backoffice-usuarios-auditoria`

- [ ] **Step 2: Testes que falham**

No arquivo existente, acrescente aos imports do topo `import { auth } from '@/server/shared/auth/auth'` e `import { prisma } from '@/server/shared/prisma/client'`, e ao fim:

```ts
// src/server/identity/adapters/better-auth-user-accounts.int.test.ts
describe('betterAuthUserAccounts.setPassword', () => {
  beforeEach(resetDatabase)

  it('creates the credential of a migrated user that never had a password', async () => {
    await prisma.user.create({ data: { id: 'legado-1', name: 'Legado', email: 'legado@users.invalid', username: 'legado' } })
    await betterAuthUserAccounts.setPassword('legado-1', 'senha-nova-123')
    const account = await prisma.account.findFirst({ where: { userId: 'legado-1', providerId: 'credential' } })
    expect(account?.accountId).toBe('legado-1')
    const context = await auth.$context
    expect(await context.password.verify({ hash: account?.password ?? '', password: 'senha-nova-123' })).toBe(true)
  })
})
```

```tsx
// src/features/backoffice-users/components/password-dialog.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PasswordDialog } from './password-dialog'

describe('PasswordDialog', () => {
  it('refuses short and mismatching passwords and returns a good one', async () => {
    const onSubmit = vi.fn()
    render(<PasswordDialog open title="Senha de ana" onSubmit={onSubmit} onCancel={vi.fn()} />)
    expect(screen.getByText(/No mínimo 12 caracteres\. Comprimento é o que protege/)).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('Senha'), 'curta')
    await userEvent.type(screen.getByPlaceholderText('Repita a senha'), 'curta')
    await userEvent.click(screen.getByRole('button', { name: 'Definir' }))
    expect(screen.getByText('Curta demais.')).toBeInTheDocument()
    await userEvent.clear(screen.getByPlaceholderText('Senha'))
    await userEvent.type(screen.getByPlaceholderText('Senha'), 'senha-bem-longa-1')
    await userEvent.click(screen.getByRole('button', { name: 'Definir' }))
    expect(screen.getByText('As duas não conferem.')).toBeInTheDocument()
    await userEvent.clear(screen.getByPlaceholderText('Repita a senha'))
    await userEvent.type(screen.getByPlaceholderText('Repita a senha'), 'senha-bem-longa-1')
    await userEvent.click(screen.getByRole('button', { name: 'Definir' }))
    expect(onSubmit).toHaveBeenCalledWith('senha-bem-longa-1')
  })
})
```

```tsx
// src/features/backoffice-users/components/users-view.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UsersView } from './users-view'

const users = [
  { id: 'u1', username: 'victor', name: 'Victor', role: 'admin' as const, active: true, lastLoginAt: null, createdAt: '2026-09-01T12:00:00.000Z' },
  { id: 'u2', username: 'ana', name: 'Ana', role: 'team' as const, active: false, lastLoginAt: null, createdAt: '2026-09-02T12:00:00.000Z' },
]

describe('UsersView', () => {
  it('shows role and situation and sends one change at a time', async () => {
    const onChange = vi.fn()
    render(<UsersView users={users} currentUserId="u1" error="não dá para desativar ou rebaixar o único administrador ativo; promova outro antes" pending={false} onCreate={vi.fn()} onChange={onChange} />)
    const ana = screen.getByText('ana').closest('tr')
    if (!ana) throw new Error('sem linha')
    expect(within(ana).getByText('equipe')).toBeInTheDocument()
    expect(within(ana).getByText('desativado')).toBeInTheDocument()
    await userEvent.click(within(ana).getByRole('button', { name: 'Reativar' }))
    await userEvent.click(within(ana).getByRole('button', { name: 'Tornar administrador' }))
    expect(onChange.mock.calls).toEqual([['ana', { active: true }], ['ana', { role: 'admin' }]])
    expect(screen.getByText(/único administrador ativo/)).toBeInTheDocument()
  })
})
```

```tsx
// src/features/backoffice-audit/components/audit-view.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuditView } from './audit-view'

describe('AuditView', () => {
  it('labels actions in Portuguese and keeps unknown ones as they are', () => {
    render(<AuditView entries={[
      { id: 2, occurredAt: '2026-09-20T12:00:00.000Z', actorUsername: 'maria', action: 'response_handled', reference: '7', detail: '{"from":"new","to":"validated"}' },
      { id: 1, occurredAt: '2026-09-19T12:00:00.000Z', actorUsername: null, action: 'acao_antiga', reference: null, detail: '' },
    ]} />)
    expect(screen.getByText('resposta tratada')).toBeInTheDocument()
    expect(screen.getByText('acao_antiga')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3:** Run `pnpm vitest run src/server/identity && pnpm vitest run --project dom src/features/backoffice-users src/features/backoffice-audit`. Expected: FAIL.

- [ ] **Step 4: Senha de usuário sem credencial**

Em `src/server/identity/adapters/better-auth-user-accounts.ts`, troque `setPassword` por:

```ts
  async setPassword(id, password) {
    const context = await auth.$context
    const hash = await context.password.hash(password)
    const updated = await prisma.account.updateMany({ where: { userId: id, providerId: 'credential' }, data: { password: hash } })
    if (updated.count === 0) {
      await prisma.account.create({ data: { id: crypto.randomUUID(), accountId: id, providerId: 'credential', userId: id, password: hash } })
    }
    await prisma.session.deleteMany({ where: { userId: id } })
  },
```

O better-auth grava a credencial de e-mail e senha com `accountId` igual ao id do usuário; é isso que o login por usuário procura.

- [ ] **Step 5: Server functions**

```ts
// src/features/backoffice-users/api/users.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { IdentityError, createUser, listUsers, updateUser } from '@/server/identity/composition'
import { adminMiddleware } from '@/server/shared/http/session-middleware'

const role = z.enum(['admin', 'team'])
const outcome = async (run: () => Promise<unknown>): Promise<{ ok: true } | { ok: false; message: string }> => {
  try {
    await run()
    return { ok: true }
  } catch (error) {
    if (error instanceof IdentityError) return { ok: false, message: error.message }
    throw error
  }
}

export const listUsersFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async () =>
    (await listUsers()).map((user) => ({ ...user, lastLoginAt: user.lastLoginAt?.toISOString() ?? null, createdAt: user.createdAt.toISOString() })),
  )

export const createUserFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator(z.object({ username: z.string().max(64), name: z.string().max(120), password: z.string().max(128), role }))
  .handler(({ data, context }) => outcome(() => createUser(context.session.user, data)))

export const updateUserFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator(z.object({
    username: z.string().max(64),
    changes: z.object({ name: z.string().max(120).optional(), password: z.string().max(128).optional(), role: role.optional(), active: z.boolean().optional() }),
  }))
  .handler(({ data, context }) => outcome(() => updateUser(context.session.user, data.username, data.changes)))
```

```ts
// src/features/backoffice-audit/api/audit.ts
import { createServerFn } from '@tanstack/react-start'
import { listAudit } from '@/server/audit/composition'
import { sessionMiddleware } from '@/server/shared/http/session-middleware'

export const listAuditFn = createServerFn({ method: 'GET' })
  .middleware([sessionMiddleware])
  .handler(async () =>
    (await listAudit(200)).map((entry) => ({
      id: entry.id,
      occurredAt: entry.occurredAt.toISOString(),
      actorUsername: entry.actorUsername ?? null,
      action: entry.action,
      reference: entry.reference ?? null,
      detail: entry.detail ? JSON.stringify(entry.detail) : '',
    })),
  )
```

`context.session.user` já tem `id`, `username` e `role` — é o `Actor` de `server/identity`.

- [ ] **Step 6: Componentes**

`PasswordDialog` (`radix-ui` `Dialog`, `props: { open: boolean; title: string; onSubmit(password: string): void; onCancel(): void }`): porte de `pedirSenha` — título, a regra "No mínimo {MINIMUM_PASSWORD} caracteres. Comprimento é o que protege: não exigimos símbolo nem maiúscula, porque isso produz senha curta e anotada em papel.", os dois campos `type="password"` com `placeholder="Senha"` e `placeholder="Repita a senha"` e `autoComplete="new-password"`, o `.bo-error` com "Curta demais." ou "As duas não conferem.", botões "Definir" (submete) e "Cancelar" (`onCancel`). Os campos voltam a vazio ao fechar.

`UsersView` (`props: { users: UserRow[]; currentUserId: string; error: string | null; pending: boolean; onCreate(input: { username: string; name: string; role: Role }): void; onChange(username: string, changes: UserChanges): void }`): porte literal de `verUsuarios` (título "Usuários internos", parágrafo de ajuda com a troca do `scrypt`, `.bo-filters` com "usuario (sem espaço nem acento)", "Nome de quem usa", `<select>` equipe/administrador, botão "Criar usuário", tabela Usuário/Papel/Situação/Último acesso/Criado com `.bo-role`, `.is-inactive` e os botões "Trocar senha", "Tornar equipe"/"Tornar administrador", "Desativar"/"Reativar" e o novo "Renomear"); "Criar usuário" sem usuário mostra "Informe o usuário." e não chama nada.

`UsersPanel`: `useQuery({ queryKey: ['users'], queryFn: () => listUsersFn() })`; "Criar usuário" e "Trocar senha" abrem o `PasswordDialog` (título "Senha de {usuario}" / "Nova senha de {usuario}") e só então chamam `createUserFn`/`updateUserFn`; "Renomear" usa o `window.prompt`; resposta `{ ok: false }` vai para `error`; sucesso invalida `['users']`.

`AuditView` (`props: { entries: AuditRow[] }`): porte de `verEventos` (título "Auditoria", a nota "Registro só de inserção…", tabela Quando/Quem/O quê/Referência/Detalhe, "—" para vazio, vazio antigo); "O quê" = `AUDIT_ACTION_LABELS[action as AuditAction] ?? action`. `AuditPanel`: `useQuery({ queryKey: ['audit'], queryFn: () => listAuditFn() })`.

Na rota `/backoffice/`: acrescente `'users'` e `'audit'` a `TAB_KEYS`, `{ key: 'audit', label: 'Auditoria', adminOnly: false }` e `{ key: 'users', label: 'Usuários', adminOnly: true }` a `TABS` (ordem das abas: Respostas, Convites, Auditoria, Usuários, como no antigo), e `{tab === 'users' && user.role === 'admin' ? <UsersPanel /> : null}` e `{tab === 'audit' ? <AuditPanel /> : null}`.

- [ ] **Step 7:** Run `pnpm build && pnpm vitest run src/server/identity && pnpm vitest run --project dom src/features/backoffice-users src/features/backoffice-audit`. Expected: PASS. Em `pnpm dev`, como admin: crie um usuário de equipe, troque a senha, desative e reative; tente rebaixar o único admin (mensagem da trava); confira as linhas na aba Auditoria. Como equipe, a aba Usuários não aparece e `listUsersFn` responde `forbidden`.
- [ ] **Step 8: Commit e merge**

```bash
git add src/server/identity src/features/backoffice-users src/features/backoffice-audit src/app/routes/backoffice/index.tsx
git commit -m "feat(backoffice): usuários para o admin e auditoria, com senha definida para usuário sem credencial"
pnpm lint && pnpm typecheck && pnpm test
git switch teste && git merge --no-ff feat/backoffice-usuarios-auditoria -m "merge: usuários e auditoria no backoffice" && git branch -d feat/backoffice-usuarios-auditoria && git push origin teste
```

---
### Task 13: Migração do SQLite antigo

**Files:**
- Create: `src/server/legacy-import/domain/legacy-rows.ts`, `src/server/legacy-import/domain/mapping.ts`, `src/server/legacy-import/ports/legacy-source.ts`, `src/server/legacy-import/ports/import-target.ts`, `src/server/legacy-import/application/import-legacy.ts`, `src/server/legacy-import/adapters/node-sqlite-legacy-source.ts`, `src/server/legacy-import/adapters/prisma-import-target.ts`, `src/server/legacy-import/composition.ts`, `scripts/migrate-legacy.ts`
- Modify: `package.json`
- Test: `src/server/legacy-import/domain/mapping.test.ts`, `src/server/legacy-import/application/import-legacy.test.ts`, `src/server/legacy-import/adapters/legacy-import.int.test.ts`

**Interfaces:**
- Consumes: tabelas `users`, `invitations`, `responses`, `audit_logs` (Tarefa 1); `node:sqlite` (`DatabaseSync`).
- Produces:
  - Domínio: `LegacyUser`, `LegacyInvitation`, `LegacyResponse`, `LegacyEvent` (linhas do SQLite, colunas com os nomes antigos), `ImportedUser`, `ImportedInvitation`, `ImportedResponse`, `ImportedAuditEntry`, `ImportedAuditAction`, `AUDIT_ACTION_MAP`, `STATUS_MAP`, `translateAuditAction(legacy: string): { action: ImportedAuditAction; extra: Record<string, unknown>; known: boolean }`, `assignProtocols(rows: { id: number; protocolo: string }[]): Map<number, string>`, `requesterInQsaFrom(value: string | null): boolean | null`, `cnpjDigitsOf(cnpj: string | null): string | null`, `mapUser(row: LegacyUser, id: string): ImportedUser`, `mapInvitation(row: LegacyInvitation, userIds: Map<string, string>): ImportedInvitation`, `mapResponse(row: LegacyResponse, context: { protocol: string; invitationTokens: Set<string>; userIds: Map<string, string> }): ImportedResponse`, `mapAuditEvent(row: LegacyEvent, userIds: Map<string, string>): ImportedAuditEntry`
  - Portas: `LegacySource { users(); invitations(); responses(); events() }` (todas `Promise<…[]>`), `ImportTarget { existingUsernames(): Promise<Map<string, string>>; existingInvitationTokens(): Promise<Set<string>>; existingResponses(): Promise<Map<number, string>>; existingProtocols(): Promise<Map<string, number>>; importedEventIds(): Promise<Set<number>>; insertUsers(rows: ImportedUser[]): Promise<void>; insertInvitations(rows: ImportedInvitation[]): Promise<void>; insertResponses(rows: ImportedResponse[]): Promise<void>; insertAuditEntries(rows: ImportedAuditEntry[]): Promise<void>; recordImport(detail: Record<string, number>): Promise<void> }`
  - `makeImportLegacy({ source, target, newUserId }): (options: { dryRun: boolean }) => Promise<ImportReport>` com `ImportReport = { dryRun: boolean; users: TableReport; invitations: TableReport; responses: TableReport; audit: TableReport; conflicts: string[]; notes: string[] }` e `TableReport = { found: number; imported: number; skipped: number }`
  - `legacyImporter(path: string): { run(options: { dryRun: boolean }): Promise<ImportReport>; close(): void }` em `@/server/legacy-import/composition`
  - script `pnpm migrate:legacy <caminho do portal.db> [--dry-run]`; `engines.node` `>=22.13`

Regras (spec, seção 7):

| Tabela antiga | Tabela nova | Regra |
|---|---|---|
| `usuarios` | `users` | `usuario` → `username`/`displayUsername`; `nome` → `name` (ou o `usuario`); `papel` `admin` → `admin`, qualquer outro → `team`; `ativo = 0` → `banned = true`, `banReason = 'desativado'`; `criado_em` → `createdAt`; `acesso_em` → `lastLoginAt`; e-mail `<usuario>@users.invalid`; **sem conta de senha**; usuário que já existe (ex.: `victor`) fica como está |
| `convites` | `invitations` | todos os campos (`observacao` → `note`, `aberturas` → `openCount`, `aberto_em` → `lastOpenedAt`); `criado_por` → `createdById` pelo `username` (nulo se não existir); token que já existe é pulado |
| `respostas` | `responses` | **id antigo preservado**; protocolo repetido ganha `-2`, `-3` pela ordem de id (E6); `(sem protocolo)` ou vazio → `SEM-<id>`; `situacao` (`nova`, `em_analise`, `validada`, `descartada`) → `new`, `in_review`, `validated`, `discarded`; `cnpjDigits` calculado; `solicitante_no_qsa` `sim`/`nao` → `true`/`false`; `tratado_por` → `handledById` pelo `username`; `pacote` inteiro → `payload` (texto que não é JSON vira `{ "raw": "<texto>" }`); projeções antigas mantidas; token de convite inexistente → nulo; ao fim, a sequência de `responses.id` passa a `max(id) + 1` |
| `eventos` | `audit_logs` | `quando` → `occurredAt`; `quem` → `actorUsername` e, se existir, `actorId`; `o_que` traduzido por `AUDIT_ACTION_MAP` (abaixo); `referencia` → `reference`; `detalhe` (JSON) → `detail`, acrescido de `legacyEventId` (a chave da idempotência) e do `extra` da tradução |
| — | `audit_logs` | uma linha `legacy_imported` com as contagens, a cada execução de verdade |

`AUDIT_ACTION_MAP`:

| `o_que` antigo | `action` | `extra` |
|---|---|---|
| `acesso_negado` | `access_denied` | |
| `convite_criado` / `convite_apagado` | `invitation_created` / `invitation_deleted` | |
| `resposta_recebida` / `resposta_tratada` | `response_received` / `response_handled` | |
| `adesao_recebida` / `adesao_tratada` | `adhesion_received` / `adhesion_handled` | |
| `evento_criado` / `evento_alterado` / `evento_endereco_trocado` | `event_created` / `event_updated` / `event_slug_changed` | |
| `inscricao_recebida` / `inscricao_tratada` | `registration_received` / `registration_handled` | |
| `usuario_criado` / `usuario_alterado` | `user_created` / `user_updated` | |
| `planilha_exportada` | `spreadsheet_exported` | `{ kind: 'responses' }` |
| `planilha_adesoes_exportada` | `spreadsheet_exported` | `{ kind: 'adhesions' }` |
| `planilha_inscricoes_exportada` | `spreadsheet_exported` | `{ kind: 'registrations' }` |
| qualquer outro | `legacy_imported` | `{ legacyAction: '<o_que>' }` (e um aviso no relatório) |

Esses são todos os `registrar(…, '<ação>')` de `legacy/src/banco.mjs` e `legacy/servidor.mjs` (conferido com `git show 22b3cfc:legacy/src/banco.mjs | grep -o "registrar([^,]*, '[a-z_]*'"`).

Idempotência e conflitos: tudo é decidido antes de gravar. Usuário pelo `username`, convite pelo token, resposta pelo id, evento pelo `legacyEventId`. Uma resposta cujo id já existe no banco novo **com outro protocolo**, ou cujo protocolo já é de outra resposta, é **conflito**: o `--dry-run` lista, e a execução de verdade não grava nada enquanto houver conflito (sai com código 1). Ordem: usuários → convites → respostas → auditoria, uma transação por tabela.

- [ ] **Step 1: Branch** — `git switch teste && git pull --ff-only && git switch -c feat/migracao-do-portal-antigo`

- [ ] **Step 2: Testes que falham**

```ts
// src/server/legacy-import/domain/mapping.test.ts
import { describe, expect, it } from 'vitest'
import { AUDIT_ACTIONS } from '@/server/audit/domain/audit-entry'
import { AUDIT_ACTION_MAP, assignProtocols, mapResponse, mapUser, requesterInQsaFrom, translateAuditAction } from './mapping'

describe('legacy mapping', () => {
  it('suffixes repeated protocols by id order and names the missing ones', () => {
    const protocols = assignProtocols([
      { id: 5, protocolo: 'DS-260915-ABCD' }, { id: 2, protocolo: 'DS-260915-ABCD' }, { id: 3, protocolo: '(sem protocolo)' },
      { id: 9, protocolo: 'DS-260915-ABCD' }, { id: 4, protocolo: '' },
    ])
    expect(Object.fromEntries(protocols)).toEqual({ 2: 'DS-260915-ABCD', 3: 'SEM-3', 4: 'SEM-4', 5: 'DS-260915-ABCD-2', 9: 'DS-260915-ABCD-3' })
  })

  it('translates every legacy audit action to a known action', () => {
    for (const legacy of Object.keys(AUDIT_ACTION_MAP)) {
      expect(AUDIT_ACTIONS).toContain(translateAuditAction(legacy).action)
    }
    expect(translateAuditAction('planilha_adesoes_exportada')).toEqual({ action: 'spreadsheet_exported', extra: { kind: 'adhesions' }, known: true })
    expect(translateAuditAction('coisa_estranha')).toEqual({ action: 'legacy_imported', extra: { legacyAction: 'coisa_estranha' }, known: false })
  })

  it('maps users without password and with the synthetic e-mail', () => {
    expect(mapUser({ usuario: 'maria', nome: null, papel: 'equipe', ativo: 0, criado_em: '2026-08-02T12:00:00.000Z', acesso_em: null }, 'id-1')).toEqual({
      id: 'id-1', username: 'maria', name: 'maria', email: 'maria@users.invalid', role: 'team', banned: true, banReason: 'desativado',
      createdAt: new Date('2026-08-02T12:00:00.000Z'), lastLoginAt: null,
    })
  })

  it('maps a response keeping the legacy projections and the whole pacote', () => {
    const mapped = mapResponse({
      id: 7, protocolo: 'DS-260915-ABCD', token_convite: 'ORFAOXXXXX', recebido_em: '2026-09-15T12:00:00.000Z', nome_empresa: 'Padaria',
      cnpj: '11.222.333/0001-81', solicitante: 'Ana', email: 'a@b.com', telefone: null, versao: 'sintetico', saida: 'B', posicao: 'Simples híbrido',
      certeza: 'aberta', urgencia: 'ALTA', confianca: 'MÉDIA', solicitante_no_qsa: 'sim', pacote: '{"respostas":{"a":"b"}}', situacao: 'em_analise',
      nota_interna: 'n', tratado_por: 'fantasma', tratado_em: '2026-09-16T12:00:00.000Z',
    }, { protocol: 'DS-260915-ABCD-2', invitationTokens: new Set(['ABCDEFGHJK']), userIds: new Map([['maria', 'u1']]) })
    expect(mapped).toMatchObject({
      id: 7, protocol: 'DS-260915-ABCD-2', invitationToken: null, cnpjDigits: '11222333000181', requesterInQsa: true, status: 'in_review',
      handledById: null, handledAt: new Date('2026-09-16T12:00:00.000Z'), payload: { respostas: { a: 'b' } }, outcome: 'B', formVersion: 'sintetico',
    })
    expect([requesterInQsaFrom('nao'), requesterInQsaFrom(null)]).toEqual([false, null])
  })
})
```

```ts
// src/server/legacy-import/application/import-legacy.test.ts
import { describe, expect, it } from 'vitest'
import type { LegacyEvent, LegacyInvitation, LegacyResponse, LegacyUser } from '../domain/legacy-rows'
import type { ImportedAuditEntry, ImportedInvitation, ImportedResponse, ImportedUser } from '../domain/mapping'
import type { ImportTarget } from '../ports/import-target'
import { makeImportLegacy } from './import-legacy'

const response = (id: number, protocolo: string): LegacyResponse => ({
  id, protocolo, token_convite: null, recebido_em: '2026-09-15T12:00:00.000Z', nome_empresa: null, cnpj: null, solicitante: null, email: null,
  telefone: null, versao: null, saida: null, posicao: null, certeza: null, urgencia: null, confianca: null, solicitante_no_qsa: null,
  pacote: '{}', situacao: 'nova', nota_interna: null, tratado_por: null, tratado_em: null,
})

function memoryTarget(existingResponses: [number, string][] = []) {
  const users: ImportedUser[] = []
  const invitations: ImportedInvitation[] = []
  const responses = new Map<number, string>(existingResponses)
  const audit: ImportedAuditEntry[] = []
  const imports: Record<string, number>[] = []
  const target: ImportTarget = {
    existingUsernames: async () => new Map([['victor', 'v1'], ...users.map((u) => [u.username, u.id] as const)]),
    existingInvitationTokens: async () => new Set(invitations.map((i) => i.token)),
    existingResponses: async () => new Map(responses),
    existingProtocols: async () => new Map([...responses].map(([id, protocol]) => [protocol, id])),
    importedEventIds: async () => new Set(audit.map((entry) => Number(entry.detail.legacyEventId))),
    insertUsers: async (rows) => void users.push(...rows),
    insertInvitations: async (rows) => void invitations.push(...rows),
    insertResponses: async (rows: ImportedResponse[]) => rows.forEach((row) => responses.set(row.id, row.protocol)),
    insertAuditEntries: async (rows) => void audit.push(...rows),
    recordImport: async (detail) => void imports.push(detail),
  }
  return { target, users, invitations, responses, audit, imports }
}

const legacyUsers: LegacyUser[] = [
  { usuario: 'victor', nome: 'Victor', papel: 'admin', ativo: 1, criado_em: '2026-08-01T12:00:00.000Z', acesso_em: null },
  { usuario: 'maria', nome: 'Maria', papel: 'equipe', ativo: 1, criado_em: '2026-08-02T12:00:00.000Z', acesso_em: null },
]
const legacyInvitations: LegacyInvitation[] = [
  { token: 'ABCDEFGHJK', nome_empresa: 'Padaria', cnpj: null, email: null, observacao: null, criado_em: '2026-09-01T12:00:00.000Z', criado_por: 'maria', aberturas: 3, aberto_em: null },
]
const legacyEvents: LegacyEvent[] = [{ id: 1, quando: '2026-09-15T12:00:00.000Z', quem: 'maria', o_que: 'acesso_negado', referencia: 'maria', detalhe: '{"motivo":"senha incorreta"}' }]

const source = (responses: LegacyResponse[]) => ({
  users: async () => legacyUsers,
  invitations: async () => legacyInvitations,
  responses: async () => responses,
  events: async () => legacyEvents,
})

describe('importLegacy', () => {
  it('counts without writing on a dry run', async () => {
    const memory = memoryTarget()
    const report = await makeImportLegacy({ source: source([response(1, 'DS-1'), response(2, 'DS-1')]), target: memory.target, newUserId: () => 'new' })({ dryRun: true })
    expect(report).toMatchObject({ dryRun: true, users: { found: 2, imported: 1, skipped: 1 }, responses: { found: 2, imported: 2, skipped: 0 }, conflicts: [] })
    expect(report.notes).toContain('resposta 2: protocolo DS-1 gravado como DS-1-2')
    expect(memory.users).toHaveLength(0)
    expect(memory.imports).toHaveLength(0)
  })

  it('imports in order, links ids by username, and imports nothing new the second time', async () => {
    const memory = memoryTarget()
    let next = 0
    const run = makeImportLegacy({ source: source([response(1, 'DS-1')]), target: memory.target, newUserId: () => `u${++next}` })
    await run({ dryRun: false })
    expect(memory.users.map((u) => u.username)).toEqual(['maria'])
    expect(memory.invitations[0]?.createdById).toBe('u1')
    expect(memory.audit[0]).toMatchObject({ action: 'access_denied', actorId: 'u1', detail: { motivo: 'senha incorreta', legacyEventId: 1 } })
    const again = await run({ dryRun: false })
    expect(again).toMatchObject({ users: { imported: 0 }, invitations: { imported: 0 }, responses: { imported: 0, skipped: 1 }, audit: { imported: 0 } })
    expect(memory.imports).toHaveLength(2)
  })

  it('writes nothing while an id or a protocol conflicts with the new database', async () => {
    const memory = memoryTarget([[1, 'DS-OUTRO'], [50, 'DS-2']])
    const report = await makeImportLegacy({ source: source([response(1, 'DS-1'), response(2, 'DS-2')]), target: memory.target, newUserId: () => 'x' })({ dryRun: false })
    expect(report.conflicts).toEqual([
      'resposta 1: o id já existe no banco novo com o protocolo DS-OUTRO',
      'resposta 2: o protocolo DS-2 já é da resposta 50',
    ])
    expect(memory.users).toHaveLength(0)
    expect(memory.imports).toHaveLength(0)
  })
})
```

```ts
// src/server/legacy-import/adapters/legacy-import.int.test.ts
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import { legacyImporter } from '../composition'

const LEGACY_SCHEMA = `
CREATE TABLE convites (token TEXT PRIMARY KEY, nome_empresa TEXT, cnpj TEXT, email TEXT, observacao TEXT, criado_em TEXT NOT NULL, criado_por TEXT, aberturas INTEGER NOT NULL DEFAULT 0, aberto_em TEXT);
CREATE TABLE respostas (id INTEGER PRIMARY KEY AUTOINCREMENT, protocolo TEXT NOT NULL, token_convite TEXT, recebido_em TEXT NOT NULL, nome_empresa TEXT, cnpj TEXT, solicitante TEXT, email TEXT, telefone TEXT, versao TEXT, saida TEXT, posicao TEXT, certeza TEXT, urgencia TEXT, confianca TEXT, solicitante_no_qsa TEXT, pacote TEXT NOT NULL, situacao TEXT NOT NULL DEFAULT 'nova', nota_interna TEXT, tratado_por TEXT, tratado_em TEXT);
CREATE TABLE usuarios (usuario TEXT PRIMARY KEY, nome TEXT, papel TEXT NOT NULL DEFAULT 'equipe', sal TEXT NOT NULL, resumo TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL, criado_por TEXT, alterado_em TEXT, alterado_por TEXT, acesso_em TEXT);
CREATE TABLE eventos (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT NOT NULL, quem TEXT, o_que TEXT NOT NULL, referencia TEXT, detalhe TEXT);
`

const path = join(tmpdir(), `portal-${randomUUID()}.db`)

function buildLegacyDatabase() {
  const db = new DatabaseSync(path)
  db.exec(LEGACY_SCHEMA)
  const user = db.prepare('INSERT INTO usuarios (usuario, nome, papel, sal, resumo, ativo, criado_em, acesso_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  user.run('victor', 'Victor do SQLite', 'admin', 's', 'r', 1, '2026-08-01T12:00:00.000Z', null)
  user.run('maria', 'Maria', 'equipe', 's', 'r', 0, '2026-08-02T12:00:00.000Z', '2026-09-10T12:00:00.000Z')
  db.prepare('INSERT INTO convites (token, nome_empresa, cnpj, criado_em, criado_por, aberturas, aberto_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('ABCDEFGHJK', 'Padaria Boa', '11.222.333/0001-81', '2026-09-01T12:00:00.000Z', 'maria', 3, '2026-09-02T12:00:00.000Z')
  const response = db.prepare(`INSERT INTO respostas (id, protocolo, token_convite, recebido_em, nome_empresa, cnpj, solicitante_no_qsa, pacote, situacao, tratado_por, tratado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const pacote = (nome: string) => JSON.stringify({ protocolo: 'x', respostas: { nomeEmpresa: nome }, diagnostico: { saida: 'B' } })
  response.run(1, 'DS-260915-ABCD', 'ABCDEFGHJK', '2026-09-15T12:00:00.000Z', 'Padaria Boa', '11.222.333/0001-81', 'sim', pacote('Padaria Boa'), 'validada', 'maria', '2026-09-16T12:00:00.000Z')
  response.run(2, 'DS-260915-ABCD', 'ORFAOXXXXX', '2026-09-15T13:00:00.000Z', 'Oficina', null, 'nao', pacote('Oficina'), 'em_analise', 'fantasma', '2026-09-16T13:00:00.000Z')
  response.run(3, '(sem protocolo)', null, '2026-09-15T14:00:00.000Z', 'Sem Protocolo', null, null, pacote('Sem Protocolo'), 'nova', null, null)
  response.run(7, 'DS-260916-WXYZ', null, '2026-09-16T12:00:00.000Z', 'Loja', null, null, pacote('Loja'), 'descartada', null, null)
  const event = db.prepare('INSERT INTO eventos (quando, quem, o_que, referencia, detalhe) VALUES (?, ?, ?, ?, ?)')
  event.run('2026-09-10T12:00:00.000Z', 'maria', 'acesso_negado', 'maria', '{"motivo":"senha incorreta"}')
  event.run('2026-09-11T12:00:00.000Z', 'victor', 'planilha_exportada', '4', null)
  event.run('2026-09-12T12:00:00.000Z', null, 'resposta_recebida', 'DS-260915-ABCD', '{"id":1}')
  event.run('2026-09-13T12:00:00.000Z', 'victor', 'coisa_estranha', null, null)
  db.close()
}

describe('legacy import against a SQLite copy', () => {
  beforeAll(async () => {
    await resetDatabase()
    buildLegacyDatabase()
    await prisma.user.create({ data: { id: 'victor-novo', name: 'Victor', email: 'victor@users.invalid', username: 'victor', role: 'admin' } })
  })
  afterAll(() => rmSync(path, { force: true }))

  it('dry run counts and writes nothing', async () => {
    const importer = legacyImporter(path)
    const report = await importer.run({ dryRun: true })
    importer.close()
    expect(report).toMatchObject({ users: { found: 2, imported: 1, skipped: 1 }, invitations: { imported: 1 }, responses: { found: 4, imported: 4 }, audit: { imported: 4 }, conflicts: [] })
    expect(await prisma.response.count()).toBe(0)
  })

  it('imports everything once, twice in a row, with ids, protocols, links and the sequence', async () => {
    for (let run = 0; run < 2; run++) {
      const importer = legacyImporter(path)
      await importer.run({ dryRun: false })
      importer.close()
    }
    const maria = await prisma.user.findUniqueOrThrow({ where: { username: 'maria' } })
    expect(maria).toMatchObject({ email: 'maria@users.invalid', role: 'team', banned: true, lastLoginAt: new Date('2026-09-10T12:00:00.000Z') })
    expect((await prisma.user.findUniqueOrThrow({ where: { username: 'victor' } })).name).toBe('Victor')
    expect(await prisma.account.count({ where: { userId: maria.id } })).toBe(0)
    expect(await prisma.invitation.findUniqueOrThrow({ where: { token: 'ABCDEFGHJK' } })).toMatchObject({ createdById: maria.id, openCount: 3 })

    const responses = await prisma.response.findMany({ orderBy: { id: 'asc' } })
    expect(responses.map((r) => [r.id, r.protocol])).toEqual([[1, 'DS-260915-ABCD'], [2, 'DS-260915-ABCD-2'], [3, 'SEM-3'], [7, 'DS-260916-WXYZ']])
    expect(responses[0]).toMatchObject({ status: 'validated', handledById: maria.id, invitationToken: 'ABCDEFGHJK', requesterInQsa: true, cnpjDigits: '11222333000181' })
    expect(responses[1]).toMatchObject({ status: 'in_review', handledById: null, invitationToken: null, requesterInQsa: false })
    expect(responses[3]?.payload).toMatchObject({ respostas: { nomeEmpresa: 'Loja' } })
    expect((await prisma.response.create({ data: { protocol: 'DS-261001-NOVA', payload: {} } })).id).toBe(8)

    const audit = await prisma.auditLog.findMany({ orderBy: { id: 'asc' } })
    const legacy = audit.filter((entry) => (entry.detail as { legacyEventId?: number } | null)?.legacyEventId)
    expect(legacy.map((entry) => entry.action)).toEqual(['access_denied', 'spreadsheet_exported', 'response_received', 'legacy_imported'])
    expect(legacy[0]).toMatchObject({ actorId: maria.id, actorUsername: 'maria', occurredAt: new Date('2026-09-10T12:00:00.000Z') })
    expect(legacy[1]?.detail).toMatchObject({ kind: 'responses' })
    expect(legacy[3]?.detail).toMatchObject({ legacyAction: 'coisa_estranha' })
    expect(audit.filter((entry) => entry.action === 'legacy_imported' && !(entry.detail as { legacyEventId?: number } | null)?.legacyEventId)).toHaveLength(2)
  })
})
```

- [ ] **Step 3:** Run `pnpm vitest run src/server/legacy-import`. Expected: FAIL — módulos não existem.

- [ ] **Step 4: Domínio**

```ts
// src/server/legacy-import/domain/legacy-rows.ts
export interface LegacyUser {
  usuario: string
  nome: string | null
  papel: string
  ativo: number
  criado_em: string
  acesso_em: string | null
}

export interface LegacyInvitation {
  token: string
  nome_empresa: string | null
  cnpj: string | null
  email: string | null
  observacao: string | null
  criado_em: string
  criado_por: string | null
  aberturas: number
  aberto_em: string | null
}

export interface LegacyResponse {
  id: number
  protocolo: string
  token_convite: string | null
  recebido_em: string
  nome_empresa: string | null
  cnpj: string | null
  solicitante: string | null
  email: string | null
  telefone: string | null
  versao: string | null
  saida: string | null
  posicao: string | null
  certeza: string | null
  urgencia: string | null
  confianca: string | null
  solicitante_no_qsa: string | null
  pacote: string
  situacao: string
  nota_interna: string | null
  tratado_por: string | null
  tratado_em: string | null
}

export interface LegacyEvent {
  id: number
  quando: string
  quem: string | null
  o_que: string
  referencia: string | null
  detalhe: string | null
}
```

Os nomes de propriedade aqui são as colunas do SQLite antigo: é dado de origem, lido como está.

```ts
// src/server/legacy-import/domain/mapping.ts
import type { LegacyEvent, LegacyInvitation, LegacyResponse, LegacyUser } from './legacy-rows'

export type ImportedAuditAction =
  | 'access_denied' | 'invitation_created' | 'invitation_deleted' | 'response_received' | 'response_handled'
  | 'adhesion_received' | 'adhesion_handled' | 'event_created' | 'event_updated' | 'event_slug_changed'
  | 'registration_received' | 'registration_handled' | 'user_created' | 'user_updated' | 'spreadsheet_exported' | 'legacy_imported'

export type ImportedStatus = 'new' | 'in_review' | 'validated' | 'discarded'

export interface ImportedUser {
  id: string
  username: string
  name: string
  email: string
  role: 'admin' | 'team'
  banned: boolean
  banReason: string | null
  createdAt: Date
  lastLoginAt: Date | null
}

export interface ImportedInvitation {
  token: string
  companyName: string | null
  cnpj: string | null
  email: string | null
  note: string | null
  createdAt: Date
  createdById: string | null
  openCount: number
  lastOpenedAt: Date | null
}

export interface ImportedResponse {
  id: number
  protocol: string
  invitationToken: string | null
  receivedAt: Date
  companyName: string | null
  cnpj: string | null
  cnpjDigits: string | null
  requester: string | null
  email: string | null
  phone: string | null
  formVersion: string | null
  outcome: string | null
  position: string | null
  certainty: string | null
  urgency: string | null
  confidence: string | null
  requesterInQsa: boolean | null
  payload: unknown
  status: ImportedStatus
  internalNote: string | null
  handledById: string | null
  handledAt: Date | null
}

export interface ImportedAuditEntry {
  occurredAt: Date
  actorId: string | null
  actorUsername: string | null
  action: ImportedAuditAction
  reference: string | null
  detail: Record<string, unknown>
}

export const AUDIT_ACTION_MAP: Record<string, { action: ImportedAuditAction; extra?: Record<string, unknown> }> = {
  acesso_negado: { action: 'access_denied' },
  convite_criado: { action: 'invitation_created' },
  convite_apagado: { action: 'invitation_deleted' },
  resposta_recebida: { action: 'response_received' },
  resposta_tratada: { action: 'response_handled' },
  adesao_recebida: { action: 'adhesion_received' },
  adesao_tratada: { action: 'adhesion_handled' },
  evento_criado: { action: 'event_created' },
  evento_alterado: { action: 'event_updated' },
  evento_endereco_trocado: { action: 'event_slug_changed' },
  inscricao_recebida: { action: 'registration_received' },
  inscricao_tratada: { action: 'registration_handled' },
  usuario_criado: { action: 'user_created' },
  usuario_alterado: { action: 'user_updated' },
  planilha_exportada: { action: 'spreadsheet_exported', extra: { kind: 'responses' } },
  planilha_adesoes_exportada: { action: 'spreadsheet_exported', extra: { kind: 'adhesions' } },
  planilha_inscricoes_exportada: { action: 'spreadsheet_exported', extra: { kind: 'registrations' } },
}

export const STATUS_MAP: Record<string, ImportedStatus> = { nova: 'new', em_analise: 'in_review', validada: 'validated', descartada: 'discarded' }

const date = (value: string | null): Date | null => (value ? new Date(value) : null)

export function translateAuditAction(legacy: string): { action: ImportedAuditAction; extra: Record<string, unknown>; known: boolean } {
  const found = AUDIT_ACTION_MAP[legacy]
  return found ? { action: found.action, extra: found.extra ?? {}, known: true } : { action: 'legacy_imported', extra: { legacyAction: legacy }, known: false }
}

export function assignProtocols(rows: { id: number; protocolo: string }[]): Map<number, string> {
  const assigned = new Map<number, string>()
  const used = new Set<string>()
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    const base = row.protocolo.trim()
    let protocol = !base || base === '(sem protocolo)' ? `SEM-${row.id}` : base
    for (let suffix = 2; used.has(protocol); suffix++) protocol = `${base}-${suffix}`
    used.add(protocol)
    assigned.set(row.id, protocol)
  }
  return assigned
}

export const requesterInQsaFrom = (value: string | null): boolean | null => (value === 'sim' ? true : value === 'nao' ? false : null)

export const cnpjDigitsOf = (cnpj: string | null): string | null => (cnpj ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase() || null

function parseJson(text: string | null): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

export const mapUser = (row: LegacyUser, id: string): ImportedUser => ({
  id,
  username: row.usuario,
  name: row.nome || row.usuario,
  email: `${row.usuario}@users.invalid`,
  role: row.papel === 'admin' ? 'admin' : 'team',
  banned: row.ativo === 0,
  banReason: row.ativo === 0 ? 'desativado' : null,
  createdAt: new Date(row.criado_em),
  lastLoginAt: date(row.acesso_em),
})

export const mapInvitation = (row: LegacyInvitation, userIds: Map<string, string>): ImportedInvitation => ({
  token: row.token,
  companyName: row.nome_empresa,
  cnpj: row.cnpj,
  email: row.email,
  note: row.observacao,
  createdAt: new Date(row.criado_em),
  createdById: row.criado_por ? (userIds.get(row.criado_por) ?? null) : null,
  openCount: row.aberturas,
  lastOpenedAt: date(row.aberto_em),
})

export function mapResponse(row: LegacyResponse, context: { protocol: string; invitationTokens: Set<string>; userIds: Map<string, string> }): ImportedResponse {
  return {
    id: row.id,
    protocol: context.protocol,
    invitationToken: row.token_convite && context.invitationTokens.has(row.token_convite) ? row.token_convite : null,
    receivedAt: new Date(row.recebido_em),
    companyName: row.nome_empresa,
    cnpj: row.cnpj,
    cnpjDigits: cnpjDigitsOf(row.cnpj),
    requester: row.solicitante,
    email: row.email,
    phone: row.telefone,
    formVersion: row.versao,
    outcome: row.saida,
    position: row.posicao,
    certainty: row.certeza,
    urgency: row.urgencia,
    confidence: row.confianca,
    requesterInQsa: requesterInQsaFrom(row.solicitante_no_qsa),
    payload: parseJson(row.pacote) ?? {},
    status: STATUS_MAP[row.situacao] ?? 'new',
    internalNote: row.nota_interna,
    handledById: row.tratado_por ? (context.userIds.get(row.tratado_por) ?? null) : null,
    handledAt: date(row.tratado_em),
  }
}

export function mapAuditEvent(row: LegacyEvent, userIds: Map<string, string>): ImportedAuditEntry {
  const { action, extra } = translateAuditAction(row.o_que)
  const parsed = parseJson(row.detalhe)
  const detail = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : parsed === null ? {} : { value: parsed }
  return {
    occurredAt: new Date(row.quando),
    actorId: row.quem ? (userIds.get(row.quem) ?? null) : null,
    actorUsername: row.quem,
    action,
    reference: row.referencia,
    detail: { ...detail, ...extra, legacyEventId: row.id },
  }
}
```

- [ ] **Step 5: Portas, caso de uso, adaptadores, composição e script**

```ts
// src/server/legacy-import/ports/legacy-source.ts
import type { LegacyEvent, LegacyInvitation, LegacyResponse, LegacyUser } from '../domain/legacy-rows'

export interface LegacySource {
  users(): Promise<LegacyUser[]>
  invitations(): Promise<LegacyInvitation[]>
  responses(): Promise<LegacyResponse[]>
  events(): Promise<LegacyEvent[]>
}
```

```ts
// src/server/legacy-import/ports/import-target.ts
import type { ImportedAuditEntry, ImportedInvitation, ImportedResponse, ImportedUser } from '../domain/mapping'

export interface ImportTarget {
  existingUsernames(): Promise<Map<string, string>>
  existingInvitationTokens(): Promise<Set<string>>
  existingResponses(): Promise<Map<number, string>>
  existingProtocols(): Promise<Map<string, number>>
  importedEventIds(): Promise<Set<number>>
  insertUsers(rows: ImportedUser[]): Promise<void>
  insertInvitations(rows: ImportedInvitation[]): Promise<void>
  insertResponses(rows: ImportedResponse[]): Promise<void>
  insertAuditEntries(rows: ImportedAuditEntry[]): Promise<void>
  recordImport(detail: Record<string, number>): Promise<void>
}
```

```ts
// src/server/legacy-import/application/import-legacy.ts
import { assignProtocols, mapAuditEvent, mapInvitation, mapResponse, mapUser, translateAuditAction, type ImportedResponse } from '../domain/mapping'
import type { ImportTarget } from '../ports/import-target'
import type { LegacySource } from '../ports/legacy-source'

export interface TableReport {
  found: number
  imported: number
  skipped: number
}

export interface ImportReport {
  dryRun: boolean
  users: TableReport
  invitations: TableReport
  responses: TableReport
  audit: TableReport
  conflicts: string[]
  notes: string[]
}

const table = (found: number, imported: number, skipped = found - imported): TableReport => ({ found, imported, skipped })

export function makeImportLegacy({ source, target, newUserId }: { source: LegacySource; target: ImportTarget; newUserId: () => string }) {
  return async function importLegacy({ dryRun }: { dryRun: boolean }): Promise<ImportReport> {
    const [users, invitations, responses, events] = await Promise.all([source.users(), source.invitations(), source.responses(), source.events()])
    const [existingUsers, existingTokens, existingResponses, existingProtocols, importedEvents] = await Promise.all([
      target.existingUsernames(), target.existingInvitationTokens(), target.existingResponses(), target.existingProtocols(), target.importedEventIds(),
    ])
    const conflicts: string[] = []
    const notes: string[] = []

    const newUsers = users.filter((row) => !existingUsers.has(row.usuario)).map((row) => mapUser(row, newUserId()))
    const userIds = new Map(existingUsers)
    for (const user of newUsers) userIds.set(user.username, user.id)

    const newInvitations = invitations.filter((row) => !existingTokens.has(row.token)).map((row) => mapInvitation(row, userIds))
    const tokens = new Set([...existingTokens, ...invitations.map((row) => row.token)])

    const protocols = assignProtocols(responses)
    const newResponses: ImportedResponse[] = []
    let skippedResponses = 0
    for (const row of responses) {
      const protocol = protocols.get(row.id) ?? `SEM-${row.id}`
      const sameId = existingResponses.get(row.id)
      if (sameId !== undefined) {
        if (sameId === protocol) skippedResponses++
        else conflicts.push(`resposta ${row.id}: o id já existe no banco novo com o protocolo ${sameId}`)
        continue
      }
      const owner = existingProtocols.get(protocol)
      if (owner !== undefined) {
        conflicts.push(`resposta ${row.id}: o protocolo ${protocol} já é da resposta ${owner}`)
        continue
      }
      if (protocol !== row.protocolo) notes.push(`resposta ${row.id}: protocolo ${row.protocolo} gravado como ${protocol}`)
      if (row.token_convite && !tokens.has(row.token_convite)) notes.push(`resposta ${row.id}: convite ${row.token_convite} não existe; fica sem convite`)
      if (row.tratado_por && !userIds.has(row.tratado_por)) notes.push(`resposta ${row.id}: tratada por ${row.tratado_por}, que não existe; fica sem autor`)
      newResponses.push(mapResponse(row, { protocol, invitationTokens: tokens, userIds }))
    }

    const newEvents = events.filter((row) => !importedEvents.has(row.id))
    for (const row of newEvents) {
      if (!translateAuditAction(row.o_que).known) notes.push(`evento ${row.id}: ação ${row.o_que} sem equivalente; gravada como legacy_imported`)
    }

    const report: ImportReport = {
      dryRun,
      users: table(users.length, newUsers.length),
      invitations: table(invitations.length, newInvitations.length),
      responses: table(responses.length, newResponses.length, skippedResponses),
      audit: table(events.length, newEvents.length),
      conflicts,
      notes,
    }
    if (dryRun || conflicts.length) return report

    await target.insertUsers(newUsers)
    await target.insertInvitations(newInvitations)
    await target.insertResponses(newResponses)
    await target.insertAuditEntries(newEvents.map((row) => mapAuditEvent(row, userIds)))
    await target.recordImport({ users: newUsers.length, invitations: newInvitations.length, responses: newResponses.length, audit: newEvents.length })
    return report
  }
}
```

```ts
// src/server/legacy-import/adapters/node-sqlite-legacy-source.ts
import { DatabaseSync } from 'node:sqlite'
import type { LegacyEvent, LegacyInvitation, LegacyResponse, LegacyUser } from '../domain/legacy-rows'
import type { LegacySource } from '../ports/legacy-source'

type Row = Record<string, unknown>

const text = (row: Row, key: string): string | null => (row[key] === null || row[key] === undefined ? null : String(row[key]))
const required = (row: Row, key: string): string => text(row, key) ?? ''
const integer = (row: Row, key: string): number => Number(row[key] ?? 0)

export function openLegacySource(path: string): LegacySource & { close(): void } {
  const db = new DatabaseSync(path)
  const exists = (table: string) => db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) !== undefined
  const all = (table: string, sql: string): Row[] => (exists(table) ? db.prepare(sql).all() : [])

  return {
    users: async () =>
      all('usuarios', 'SELECT * FROM usuarios ORDER BY criado_em, usuario').map((row): LegacyUser => ({
        usuario: required(row, 'usuario'), nome: text(row, 'nome'), papel: required(row, 'papel'), ativo: integer(row, 'ativo'),
        criado_em: required(row, 'criado_em'), acesso_em: text(row, 'acesso_em'),
      })),
    invitations: async () =>
      all('convites', 'SELECT * FROM convites ORDER BY criado_em, token').map((row): LegacyInvitation => ({
        token: required(row, 'token'), nome_empresa: text(row, 'nome_empresa'), cnpj: text(row, 'cnpj'), email: text(row, 'email'),
        observacao: text(row, 'observacao'), criado_em: required(row, 'criado_em'), criado_por: text(row, 'criado_por'),
        aberturas: integer(row, 'aberturas'), aberto_em: text(row, 'aberto_em'),
      })),
    responses: async () =>
      all('respostas', 'SELECT * FROM respostas ORDER BY id').map((row): LegacyResponse => ({
        id: integer(row, 'id'), protocolo: required(row, 'protocolo'), token_convite: text(row, 'token_convite'), recebido_em: required(row, 'recebido_em'),
        nome_empresa: text(row, 'nome_empresa'), cnpj: text(row, 'cnpj'), solicitante: text(row, 'solicitante'), email: text(row, 'email'),
        telefone: text(row, 'telefone'), versao: text(row, 'versao'), saida: text(row, 'saida'), posicao: text(row, 'posicao'),
        certeza: text(row, 'certeza'), urgencia: text(row, 'urgencia'), confianca: text(row, 'confianca'), solicitante_no_qsa: text(row, 'solicitante_no_qsa'),
        pacote: required(row, 'pacote'), situacao: required(row, 'situacao'), nota_interna: text(row, 'nota_interna'),
        tratado_por: text(row, 'tratado_por'), tratado_em: text(row, 'tratado_em'),
      })),
    events: async () =>
      all('eventos', 'SELECT * FROM eventos ORDER BY id').map((row): LegacyEvent => ({
        id: integer(row, 'id'), quando: required(row, 'quando'), quem: text(row, 'quem'), o_que: required(row, 'o_que'),
        referencia: text(row, 'referencia'), detalhe: text(row, 'detalhe'),
      })),
    close: () => db.close(),
  }
}
```

```ts
// src/server/legacy-import/adapters/prisma-import-target.ts
import type { Prisma } from '@/server/shared/prisma/generated/client'
import { prisma } from '@/server/shared/prisma/client'
import type { ImportTarget } from '../ports/import-target'

const LONG_TRANSACTION = { timeout: 300_000, maxWait: 10_000 }
const json = (value: unknown) => value as Prisma.InputJsonValue

export const prismaImportTarget: ImportTarget = {
  existingUsernames: async () =>
    new Map((await prisma.user.findMany({ select: { id: true, username: true } })).flatMap((user) => (user.username ? [[user.username, user.id] as const] : []))),
  existingInvitationTokens: async () => new Set((await prisma.invitation.findMany({ select: { token: true } })).map((row) => row.token)),
  existingResponses: async () => new Map((await prisma.response.findMany({ select: { id: true, protocol: true } })).map((row) => [row.id, row.protocol] as const)),
  existingProtocols: async () => new Map((await prisma.response.findMany({ select: { id: true, protocol: true } })).map((row) => [row.protocol, row.id] as const)),
  importedEventIds: async () => {
    const rows = await prisma.$queryRaw<{ id: number }[]>`SELECT (detail->>'legacyEventId')::int AS id FROM audit_logs WHERE detail->>'legacyEventId' IS NOT NULL`
    return new Set(rows.map((row) => row.id))
  },
  insertUsers: async (rows) =>
    prisma.$transaction(async (tx) => {
      if (rows.length) await tx.user.createMany({ data: rows.map((row) => ({ ...row, displayUsername: row.username })) })
    }, LONG_TRANSACTION),
  insertInvitations: async (rows) =>
    prisma.$transaction(async (tx) => {
      if (rows.length) await tx.invitation.createMany({ data: rows })
    }, LONG_TRANSACTION),
  insertResponses: async (rows) =>
    prisma.$transaction(async (tx) => {
      if (rows.length) await tx.response.createMany({ data: rows.map((row) => ({ ...row, payload: json(row.payload) })) })
      // Ids were copied by hand: without this the next submission would collide with a migrated id.
      await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('responses', 'id'), COALESCE((SELECT MAX(id) FROM responses), 0) + 1, false)`
    }, LONG_TRANSACTION),
  insertAuditEntries: async (rows) =>
    prisma.$transaction(async (tx) => {
      if (rows.length) await tx.auditLog.createMany({ data: rows.map((row) => ({ ...row, detail: json(row.detail) })) })
    }, LONG_TRANSACTION),
  recordImport: async (detail) => void (await prisma.auditLog.create({ data: { action: 'legacy_imported', actorUsername: 'migracao', detail } })),
}
```

```ts
// src/server/legacy-import/composition.ts
import { openLegacySource } from './adapters/node-sqlite-legacy-source'
import { prismaImportTarget } from './adapters/prisma-import-target'
import { makeImportLegacy } from './application/import-legacy'

export function legacyImporter(path: string) {
  const source = openLegacySource(path)
  return { run: makeImportLegacy({ source, target: prismaImportTarget, newUserId: () => crypto.randomUUID() }), close: () => source.close() }
}

export type { ImportReport } from './application/import-legacy'
```

```ts
// scripts/migrate-legacy.ts
import { existsSync } from 'node:fs'
import { legacyImporter } from '../src/server/legacy-import/composition'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const path = args.find((arg) => !arg.startsWith('--'))

if (!path || !existsSync(path)) {
  console.error('uso: pnpm migrate:legacy <caminho do portal.db> [--dry-run]')
  process.exit(2)
}

const importer = legacyImporter(path)
try {
  const report = await importer.run({ dryRun })
  console.log(dryRun ? 'Simulação: nada foi gravado.' : report.conflicts.length ? 'Nada foi gravado.' : 'Migração gravada.')
  console.table({ usuários: report.users, convites: report.invitations, respostas: report.responses, auditoria: report.audit })
  for (const note of report.notes) console.log(`aviso · ${note}`)
  for (const conflict of report.conflicts) console.error(`conflito · ${conflict}`)
  if (report.conflicts.length) process.exitCode = 1
} finally {
  importer.close()
}
process.exit(process.exitCode ?? 0)
```

Em `package.json`: script `"migrate:legacy": "tsx --env-file-if-exists=.env scripts/migrate-legacy.ts"` e `"engines": { "node": ">=22.13" }`.

- [ ] **Step 6:** Run `pnpm vitest run src/server/legacy-import`. Expected: PASS. Depois, com uma cópia local qualquer do `portal.db` de homologação (nunca versionada; o `.gitignore` já recusa `*.db`): `pnpm migrate:legacy ./dados/portal.db --dry-run`.
- [ ] **Step 7: Commit e merge**

```bash
git add src/server/legacy-import scripts/migrate-legacy.ts package.json
git commit -m "feat(migracao): importa usuários, convites, respostas e auditoria do SQLite antigo, idempotente e com simulação"
pnpm lint && pnpm typecheck && pnpm test
git switch teste && git merge --no-ff feat/migracao-do-portal-antigo -m "merge: migração do portal antigo" && git branch -d feat/migracao-do-portal-antigo && git push origin teste
```

---

### Task 14: Ponta a ponta com Playwright e o `AGENTS.md`

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/fill.ts`, `tests/e2e/diagnosis.spec.ts`, `tests/e2e/backoffice.spec.ts`
- Modify: `package.json`, `.gitignore`, `AGENTS.md`

**Interfaces:**
- Consumes: tudo das Tarefas 1–13 rodando em `pnpm dev` contra o banco local.
- Produces: script `pnpm test:e2e`; usuário local `e2e-admin`; helpers `E2E_ADMIN`, `useOwnAddress(page)`, `fillVisibleStep(page, choices?)`, `walkToResult(page, choices?): Promise<string>` e `completeDiagnosis(page, path?): Promise<string>` (devolvem o protocolo), `changePhoneAndResubmit(page, phone)`, `login(page)`.

O CNPJ do ponta a ponta é o exemplo alfanumérico da Receita (`12.ABC.345/01DE-35`, válido no validador): a BrasilAPI não o encontra, o selo mostra a falha e nada é pré-preenchido pelo cadastro — o teste não depende de uma empresa real nem da rede.

O rate limit de criação de rascunho é de 5 por minuto por origem. Cada teste usa um endereço próprio em `X-Forwarded-For` (o `requestOrigin` da fundação o lê quando não há `X-Real-IP`), e o global setup limpa `rate_limit_hits` do banco local.

- [ ] **Step 1: Branch e dependências**

```bash
git switch teste && git pull --ff-only && git switch -c test/ponta-a-ponta
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

`package.json`: `"test:e2e": "playwright test"`. `.gitignore`: acrescente `test-results/` e `playwright-report/`.

- [ ] **Step 2: Configuração e global setup**

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  timeout: 120_000,
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: 'http://localhost:3000', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'pnpm dev', url: 'http://localhost:3000/health', reuseExistingServer: true, timeout: 120_000 },
})
```

```ts
// tests/e2e/global-setup.ts
import { execSync } from 'node:child_process'
import { E2E_ADMIN } from './fill'

export default function globalSetup() {
  process.loadEnvFile('.env')
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalido')
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('O ponta a ponta só roda contra o banco local de desenvolvimento.')
  execSync(`docker compose exec -T postgres psql -U app -d ${url.pathname.slice(1)} -c "DELETE FROM rate_limit_hits"`, { stdio: 'inherit' })
  execSync('pnpm auth:bootstrap-admin', {
    stdio: 'inherit',
    env: { ...process.env, BOOTSTRAP_ADMIN_USERNAME: E2E_ADMIN.username, BOOTSTRAP_ADMIN_PASSWORD: E2E_ADMIN.password },
  })
}
```

O `bootstrap-admin` cria o `e2e-admin` na primeira vez e, nas seguintes, reativa e redefine a senha. A senha só existe no banco local.

- [ ] **Step 3: Helpers**

```ts
// tests/e2e/fill.ts
import { expect, type Page } from '@playwright/test'

export const E2E_ADMIN = { username: 'e2e-admin', password: 'senha-local-do-e2e-1' }

const TEXT: Record<string, string> = {
  cnpj: '12.ABC.345/01DE-35',
  nomeEmpresa: 'Empresa Ponta a Ponta',
  solicitante: 'Fulano de Tal',
  email: 'fulano@exemplo.com.br',
  telefone: '(34) 99999-9999',
}
const CHOICE: Record<string, string> = { versaoFormulario: 'sintetico', regimeAtual: 'simples', ehSimei: 'nao', segmento: 'comercio' }

let address = 0
export async function useOwnAddress(page: Page) {
  address++
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `198.51.100.${(Date.now() + address) % 250}` })
}

export async function fillVisibleStep(page: Page, choices: Record<string, string> = {}) {
  const preferred = { ...CHOICE, ...choices }
  for (let pass = 0; pass < 8; pass++) {
    let changed = false
    const keys = await page.locator('[data-field]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-field') ?? ''))
    for (const key of keys) {
      const field = page.locator(`[data-field="${key}"]`)
      const value = TEXT[key]
      if (value !== undefined) {
        const input = field.locator('input')
        if ((await input.inputValue()) === '') {
          await input.fill(value)
          await input.blur()
          changed = true
        }
      } else if (await field.locator('select').count()) {
        const select = field.locator('select')
        if (!(await select.inputValue())) {
          await select.selectOption(preferred[key] ?? { index: 1 })
          changed = true
        }
      } else if (await field.locator('table').count()) {
        const rows = field.locator('tbody tr')
        for (let i = 0; i < (await rows.count()); i++) {
          const radio = rows.nth(i).locator(`input[value="${i === 0 ? 'acima_80' : 'zero'}"]`)
          if (!(await radio.isChecked())) {
            await radio.check()
            changed = true
          }
        }
      } else if (await field.locator('input[type="checkbox"]').count()) {
        const box = field.locator('input[type="checkbox"]')
        if (!(await box.isChecked())) {
          await box.check()
          changed = true
        }
      } else if (await field.locator('input[type="radio"]').count()) {
        if (!(await field.locator('input[type="radio"]:checked').count())) {
          const choice = preferred[key]
          await (choice ? field.locator(`input[value="${choice}"]`) : field.locator('input[type="radio"]').first()).check()
          changed = true
        }
      }
    }
    if (!changed) return
  }
}

export async function walkToResult(page: Page, choices: Record<string, string> = {}) {
  for (let step = 1; step <= 5; step++) {
    await expect(page.getByText(`Etapa ${step} de 5`)).toBeVisible()
    await fillVisibleStep(page, choices)
    await page.getByRole('button', { name: step === 5 ? 'Conferir respostas' : 'Próximo' }).click()
  }
  await page.getByRole('button', { name: 'Ver diagnóstico' }).click()
  await expect(page.getByText('Respostas enviadas automaticamente.')).toBeVisible()
  const heading = await page.getByRole('heading', { name: /^Protocolo DS-/ }).textContent()
  return (heading ?? '').replace('Protocolo ', '').trim()
}

export async function completeDiagnosis(page: Page, path = '/diagnosis'): Promise<string> {
  await useOwnAddress(page)
  await page.goto(path)
  return walkToResult(page)
}

export async function changePhoneAndResubmit(page: Page, phone: string) {
  await page.getByRole('button', { name: 'Revisar respostas' }).click()
  await page.locator('.dx-review-row', { hasText: 'Telefone' }).getByRole('button', { name: 'alterar' }).click()
  const input = page.locator('[data-field="telefone"] input')
  await input.fill(phone)
  await input.blur()
  for (let step = 1; step <= 5; step++) await page.getByRole('button', { name: step === 5 ? 'Conferir respostas' : 'Próximo' }).click()
  await page.getByRole('button', { name: 'Ver diagnóstico' }).click()
  await expect(page.getByText('Respostas enviadas automaticamente.')).toBeVisible()
}

export async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Usuário').fill(E2E_ADMIN.username)
  await page.getByLabel('Senha').fill(E2E_ADMIN.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/backoffice/)
}
```

- [ ] **Step 4: Cenários (falham até tudo estar ligado)**

```ts
// tests/e2e/diagnosis.spec.ts
import { expect, test } from '@playwright/test'
import { changePhoneAndResubmit, completeDiagnosis, fillVisibleStep, login, useOwnAddress, walkToResult } from './fill'

const nothingLocal = () => [localStorage.length, sessionStorage.length]

test('caminho curto até o resultado; F5 mantém o protocolo; nada local', async ({ page }) => {
  const protocol = await completeDiagnosis(page)
  expect(protocol).toMatch(/^DS-\d{6}-[A-Z0-9]{4}$/)
  expect(await page.evaluate(nothingLocal)).toEqual([0, 0])
  await page.reload()
  await page.getByRole('button', { name: 'Retomar' }).click()
  await expect(page.getByRole('heading', { name: `Protocolo ${protocol}` })).toBeVisible()
  expect(await page.evaluate(nothingLocal)).toEqual([0, 0])
  const cookies = await page.context().cookies()
  expect(cookies.find((cookie) => cookie.name === 'draft_id')).toMatchObject({ httpOnly: true, sameSite: 'Lax' })
})

test('voltar, alterar e reenviar mantém o protocolo', async ({ page }) => {
  const protocol = await completeDiagnosis(page)
  await changePhoneAndResubmit(page, '(34) 98888-7777')
  await expect(page.getByRole('heading', { name: `Protocolo ${protocol}` })).toBeVisible()
})

test('o relatório abre com o nome do arquivo e 5 ou 6 folhas', async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => undefined
  })
  await completeDiagnosis(page)
  await page.getByRole('button', { name: 'Baixar o plano de ação em PDF' }).click()
  await page.waitForURL(/\/diagnosis\/report\?print=1/)
  await expect(page).toHaveTitle(/^Plano-De-Acao-SN-Empresa-Ponta-a-Ponta/)
  expect([5, 6]).toContain(await page.locator('.rp-sheet').count())
})

test('o convite pré-preenche e liga a resposta', async ({ page, browser }) => {
  await login(page)
  await page.getByRole('link', { name: 'Convites' }).click()
  const company = `Convidada ${Date.now()}`
  await page.getByPlaceholder('Razão social').fill(company)
  await page.getByRole('button', { name: 'Gerar link' }).click()
  const link = await page.locator('tr', { hasText: company }).locator('.bo-link').textContent()
  const client = await (await browser.newContext()).newPage()
  await useOwnAddress(client)
  await client.goto(new URL(link ?? '').pathname + new URL(link ?? '').search)
  await expect(client.locator('[data-field="nomeEmpresa"] input')).toHaveValue(company)
  await walkToResult(client)
  await page.getByRole('link', { name: 'Respostas' }).click()
  await page.getByPlaceholder('Empresa, CNPJ, protocolo ou respondente').fill(company)
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await expect(page.locator('tr', { hasText: company })).toContainText('convite')
})

test('a matriz vira lista no celular, sem rolagem lateral', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 800 } })).newPage()
  await useOwnAddress(page)
  await page.goto('/diagnosis')
  for (let step = 1; step <= 2; step++) {
    await fillVisibleStep(page, { versaoFormulario: 'completo' })
    await page.getByRole('button', { name: 'Próximo' }).click()
  }
  const matrix = page.locator('[data-field="receitaPorCliente"]')
  await expect(matrix.locator('.dx-matrix-band', { hasText: 'não sei' }).first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})
```

```ts
// tests/e2e/backoffice.spec.ts
import { expect, test } from '@playwright/test'
import { changePhoneAndResubmit, completeDiagnosis, login } from './fill'

test('o backoffice lista, trata, avisa a alteração do cliente e baixa o CSV', async ({ page, browser }) => {
  const client = await (await browser.newContext()).newPage()
  const protocol = await completeDiagnosis(client)
  await login(page)
  await page.getByPlaceholder('Empresa, CNPJ, protocolo ou respondente').fill(protocol)
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await page.locator('tr.bo-row').first().click()
  await page.getByRole('button', { name: 'Em análise' }).click()
  await changePhoneAndResubmit(client, '(34) 97777-6666')
  await page.locator('tr.bo-row').first().click()
  await expect(page.getByText(/Alterada pelo cliente em .*, depois do último tratamento\./)).toBeVisible()
  await expect(page.getByText('(34) 97777-6666')).toBeVisible()
  await page.getByRole('button', { name: 'Fechar' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Baixar planilha (CSV)' }).click()])
  expect(download.suggestedFilename()).toMatch(/^respostas-simples-\d{4}-\d{2}-\d{2}\.csv$/)
})
```

Run: `pnpm db:up && pnpm test:e2e`. Expected: os seis cenários passam (o `webServer` sobe `pnpm dev` se não estiver no ar). Se algum falhar, abra o trace (`pnpm exec playwright show-trace test-results/**/trace.zip`) e corrija o código, nunca o cenário.

- [ ] **Step 5: `AGENTS.md`**

Troque a seção **"Git — em toda implementação"** inteira por:

```markdown
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
```

(mantenha o parágrafo seguinte sobre o compose antigo "frontend" congelado). Na seção **Testes**, acrescente:

```markdown
- Componentes: `*.test.tsx`, projeto `dom` do Vitest (jsdom + Testing Library), `pnpm test:dom`.
- Ponta a ponta: `pnpm test:e2e` (Playwright contra `pnpm dev` e o banco local). O global setup
  só aceita banco em `localhost`, limpa o rate limit e cria ou reativa o usuário `e2e-admin`.
```

Na seção **Rodar**, depois de `pnpm dev`, acrescente:

```bash
pnpm exec playwright install chromium   # uma vez, para o ponta a ponta
pnpm test:e2e
```

E acrescente ao fim a seção:

````markdown
## Migração do portal antigo (SQLite → Postgres)

Roda no container do app novo, contra uma cópia **consistente** do `portal.db`. O arquivo
tem dado de cliente: nunca entra no repositório nem fica no servidor depois.

1. Pelo SSH da VPS, ache os containers: `docker ps --format '{{.Names}}'`. O antigo é o do
   compose "frontend" (`/app/dados/portal.db`); o novo, o do compose "hml" (ou o de produção, na virada).
2. Cópia consistente com o portal antigo no ar (ensaio em hml): o `VACUUM INTO` do SQLite
   faz o mesmo que o `sqlite3 .backup` — um arquivo só, com o que estava no `-wal`:

   ```bash
   docker exec <antigo> node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync('/app/dados/portal.db'); db.exec(\"VACUUM INTO '/tmp/portal-copia.db'\"); db.close()"
   docker cp <antigo>:/tmp/portal-copia.db /root/portal-copia.db
   docker exec <antigo> rm /tmp/portal-copia.db
   ```

   Na virada, com o portal antigo **parado** (`docker stop <antigo>`), copie os três arquivos
   juntos — `portal.db`, `portal.db-wal` e `portal.db-shm` — do volume `dados` do compose antigo
   (`docker volume ls | grep dados`):

   ```bash
   mkdir -p /root/migracao
   docker run --rm -v <volume>:/dados -v /root/migracao:/out alpine sh -c 'cp /dados/portal.db* /out/'
   ```

   e use `/root/migracao/portal.db` no lugar de `/root/portal-copia.db` (com os `-wal`/`-shm` ao lado).
3. Leve a cópia ao container novo e dê ao usuário `node` a posse:

   ```bash
   docker cp /root/portal-copia.db <novo>:/tmp/portal.db
   docker exec -u root <novo> chown node:node /tmp/portal.db
   ```

4. Simulação: `docker exec <novo> node_modules/.bin/tsx scripts/migrate-legacy.ts /tmp/portal.db --dry-run`.
   Confira as contagens, os avisos (protocolos com `-2`, convites órfãos, autores inexistentes,
   ações sem equivalente) e se há **conflitos**. Com conflito, nada é gravado.
5. De verdade: o mesmo comando sem `--dry-run`. Rode uma segunda vez: tudo deve vir como pulado
   ("imported 0").
6. No backoffice, aba Usuários, defina a senha de cada usuário migrado (eles chegam sem senha;
   o resumo antigo é incompatível). Confira a aba Respostas e a linha "migração do portal antigo"
   na Auditoria.
7. Apague as cópias: `docker exec -u root <novo> rm /tmp/portal.db` e `rm -rf /root/portal-copia.db /root/migracao`.

Localmente: `pnpm migrate:legacy <caminho> [--dry-run]` (o `node:sqlite` não pede flag a partir
do Node 22.13).
````

- [ ] **Step 6:** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`. Expected: tudo limpo e os seis cenários passando.
- [ ] **Step 7: Commit e merge**

```bash
git add playwright.config.ts tests/e2e package.json pnpm-lock.yaml .gitignore AGENTS.md
git commit -m "test(diagnostico): ponta a ponta do diagnóstico, do convite e do backoffice, e o passo a passo da migração no AGENTS"
git switch teste && git merge --no-ff test/ponta-a-ponta -m "merge: ponta a ponta e regras da etapa 1" && git branch -d test/ponta-a-ponta && git push origin teste
```

- [ ] **Step 8: Critério de pronto em hml** (manual, depois do deploy da `teste`): os dez itens do "Critério de pronto" da spec, um a um, em `hml-reforma.austercontabil.com.br` — inclusive a migração rodada duas vezes contra a cópia do `portal.db` de produção (Step 5 do `AGENTS.md`), com o resultado anotado no PR de virada.

---

## Cobertura da spec

| Spec | Tarefa |
|---|---|
| E1 porte fiel; saem WhatsApp e `?motor=1` | 7, 8, 9 (tabelas de porte), Global Constraints |
| E2 um rascunho, uma resposta, vale a última versão | 4 (`submitDiagnosis`), 14 |
| E3 PDF pela impressão, título `Plano-De-Acao-SN-<EMPRESA>` | 2 (`reportFileName`), 9 |
| E4 estado no navegador, salvo em 600 ms, servidor recalcula | 6, 4 |
| E5 backoffice e migração nesta etapa | 10–13 |
| E6 protocolo duplicado vira `-2`, `-3` | 13 |
| §1 rotas | 7, 9, 10 |
| §2 estrutura (front, back, `invitations`, `legacy-import`, QSA só no servidor) | 2–5, 13 |
| §3 cookie `draft_id`, criação no 1º salvamento com rate limit, retomar/começar de novo, `_` fora, envio com consentimento e validação, criar/atualizar, auditoria, provisório, vencido apagado, triagem | 4, 5, 6, 7, 8 |
| §3 schema | 1 |
| §4 telas (etapas, matriz U-01, CNPJ, privacidade, conferência, resultado, envio, relatório, salvamento) | 7, 8, 9 |
| §5 convite (pré-preenche, uma abertura por rascunho, liga a resposta, alfabeto) | 3, 4, 6, 11 |
| §6 backoffice (respostas, ficha, relatório, CSV, convites, usuários, auditoria) | 10, 11, 12 |
| §7 migração (comando, ordem, mapeamentos, idempotência, cópia consistente) | 13, 14 (`AGENTS.md`) |
| §8 testes (domínio 40 mil, aplicação com fakes, adaptadores, componentes, ponta a ponta) | 2, 3, 4, 6–14 |
| Critério de pronto | 14 (Step 8) |
