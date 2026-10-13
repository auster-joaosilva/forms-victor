# Redefinição de senha por e-mail — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar ao portal um fluxo de "esqueci a senha" por e-mail, com regra de senha mais curta (8 caracteres, letra+número+símbolo), e as ferramentas de administração (enviar link, cadastrar e-mail, scripts de migração) que o tornam usável com a base de usuários real.

**Architecture:** novo módulo de domínio dentro de `server/identity` (hexagonal, como os demais módulos do projeto): `domain` puro para as regras de senha/token/e-mail, `ports` para o que os casos de uso precisam do mundo, `application` para pedir e concluir a redefinição, `adapters` Prisma + `node:crypto` + a ponte para `server/mail`, `composition.ts` ligando tudo. O front chega só pelas `features/*/api`. Duas rotas públicas novas (`/forgot-password`, `/reset-password`) e extensões na aba Usuários do backoffice.

**Tech Stack:** TanStack Start (server functions), Prisma 7 + PostgreSQL, better-auth (só para hash de senha e sessão), Zod, Vitest, Nodemailer (via `server/mail` já existente).

**Spec:** `docs/superpowers/specs/2026-10-08-password-reset-design.md`

## Global Constraints

- Identificadores em inglês; texto de tela em português (AGENTS.md).
- `domain/` é TypeScript puro: sem `node:*`, `@prisma/*`, `@aws-sdk/*`, `better-auth*` (eslint já bloqueia).
- Front chega ao servidor só por `features/*/api` → `server/*/composition.ts` (fronteiras do `eslint.config.js`).
- `server/shared/auth/**` não pode importar de `server/*/domain/**` (regra de fronteira); por isso o piso de senha do better-auth fica como número local nesse arquivo, não importado de `identity`.
- Nenhuma senha, sufixo de senha ou token em log, commit ou resposta de erro. Só o hash SHA-256 do token fica gravado.
- `pnpm lint && pnpm typecheck && pnpm test` limpos antes de qualquer merge (AGENTS.md); `pnpm test:e2e` é opcional localmente.
- Commits pequenos, no padrão `<tipo>(<escopo>): <descrição>`, sem `Co-Authored-By` (regra do projeto, que prevalece sobre o lembrete de atribuição do ambiente).
- Nenhuma dependência nova no `package.json` para este plano: token usa `node:crypto`, e-mail usa o `mailSender` que já existe.

---

## Task 1: Regra de senha — 8 caracteres, com letra, número e símbolo

A regra de senha unificada. Hoje `auth.ts` e `user-rules.ts` duplicam `MINIMUM_PASSWORD = 12` (a fronteira do lint proíbe `server/shared/auth` de importar `server/identity/domain`, então a duplicação é proposital, com um teste que confere se os dois batem). Mantemos essa duplicação só para o **piso numérico** que vai para o better-auth; a regra completa (tamanho + composição) mora só em `user-rules.ts`.

**Files:**
- Modify: `src/server/identity/domain/user-rules.ts`
- Modify: `src/server/identity/domain/user.ts:32`
- Modify: `src/server/shared/auth/auth.ts:12`
- Modify: `src/server/identity/domain/user-rules.test.ts`
- Modify: `src/server/identity/application/manage-users.test.ts`
- Modify: `src/features/backoffice-users/components/password-dialog.tsx`
- Modify: `src/features/backoffice-users/components/password-dialog.test.tsx`
- Modify: `src/features/backoffice-users/components/own-password-button.test.tsx:34,39`

**Interfaces:**
- Produces: `MINIMUM_PASSWORD: number` (= 8), `meetsPasswordRule(password: string): boolean`, `assertPassword(password: string): void` — todas de `@/server/identity/domain/user-rules`. Tarefas futuras (reset) usam `meetsPasswordRule` para validar a senha nova.

- [ ] **Step 1: Escrever o teste da regra nova**

Em `src/server/identity/domain/user-rules.test.ts`, troque o bloco de import e acrescente um `describe` novo antes do `describe('user rules', ...)` existente:

```ts
import { MINIMUM_PASSWORD, USERNAME_RULE, assertKeepsAnAdmin, assertMayChange, assertPassword, meetsPasswordRule, normalizeUsername } from './user-rules'
```

```ts
describe('password rule', () => {
  it('needs 8 characters or more, with a letter, a digit and a symbol', () => {
    expect(meetsPasswordRule('Abc12345!')).toBe(true)
    expect(meetsPasswordRule('Abc1234!')).toBe(true)
    expect(meetsPasswordRule('abc1234!')).toBe(true)
    expect(meetsPasswordRule('Abc123!')).toBe(false)
    expect(meetsPasswordRule('Abcdefg!')).toBe(false)
    expect(meetsPasswordRule('Abcd1234')).toBe(false)
    expect(meetsPasswordRule('12345678')).toBe(false)
  })
  it('assertPassword throws weak_password for anything that fails the rule', () => {
    expect(() => assertPassword('abcdefgh')).toThrow('letra, número e símbolo')
    expect(() => assertPassword('Abc12345!')).not.toThrow()
  })
})
```

No teste `'matches the auth configuration'` já existente, mantenha a comparação de `MINIMUM_PASSWORD` como está (vai passar quando o Step 3 atualizar os dois arquivos para 8).

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/server/identity/domain/user-rules.test.ts`
Expected: FAIL — `meetsPasswordRule` não existe ainda.

- [ ] **Step 3: Implementar a regra**

Em `src/server/identity/domain/user-rules.ts`, troque:

```ts
export const MINIMUM_PASSWORD = 12
```

por:

```ts
export const MINIMUM_PASSWORD = 8
const HAS_LETTER = /[A-Za-z]/
const HAS_DIGIT = /[0-9]/
const HAS_SYMBOL = /[^A-Za-z0-9]/

export function meetsPasswordRule(password: string): boolean {
  return password.length >= MINIMUM_PASSWORD && HAS_LETTER.test(password) && HAS_DIGIT.test(password) && HAS_SYMBOL.test(password)
}
```

E troque:

```ts
export function assertPassword(password: string): void {
  if (password.length < MINIMUM_PASSWORD) throw new IdentityError('weak_password')
}
```

por:

```ts
export function assertPassword(password: string): void {
  if (!meetsPasswordRule(password)) throw new IdentityError('weak_password')
}
```

Em `src/server/identity/domain/user.ts:32`, troque:

```ts
  weak_password: 'a senha precisa de pelo menos 12 caracteres',
```

por:

```ts
  weak_password: 'a senha precisa de pelo menos 8 caracteres, com letra, número e símbolo',
```

Em `src/server/shared/auth/auth.ts:12`, troque:

```ts
export const MINIMUM_PASSWORD = 12
```

por:

```ts
// Só o piso de tamanho: o better-auth não confere composição. A regra completa mora em identity/domain/user-rules.ts;
// o teste "matches the auth configuration" ali confere que os dois números não divergem.
export const MINIMUM_PASSWORD = 8
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/server/identity/domain/user-rules.test.ts`
Expected: PASS

- [ ] **Step 5: Atualizar as senhas de teste que agora falhariam na regra de composição**

Em `src/server/identity/application/manage-users.test.ts`, `'x'.repeat(12)` é só letras, sem dígito nem símbolo: `createUser` chama `assertPassword` e passaria a rejeitar. Adicione no topo do arquivo, depois dos imports:

```ts
const STRONG_PASSWORD = 'Senha-123!'
```

E troque toda ocorrência de `'x'.repeat(12)` por `STRONG_PASSWORD` nesse arquivo (5 ocorrências, nas chamadas a `createUser`).

- [ ] **Step 6: Rodar os testes da aplicação de identidade**

Run: `pnpm vitest run src/server/identity`
Expected: PASS — inclusive `better-auth-user-accounts.int.test.ts` não muda: ele chama o adaptador direto, não `assertPassword`, e `'x'.repeat(12)` (12 caracteres) continua acima do piso de 8 que o better-auth confere.

- [ ] **Step 7: Atualizar o diálogo de senha do backoffice e seu teste**

Em `src/features/backoffice-users/components/password-dialog.tsx`, troque o import:

```tsx
import { MINIMUM_PASSWORD } from '@/server/identity/domain/user-rules'
```

por:

```tsx
import { MINIMUM_PASSWORD, meetsPasswordRule } from '@/server/identity/domain/user-rules'
```

Troque:

```tsx
    if (password.length < MINIMUM_PASSWORD) return setError('Curta demais.')
```

por:

```tsx
    if (!meetsPasswordRule(password)) return setError(`Precisa de ${MINIMUM_PASSWORD} caracteres ou mais, com letra, número e símbolo.`)
```

Troque o texto da descrição:

```tsx
        {`No mínimo ${MINIMUM_PASSWORD} caracteres. Comprimento é o que protege: não exigimos símbolo nem maiúscula, porque isso produz senha curta e anotada em papel.`}
```

por:

```tsx
        {`No mínimo ${MINIMUM_PASSWORD} caracteres, com letra, número e símbolo.`}
```

Em `src/features/backoffice-users/components/password-dialog.test.tsx`, troque:

```tsx
    expect(screen.getByText(/No mínimo 12 caracteres\. Comprimento é o que protege/)).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('Senha'), 'curta')
    await userEvent.type(screen.getByPlaceholderText('Repita a senha'), 'curta')
    await userEvent.click(screen.getByRole('button', { name: 'Definir' }))
    expect(screen.getByText('Curta demais.')).toBeInTheDocument()
    await userEvent.clear(screen.getByPlaceholderText('Senha'))
    await userEvent.type(screen.getByPlaceholderText('Senha'), 'senha-bem-longa-1')
    await userEvent.click(screen.getByRole('button', { name: 'Definir' }))
    expect(screen.getByText('As duas não conferem.')).toBeInTheDocument()
```

por:

```tsx
    expect(screen.getByText(/No mínimo 8 caracteres, com letra, número e símbolo\./)).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('Senha'), 'curta')
    await userEvent.type(screen.getByPlaceholderText('Repita a senha'), 'curta')
    await userEvent.click(screen.getByRole('button', { name: 'Definir' }))
    expect(screen.getByText('Precisa de 8 caracteres ou mais, com letra, número e símbolo.')).toBeInTheDocument()
    await userEvent.clear(screen.getByPlaceholderText('Senha'))
    await userEvent.type(screen.getByPlaceholderText('Senha'), 'senha-bem-longa-1')
    await userEvent.click(screen.getByRole('button', { name: 'Definir' }))
    expect(screen.getByText('As duas não conferem.')).toBeInTheDocument()
```

(`'senha-bem-longa-1'` já tem letra, dígito e símbolo — continua válida.)

Em `src/features/backoffice-users/components/own-password-button.test.tsx:34,39`, troque:

```ts
    changeOwnPasswordFn.mockResolvedValue({ ok: false, message: 'a senha precisa de pelo menos 12 caracteres' })
```

e

```ts
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Trocar minha senha: a senha precisa de pelo menos 12 caracteres'))
```

por:

```ts
    changeOwnPasswordFn.mockResolvedValue({ ok: false, message: 'a senha precisa de pelo menos 8 caracteres, com letra, número e símbolo' })
```

e

```ts
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Trocar minha senha: a senha precisa de pelo menos 8 caracteres, com letra, número e símbolo'))
```

- [ ] **Step 8: Rodar todos os testes de componente afetados**

Run: `pnpm test:dom`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/server/identity src/server/shared/auth/auth.ts src/features/backoffice-users/components/password-dialog.tsx src/features/backoffice-users/components/password-dialog.test.tsx src/features/backoffice-users/components/own-password-button.test.tsx
git commit -m "fix(auth): senha de 8 caracteres com letra, número e símbolo"
```

---

## Task 2: Domínio do reset — validade do token, e-mail e primeiro nome

Regras puras, sem banco nem rede: quando um token vale, se um e-mail é de verdade (não `@users.invalid`), e como derivar o primeiro nome e o e-mail padrão a partir do usuário.

**Files:**
- Create: `src/server/identity/domain/reset-token.ts`
- Create: `src/server/identity/domain/reset-token.test.ts`
- Create: `src/server/identity/domain/contact.ts`
- Create: `src/server/identity/domain/contact.test.ts`

**Interfaces:**
- Produces: `RESET_TOKEN_TTL_MS: number`, `BATCH_RESET_TOKEN_TTL_MS: number`, `tokenExpiry(now: Date, ttlMs?: number): Date`, `isUsableToken(token: { expiresAt: Date; usedAt: Date | null }, now: Date): boolean` de `./reset-token`.
- Produces: `isDeliverableEmail(email: string | null | undefined): email is string`, `deriveFirstName(username: string): string`, `deriveEmail(username: string, overrides?: Record<string, string>): string` de `./contact`.

- [ ] **Step 1: Escrever os testes de `reset-token`**

Create `src/server/identity/domain/reset-token.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { BATCH_RESET_TOKEN_TTL_MS, RESET_TOKEN_TTL_MS, isUsableToken, tokenExpiry } from './reset-token'

describe('reset token validity', () => {
  it('expires one hour after the request, by default', () => {
    const now = new Date('2026-10-12T12:00:00Z')
    expect(tokenExpiry(now)).toEqual(new Date('2026-10-12T13:00:00Z'))
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000)
  })

  it('accepts a longer TTL for the admin batch send', () => {
    const now = new Date('2026-10-12T12:00:00Z')
    expect(tokenExpiry(now, BATCH_RESET_TOKEN_TTL_MS)).toEqual(new Date('2026-10-14T12:00:00Z'))
    expect(BATCH_RESET_TOKEN_TTL_MS).toBe(48 * 60 * 60 * 1000)
  })

  it('is usable only before it expires and before it is used', () => {
    const now = new Date('2026-10-12T12:00:00Z')
    expect(isUsableToken({ expiresAt: new Date('2026-10-12T12:00:01Z'), usedAt: null }, now)).toBe(true)
    expect(isUsableToken({ expiresAt: new Date('2026-10-12T11:59:59Z'), usedAt: null }, now)).toBe(false)
    expect(isUsableToken({ expiresAt: new Date('2026-10-12T13:00:00Z'), usedAt: new Date('2026-10-12T11:00:00Z') }, now)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/server/identity/domain/reset-token.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Create `src/server/identity/domain/reset-token.ts`:

```ts
// 1h para o pedido do próprio usuário (R5); 48h para o link que o admin manda em lote, porque dar tempo de abrir
// importa mais que encurtar a janela quando quem está enviando já é de confiança.
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000
export const BATCH_RESET_TOKEN_TTL_MS = 48 * 60 * 60 * 1000

export function tokenExpiry(now: Date, ttlMs: number = RESET_TOKEN_TTL_MS): Date {
  return new Date(now.getTime() + ttlMs)
}

export function isUsableToken(token: { expiresAt: Date; usedAt: Date | null }, now: Date): boolean {
  return token.usedAt === null && token.expiresAt.getTime() > now.getTime()
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/server/identity/domain/reset-token.test.ts`
Expected: PASS

- [ ] **Step 5: Escrever os testes de `contact`**

Create `src/server/identity/domain/contact.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { deriveEmail, deriveFirstName, isDeliverableEmail } from './contact'

describe('isDeliverableEmail', () => {
  it('rejects the placeholder domain from the migration and anything empty', () => {
    expect(isDeliverableEmail('victor.medeiros@users.invalid')).toBe(false)
    expect(isDeliverableEmail(null)).toBe(false)
    expect(isDeliverableEmail(undefined)).toBe(false)
    expect(isDeliverableEmail('')).toBe(false)
  })
  it('accepts a real address', () => {
    expect(isDeliverableEmail('victor@austercontabil.com.br')).toBe(true)
  })
})

describe('deriveFirstName', () => {
  it('takes the part before the first separator and capitalizes it', () => {
    expect(deriveFirstName('victor.medeiros')).toBe('Victor')
    expect(deriveFirstName('ana-paula.silva')).toBe('Ana')
    expect(deriveFirstName('fabiola..souza')).toBe('Fabiola')
    expect(deriveFirstName('joao_pedro')).toBe('Joao')
    expect(deriveFirstName('sara')).toBe('Sara')
  })
})

describe('deriveEmail', () => {
  it('uses the username as the local part of the company domain', () => {
    expect(deriveEmail('sara.vinhais')).toBe('sara.vinhais@austercontabil.com.br')
  })
  it('honors an override for a username that does not follow the pattern', () => {
    expect(deriveEmail('victor.medeiros', { 'victor.medeiros': 'victor@austercontabil.com.br' })).toBe('victor@austercontabil.com.br')
    expect(deriveEmail('sara.vinhais', { 'victor.medeiros': 'victor@austercontabil.com.br' })).toBe('sara.vinhais@austercontabil.com.br')
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `pnpm vitest run src/server/identity/domain/contact.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 7: Implementar**

Create `src/server/identity/domain/contact.ts`:

```ts
const FAKE_EMAIL_DOMAIN = '@users.invalid'
const COMPANY_EMAIL_DOMAIN = '@austercontabil.com.br'
const NAME_SEPARATOR = /[.\-_]/

// A virada criou todo usuário com "usuario@users.invalid": isso não é e-mail de verdade, é "sem e-mail".
export function isDeliverableEmail(email: string | null | undefined): email is string {
  return !!email && !email.toLowerCase().endsWith(FAKE_EMAIL_DOMAIN)
}

export function deriveFirstName(username: string): string {
  const token = username.split(NAME_SEPARATOR).find((part) => part.length > 0) ?? username
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
}

// Padrão: usuario@austercontabil.com.br. Exceção conhecida: victor.medeiros usa só "victor" (seu e-mail de sempre).
export function deriveEmail(username: string, overrides: Record<string, string> = {}): string {
  return overrides[username] ?? `${username}${COMPANY_EMAIL_DOMAIN}`
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `pnpm vitest run src/server/identity/domain/contact.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/server/identity/domain/reset-token.ts src/server/identity/domain/reset-token.test.ts src/server/identity/domain/contact.ts src/server/identity/domain/contact.test.ts
git commit -m "feat(auth): regras de validade do token de redefinição e de e-mail do usuário"
```

---

## Task 3: Ações de auditoria novas

**Files:**
- Modify: `src/server/audit/domain/audit-entry.ts`
- Modify: `src/server/audit/domain/audit-entry.test.ts`

**Interfaces:**
- Produces: `AUDIT_ACTIONS` e `AUDIT_ACTION_LABELS` passam a incluir `'password_reset_requested' | 'password_reset_completed' | 'password_reset_links_sent' | 'user_email_changed' | 'passwords_set_in_batch'`.

- [ ] **Step 1: Escrever o teste**

Em `src/server/audit/domain/audit-entry.test.ts`, acrescente ao `describe('audit actions', ...)`:

```ts
  it('knows the password reset actions', () => {
    expect(AUDIT_ACTIONS).toContain('password_reset_requested')
    expect(AUDIT_ACTIONS).toContain('password_reset_completed')
    expect(AUDIT_ACTIONS).toContain('password_reset_links_sent')
    expect(AUDIT_ACTIONS).toContain('user_email_changed')
    expect(AUDIT_ACTIONS).toContain('passwords_set_in_batch')
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/server/audit/domain/audit-entry.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

Em `src/server/audit/domain/audit-entry.ts`, troque o array `AUDIT_ACTIONS` acrescentando uma linha antes do `] as const`:

```ts
export const AUDIT_ACTIONS = [
  'access_denied', 'login', 'user_created', 'user_updated', 'admin_bootstrapped',
  'invitation_created', 'invitation_deleted', 'response_received', 'response_updated', 'response_handled',
  'adhesion_received', 'adhesion_handled', 'event_created', 'event_updated', 'event_slug_changed',
  'registration_received', 'registration_handled', 'file_stored', 'spreadsheet_exported', 'legacy_imported',
  'test_data_reset', 'password_reset_requested', 'password_reset_completed', 'password_reset_links_sent',
  'user_email_changed', 'passwords_set_in_batch',
] as const
```

E acrescente ao `AUDIT_ACTION_LABELS`, depois de `test_data_reset: 'dados de teste apagados',`:

```ts
  password_reset_requested: 'pedido de redefinição de senha',
  password_reset_completed: 'senha redefinida por email',
  password_reset_links_sent: 'links de redefinição enviados',
  user_email_changed: 'email do usuário alterado',
  passwords_set_in_batch: 'senhas definidas em lote',
```

(Sem hífen em "email": o teste `'labels every action in Portuguese'` confere `/^[a-zà-ú ]+$/`, que não aceita hífen.)

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/server/audit/domain/audit-entry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/audit/domain/audit-entry.ts src/server/audit/domain/audit-entry.test.ts
git commit -m "feat(auditoria): ações do reset de senha e da troca de e-mail"
```

---

## Task 4: Tabela `PasswordResetToken` e migração

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_password_reset_tokens/migration.sql` (gerada pelo comando, não escrita à mão)
- Modify: `tests/integration/db.ts`

**Interfaces:**
- Produces: `prisma.passwordResetToken` no cliente gerado, com `id, userId, tokenHash, expiresAt, usedAt, createdAt`.

- [ ] **Step 1: Acrescentar o modelo ao schema**

Em `prisma/schema.prisma`, no `model User`, depois da linha `auditEntries AuditLog[]`, acrescente:

```prisma
  passwordResetTokens PasswordResetToken[]
```

Depois do `model AuditLog { ... }` (antes de `model RateLimitHit`), acrescente:

```prisma
model PasswordResetToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at") @db.Timestamptz
  usedAt    DateTime? @map("used_at") @db.Timestamptz
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz

  @@index([userId])
  @@map("password_reset_tokens")
}
```

- [ ] **Step 2: Gerar e aplicar a migração**

Run: `pnpm exec prisma migrate dev --name password_reset_tokens`
Expected: "Your database is now in sync with your schema." e o arquivo `prisma/migrations/<timestamp>_password_reset_tokens/migration.sql` criado com `CREATE TABLE "password_reset_tokens"` e o índice. Isso também regenera `src/server/shared/prisma/generated`.

- [ ] **Step 3: Incluir a tabela na limpeza dos testes de integração**

Em `tests/integration/db.ts`, no array `tables`, acrescente `'password_reset_tokens'` (qualquer posição antes de `'users'`, já que o `TRUNCATE … CASCADE` resolve a ordem):

```ts
const tables = [
  'registrations', 'event_sessions', 'events', 'adhesions', 'responses', 'diagnosis_drafts',
  'invitations', 'stored_files', 'rate_limit_hits', 'auth_rate_limits', 'verifications',
  'password_reset_tokens', 'sessions', 'accounts', 'users',
]
```

- [ ] **Step 4: Conferir que nada mais mudou sem querer**

Run: `pnpm db:migrate`
Expected: "Your database is now in sync with your schema" e nenhuma migração nova proposta. Se o diretório gerado do Prisma tiver mais diferença que a tabela nova, pare — há algo não migrado que não é desta tarefa.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/integration/db.ts src/server/shared/prisma/generated
git commit -m "feat(auth): tabela de tokens de redefinição de senha"
```

---

## Task 5: Portas do reset

Interfaces que os casos de uso vão precisar: repositório de tokens, gerador de token, "mailer" do reset, relógio e limitador de taxa. Seguem exatamente o estilo das portas de `adhesion` e `diagnosis` já existentes no projeto.

**Files:**
- Create: `src/server/identity/ports/password-reset-tokens.ts`
- Create: `src/server/identity/ports/token-generator.ts`
- Create: `src/server/identity/ports/reset-mailer.ts`
- Create: `src/server/identity/ports/clock.ts`
- Create: `src/server/identity/ports/rate-limiter.ts`

**Interfaces:**
- Produces: `PasswordResetTokens`, `NewPasswordResetToken`, `StoredPasswordResetToken`, `TokenGenerator`, `ResetMailer`, `Clock`, `RateLimiter`, `RateLimitedRoute`, `RateLimitDecision` — todas usadas pelas Tarefas 6 e 7.

- [ ] **Step 1: Criar as portas**

Create `src/server/identity/ports/password-reset-tokens.ts`:

```ts
export interface NewPasswordResetToken {
  userId: string
  tokenHash: string
  expiresAt: Date
}

export interface StoredPasswordResetToken {
  id: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
}

export interface PasswordResetTokens {
  // Grava o novo e invalida qualquer token anterior do mesmo usuário, numa única operação (R5).
  issue(token: NewPasswordResetToken): Promise<void>
  findByHash(tokenHash: string): Promise<StoredPasswordResetToken | null>
  markUsed(id: string, at: Date): Promise<void>
}
```

Create `src/server/identity/ports/token-generator.ts`:

```ts
export interface TokenGenerator {
  // O token em si (para o link) e o hash que vai para o banco nunca saem juntos de um caso de uso para fora.
  next(): { token: string; tokenHash: string }
}
```

Create `src/server/identity/ports/reset-mailer.ts`:

```ts
export interface ResetMailer {
  sendResetLink(to: string, resetUrl: string): Promise<void>
}
```

Create `src/server/identity/ports/clock.ts`:

```ts
export interface Clock {
  now(): Date
}
```

Create `src/server/identity/ports/rate-limiter.ts`:

```ts
export type RateLimitedRoute = 'password-reset-request'
export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number }

export interface RateLimiter {
  check(route: RateLimitedRoute, origin: string | null): Promise<RateLimitDecision>
}
```

Não há passo de teste aqui: são só tipos, sem comportamento. A Tarefa 6 os exercita.

- [ ] **Step 2: Conferir que compila**

Run: `pnpm typecheck`
Expected: PASS (os arquivos novos não são usados ainda, mas são válidos).

- [ ] **Step 3: Commit**

```bash
git add src/server/identity/ports/password-reset-tokens.ts src/server/identity/ports/token-generator.ts src/server/identity/ports/reset-mailer.ts src/server/identity/ports/clock.ts src/server/identity/ports/rate-limiter.ts
git commit -m "feat(auth): portas do reset de senha"
```

---

## Task 6: Caso de uso — pedir redefinição

A pedra angular de R4: a resposta é idêntica exista ou não o usuário, esteja ele ativo ou não, tenha ou não e-mail de verdade. O e-mail só é disparado depois, fora do caminho que gera a resposta.

**Files:**
- Create: `src/server/identity/application/request-password-reset.ts`
- Create: `src/server/identity/application/request-password-reset.test.ts`

**Interfaces:**
- Consumes: `UserAccounts` (de `../ports/user-accounts`, já existente — ver Tarefa 8 para a extensão com `email`), `PasswordResetTokens`, `TokenGenerator`, `ResetMailer`, `Clock`, `RateLimiter` (Tarefa 5), `isDeliverableEmail` e `tokenExpiry`/`RESET_TOKEN_TTL_MS` (Tarefa 2).
- Produces: `makeRequestPasswordReset(deps): (input: { username: string; origin: string | null; baseUrl: string }) => Promise<RequestPasswordResetResult>`, `RequestPasswordResetResult = { ok: true } | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }`. Usado pela Tarefa 9 (`composition.ts`) e pela Tarefa 10 (server function pública).

- [ ] **Step 1: Escrever o teste com fakes**

Create `src/server/identity/application/request-password-reset.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { UserAccount } from '../domain/user'
import type { UserAccounts } from '../ports/user-accounts'
import type { PasswordResetTokens, StoredPasswordResetToken } from '../ports/password-reset-tokens'
import { makeRequestPasswordReset } from './request-password-reset'

const victor: UserAccount = {
  id: 'u1', username: 'victor.medeiros', name: 'Victor', role: 'admin', active: true,
  lastLoginAt: null, createdAt: new Date(0), email: 'victor@austercontabil.com.br',
}
const semEmail: UserAccount = { ...victor, id: 'u2', username: 'sara.vinhais', email: 'sara.vinhais@users.invalid' }
const desativado: UserAccount = { ...victor, id: 'u3', username: 'ex.funcionario', active: false }

function setup(users: UserAccount[], baseUrl = 'https://reforma-tributaria.austercontabil.com.br') {
  const accounts: UserAccounts = {
    list: async () => users,
    findByUsername: async (username) => users.find((u) => u.username === username) ?? null,
    countActiveAdmins: async () => users.filter((u) => u.role === 'admin' && u.active).length,
    create: async () => { throw new Error('não usado') },
    rename: async () => {},
    setRole: async () => {},
    setActive: async () => {},
    setPassword: async () => {},
    setEmail: async () => {},
  }
  const issued: StoredPasswordResetToken[] = []
  const tokens: PasswordResetTokens = {
    issue: async (input) => void issued.push({ id: `t${issued.length}`, userId: input.userId, expiresAt: input.expiresAt, usedAt: null }),
    findByHash: async () => null,
    markUsed: async () => {},
  }
  const sent: { to: string; resetUrl: string }[] = []
  const mailer = { sendResetLink: async (to: string, resetUrl: string) => void sent.push({ to, resetUrl }) }
  const audit: unknown[] = []
  const requestPasswordReset = makeRequestPasswordReset({
    accounts,
    tokens,
    tokenGenerator: { next: () => ({ token: 'plain-token', tokenHash: 'hashed-token' }) },
    mailer,
    clock: { now: () => new Date('2026-10-12T12:00:00Z') },
    rateLimiter: { check: async () => ({ allowed: true }) },
    recordAudit: async (entry) => void audit.push(entry),
    baseUrl,
  })
  return { requestPasswordReset, issued, sent, audit }
}

describe('request password reset', () => {
  it('issues a token and sends the email for a user with a real email', async () => {
    const { requestPasswordReset, issued, sent, audit } = setup([victor])
    const result = await requestPasswordReset({ username: 'victor.medeiros', origin: '203.0.113.9' })
    expect(result).toEqual({ ok: true })
    expect(issued).toEqual([{ id: 't0', userId: 'u1', expiresAt: new Date('2026-10-12T13:00:00Z'), usedAt: null }])
    expect(sent).toEqual([{ to: 'victor@austercontabil.com.br', resetUrl: 'https://reforma-tributaria.austercontabil.com.br/reset-password?token=plain-token' }])
    expect(audit).toEqual([{ action: 'password_reset_requested', actorUsername: 'victor.medeiros', reference: 'u1' }])
  })

  it('answers the same for a user without a real email, but sends nothing', async () => {
    const { requestPasswordReset, issued, sent } = setup([semEmail], 'https://x')
    const result = await requestPasswordReset({ username: 'sara.vinhais', origin: null })
    expect(result).toEqual({ ok: true })
    expect(issued).toEqual([])
    expect(sent).toEqual([])
  })

  it('answers the same for a deactivated account, but sends nothing', async () => {
    const { requestPasswordReset, sent } = setup([desativado], 'https://x')
    expect(await requestPasswordReset({ username: 'ex.funcionario', origin: null })).toEqual({ ok: true })
    expect(sent).toEqual([])
  })

  it('answers the same for a username that does not exist, but sends nothing', async () => {
    const { requestPasswordReset, sent } = setup([], 'https://x')
    expect(await requestPasswordReset({ username: 'ninguem', origin: null })).toEqual({ ok: true })
    expect(sent).toEqual([])
  })

  it('rate-limits by origin before touching the database', async () => {
    const users: UserAccount[] = [victor]
    const accounts: UserAccounts = {
      list: async () => users, findByUsername: async (u) => users.find((x) => x.username === u) ?? null,
      countActiveAdmins: async () => 1, create: async () => { throw new Error('não usado') },
      rename: async () => {}, setRole: async () => {}, setActive: async () => {}, setPassword: async () => {}, setEmail: async () => {},
    }
    const issue = vi.fn()
    const requestPasswordReset = makeRequestPasswordReset({
      accounts,
      tokens: { issue, findByHash: async () => null, markUsed: async () => {} },
      tokenGenerator: { next: () => ({ token: 'a', tokenHash: 'b' }) },
      mailer: { sendResetLink: async () => {} },
      clock: { now: () => new Date('2026-10-12T12:00:00Z') },
      rateLimiter: { check: async () => ({ allowed: false, retryAfterSeconds: 42 }) },
      recordAudit: async () => {},
      baseUrl: 'https://x',
    })
    const result = await requestPasswordReset({ username: 'victor.medeiros', origin: '203.0.113.9' })
    expect(result).toEqual({ ok: false, reason: 'rate_limited', retryAfterSeconds: 42 })
    expect(issue).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/server/identity/application/request-password-reset.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Create `src/server/identity/application/request-password-reset.ts`:

```ts
import { isDeliverableEmail } from '../domain/contact'
import { tokenExpiry } from '../domain/reset-token'
import type { Clock } from '../ports/clock'
import type { PasswordResetTokens } from '../ports/password-reset-tokens'
import type { RateLimiter } from '../ports/rate-limiter'
import type { ResetMailer } from '../ports/reset-mailer'
import type { TokenGenerator } from '../ports/token-generator'
import type { UserAccounts } from '../ports/user-accounts'

export type RequestPasswordResetResult = { ok: true } | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }

type AuditRecorder = (entry: { action: 'password_reset_requested'; actorUsername: string; reference: string }) => Promise<void>

export function makeRequestPasswordReset(deps: {
  accounts: UserAccounts
  tokens: PasswordResetTokens
  tokenGenerator: TokenGenerator
  mailer: ResetMailer
  clock: Clock
  rateLimiter: RateLimiter
  recordAudit: AuditRecorder
  baseUrl: string
}) {
  return async function requestPasswordReset({ username, origin }: { username: string; origin: string | null }): Promise<RequestPasswordResetResult> {
    const decision = await deps.rateLimiter.check('password-reset-request', origin)
    if (!decision.allowed) return { ok: false, reason: 'rate_limited', retryAfterSeconds: decision.retryAfterSeconds }

    // A resposta é a mesma a partir daqui, exista ou não o usuário (R4): ninguém descobre quem tem conta pelo tempo de resposta.
    const user = await deps.accounts.findByUsername(username.trim().toLowerCase())
    if (user && user.active && isDeliverableEmail(user.email)) {
      const now = deps.clock.now()
      const { token, tokenHash } = deps.tokenGenerator.next()
      await deps.tokens.issue({ userId: user.id, tokenHash, expiresAt: tokenExpiry(now) })
      await deps.mailer.sendResetLink(user.email, `${deps.baseUrl}/reset-password?token=${token}`)
      await deps.recordAudit({ action: 'password_reset_requested', actorUsername: user.username, reference: user.id })
    }
    return { ok: true }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/server/identity/application/request-password-reset.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/identity/application/request-password-reset.ts src/server/identity/application/request-password-reset.test.ts
git commit -m "feat(auth): caso de uso para pedir redefinição de senha"
```

---

## Task 7: Caso de uso — concluir redefinição

**Files:**
- Create: `src/server/identity/application/complete-password-reset.ts`
- Create: `src/server/identity/application/complete-password-reset.test.ts`

**Interfaces:**
- Consumes: `UserAccounts.setPassword`, `PasswordResetTokens`, `Clock`, `assertPassword` (Tarefa 1), `isUsableToken` (Tarefa 2).
- Produces: `makeCompletePasswordReset(deps): (input: { token: string; password: string }) => Promise<CompletePasswordResetResult>`, `CompletePasswordResetResult = { ok: true } | { ok: false; reason: 'invalid_token' | 'weak_password' }`.

- [ ] **Step 1: Escrever o teste**

Create `src/server/identity/application/complete-password-reset.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { StoredPasswordResetToken, PasswordResetTokens } from '../ports/password-reset-tokens'
import { makeCompletePasswordReset } from './complete-password-reset'

const HASH_OF = (token: string) => `hash(${token})`

function setup({ stored, usedAt = null }: { stored: Omit<StoredPasswordResetToken, 'usedAt'> | null; usedAt?: Date | null }) {
  const marked: { id: string; at: Date }[] = []
  const setPassword: { id: string; password: string }[] = []
  const endedSessionsFor: string[] = []
  const tokens: PasswordResetTokens = {
    issue: async () => {},
    findByHash: async (hash) => (stored && hash === HASH_OF('plain-token') ? { ...stored, usedAt } : null),
    markUsed: async (id, at) => void marked.push({ id, at }),
  }
  const completePasswordReset = makeCompletePasswordReset({
    tokens,
    accounts: { setPassword: async (id, password) => void setPassword.push({ id, password }) },
    sessions: { endAllFor: async (userId) => void endedSessionsFor.push(userId) },
    tokenHasher: { hash: HASH_OF },
    clock: { now: () => new Date('2026-10-12T12:00:00Z') },
    recordAudit: async () => {},
  })
  return { completePasswordReset, marked, setPassword, endedSessionsFor }
}

describe('complete password reset', () => {
  it('sets the new password, marks the token used and ends every session', async () => {
    const { completePasswordReset, marked, setPassword, endedSessionsFor } = setup({
      stored: { id: 't1', userId: 'u1', expiresAt: new Date('2026-10-12T13:00:00Z') },
    })
    const result = await completePasswordReset({ token: 'plain-token', password: 'Abc12345!' })
    expect(result).toEqual({ ok: true })
    expect(setPassword).toEqual([{ id: 'u1', password: 'Abc12345!' }])
    expect(marked).toEqual([{ id: 't1', at: new Date('2026-10-12T12:00:00Z') }])
    expect(endedSessionsFor).toEqual(['u1'])
  })

  it('refuses an unknown token', async () => {
    const { completePasswordReset, setPassword } = setup({ stored: null })
    expect(await completePasswordReset({ token: 'plain-token', password: 'Abc12345!' })).toEqual({ ok: false, reason: 'invalid_token' })
    expect(setPassword).toEqual([])
  })

  it('refuses an expired token', async () => {
    const { completePasswordReset } = setup({ stored: { id: 't1', userId: 'u1', expiresAt: new Date('2026-10-12T11:59:59Z') } })
    expect(await completePasswordReset({ token: 'plain-token', password: 'Abc12345!' })).toEqual({ ok: false, reason: 'invalid_token' })
  })

  it('refuses a token already used', async () => {
    const { completePasswordReset } = setup({ stored: { id: 't1', userId: 'u1', expiresAt: new Date('2026-10-12T13:00:00Z') }, usedAt: new Date('2026-10-12T11:00:00Z') })
    expect(await completePasswordReset({ token: 'plain-token', password: 'Abc12345!' })).toEqual({ ok: false, reason: 'invalid_token' })
  })

  it('refuses a weak password without consuming the token', async () => {
    const { completePasswordReset, marked } = setup({ stored: { id: 't1', userId: 'u1', expiresAt: new Date('2026-10-12T13:00:00Z') } })
    expect(await completePasswordReset({ token: 'plain-token', password: 'abcdefgh' })).toEqual({ ok: false, reason: 'weak_password' })
    expect(marked).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/server/identity/application/complete-password-reset.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

Create `src/server/identity/application/complete-password-reset.ts`:

```ts
import { meetsPasswordRule } from '../domain/user-rules'
import { isUsableToken } from '../domain/reset-token'
import type { Clock } from '../ports/clock'
import type { PasswordResetTokens } from '../ports/password-reset-tokens'

export type CompletePasswordResetResult = { ok: true } | { ok: false; reason: 'invalid_token' | 'weak_password' }

export interface TokenHasher {
  hash(token: string): string
}

type AccountPasswordSetter = { setPassword(userId: string, password: string): Promise<void> }
type SessionEnder = { endAllFor(userId: string): Promise<void> }
type AuditRecorder = (entry: { action: 'password_reset_completed'; actorUsername: null; reference: string }) => Promise<void>

export function makeCompletePasswordReset(deps: {
  tokens: PasswordResetTokens
  accounts: AccountPasswordSetter
  sessions: SessionEnder
  tokenHasher: TokenHasher
  clock: Clock
  recordAudit: AuditRecorder
}) {
  return async function completePasswordReset({ token, password }: { token: string; password: string }): Promise<CompletePasswordResetResult> {
    const stored = await deps.tokens.findByHash(deps.tokenHasher.hash(token))
    const now = deps.clock.now()
    if (!stored || !isUsableToken(stored, now)) return { ok: false, reason: 'invalid_token' }
    if (!meetsPasswordRule(password)) return { ok: false, reason: 'weak_password' }

    await deps.accounts.setPassword(stored.userId, password)
    await deps.tokens.markUsed(stored.id, now)
    await deps.sessions.endAllFor(stored.userId)
    await deps.recordAudit({ action: 'password_reset_completed', actorUsername: null, reference: stored.userId })
    return { ok: true }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/server/identity/application/complete-password-reset.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/identity/application/complete-password-reset.ts src/server/identity/application/complete-password-reset.test.ts
git commit -m "feat(auth): caso de uso para concluir a redefinição de senha"
```

---

## Task 8: E-mail do usuário no domínio e no port, e `UserAccounts.setEmail`

Estende o que já existe (`UserAccount`, `UserAccounts`, `betterAuthUserAccounts`) com a coluna `email`, que passa a ser **usada** (hoje só existe no schema, sempre com o valor falso `@users.invalid`).

**Files:**
- Modify: `src/server/identity/domain/user.ts`
- Modify: `src/server/identity/ports/user-accounts.ts`
- Modify: `src/server/identity/adapters/better-auth-user-accounts.ts`
- Modify: `src/server/identity/adapters/better-auth-user-accounts.int.test.ts`
- Modify: `src/server/identity/application/manage-users.test.ts` (fake precisa do novo campo/método)
- Create: `src/server/identity/application/set-user-email.ts`
- Create: `src/server/identity/application/set-user-email.test.ts`

**Interfaces:**
- Produces: `UserAccount.email: string` (sempre presente); `UserAccounts.setEmail(id: string, email: string): Promise<void>`; `IdentityErrorReason` ganha `'invalid_email' | 'email_taken'`; `makeSetUserEmail(deps): (actor, username, email) => Promise<void>` (lança `IdentityError`).

- [ ] **Step 1: Estender o domínio de erro e o tipo da conta**

Em `src/server/identity/domain/user.ts`, troque:

```ts
export interface UserAccount {
  id: string
  username: string
  name: string
  role: Role
  active: boolean
  lastLoginAt: Date | null
  createdAt: Date
}
```

por:

```ts
export interface UserAccount {
  id: string
  username: string
  name: string
  role: Role
  active: boolean
  lastLoginAt: Date | null
  createdAt: Date
  email: string
}
```

Troque:

```ts
export type IdentityErrorReason = 'invalid_username' | 'weak_password' | 'username_taken' | 'not_found' | 'forbidden' | 'last_admin'

const MESSAGES: Record<IdentityErrorReason, string> = {
  invalid_username: 'usuário deve ter de 3 a 32 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado, começando por letra',
  weak_password: 'a senha precisa de pelo menos 8 caracteres, com letra, número e símbolo',
  username_taken: 'já existe um usuário com esse nome',
  not_found: 'usuário não encontrado',
  forbidden: 'só administrador',
  last_admin: 'não dá para desativar ou rebaixar o único administrador ativo; promova outro antes',
}
```

por:

```ts
export type IdentityErrorReason =
  | 'invalid_username' | 'weak_password' | 'username_taken' | 'not_found' | 'forbidden' | 'last_admin'
  | 'invalid_email' | 'email_taken'

const MESSAGES: Record<IdentityErrorReason, string> = {
  invalid_username: 'usuário deve ter de 3 a 32 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado, começando por letra',
  weak_password: 'a senha precisa de pelo menos 8 caracteres, com letra, número e símbolo',
  username_taken: 'já existe um usuário com esse nome',
  not_found: 'usuário não encontrado',
  forbidden: 'só administrador',
  last_admin: 'não dá para desativar ou rebaixar o único administrador ativo; promova outro antes',
  invalid_email: 'e-mail inválido',
  email_taken: 'já existe um usuário com esse e-mail',
}
```

- [ ] **Step 2: Estender o port**

Em `src/server/identity/ports/user-accounts.ts`, acrescente ao final da interface:

```ts
  setEmail(id: string, email: string): Promise<void>
```

- [ ] **Step 3: Atualizar o adaptador do better-auth**

Em `src/server/identity/adapters/better-auth-user-accounts.ts`, troque:

```ts
type Row = { id: string; username: string | null; name: string; role: string; banned: boolean; lastLoginAt: Date | null; createdAt: Date }

const toAccount = (row: Row): UserAccount => ({
  id: row.id,
  username: row.username ?? '',
  name: row.name,
  role: toRole(row.role),
  active: !row.banned,
  lastLoginAt: row.lastLoginAt,
  createdAt: row.createdAt,
})
```

por:

```ts
type Row = { id: string; username: string | null; name: string; role: string; banned: boolean; lastLoginAt: Date | null; createdAt: Date; email: string }

const toAccount = (row: Row): UserAccount => ({
  id: row.id,
  username: row.username ?? '',
  name: row.name,
  role: toRole(row.role),
  active: !row.banned,
  lastLoginAt: row.lastLoginAt,
  createdAt: row.createdAt,
  email: row.email,
})
```

Troque:

```ts
const select = { id: true, username: true, name: true, role: true, banned: true, lastLoginAt: true, createdAt: true } as const
```

por:

```ts
const select = { id: true, username: true, name: true, role: true, banned: true, lastLoginAt: true, createdAt: true, email: true } as const
```

Troque `isDuplicate` para reconhecer também duplicidade de e-mail (ela já cobre `USER_ALREADY_EXISTS`, que o better-auth usa tanto para usuário quanto para e-mail — mas `setEmail` grava direto via Prisma, então precisamos do `P2002` específico da coluna):

Acrescente, depois de `isDuplicate`:

```ts
const isDuplicateEmail = (error: unknown): boolean => {
  const e = error as { code?: unknown; meta?: { target?: unknown } } | null
  return e?.code === 'P2002' && Array.isArray(e.meta?.target) && e.meta.target.includes('email')
}
```

E acrescente ao objeto `betterAuthUserAccounts`, depois de `setPassword`:

```ts
  async setEmail(id, email) {
    try {
      await prisma.user.update({ where: { id }, data: { email } })
    } catch (error) {
      if (isDuplicateEmail(error)) throw new IdentityError('email_taken')
      throw error
    }
  },
```

- [ ] **Step 4: Atualizar o teste de integração do adaptador**

Em `src/server/identity/adapters/better-auth-user-accounts.int.test.ts`, acrescente ao final do arquivo:

```ts
describe('betterAuthUserAccounts.setEmail', () => {
  beforeEach(resetDatabase)

  it('sets a real email', async () => {
    await betterAuthUserAccounts.create(input)
    const user = await betterAuthUserAccounts.findByUsername('bia')
    await betterAuthUserAccounts.setEmail(user!.id, 'bia@austercontabil.com.br')
    expect((await betterAuthUserAccounts.findByUsername('bia'))?.email).toBe('bia@austercontabil.com.br')
  })

  it('refuses an email already used by another account', async () => {
    await betterAuthUserAccounts.create(input)
    await betterAuthUserAccounts.create({ ...input, username: 'caio' })
    const bia = await betterAuthUserAccounts.findByUsername('bia')
    await betterAuthUserAccounts.setEmail(bia!.id, 'bia@austercontabil.com.br')
    const caio = await betterAuthUserAccounts.findByUsername('caio')
    await expect(betterAuthUserAccounts.setEmail(caio!.id, 'bia@austercontabil.com.br')).rejects.toMatchObject({ reason: 'email_taken' })
  })
})
```

- [ ] **Step 5: Rodar os testes de integração de identidade**

Run: `pnpm test:int -- src/server/identity`
Expected: PASS (precisa do `pnpm db:up` de pé).

- [ ] **Step 6: Ajustar o fake usado por `manage-users.test.ts`**

Em `src/server/identity/application/manage-users.test.ts`, a função `fakeAccounts` cria objetos `UserAccount` sem `email`; com o campo obrigatório, isso quebra o `typecheck`. Troque:

```ts
function fakeAccounts(seed: UserAccount[]) {
  const users = new Map(seed.map((u) => [u.username, { ...u }]))
  const byId = (id: string) => [...users.values()].find((u) => u.id === id) as UserAccount
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
```

por:

```ts
function fakeAccounts(seed: UserAccount[]) {
  const users = new Map(seed.map((u) => [u.username, { ...u }]))
  const byId = (id: string) => [...users.values()].find((u) => u.id === id) as UserAccount
  const accounts: UserAccounts = {
    list: async () => [...users.values()],
    findByUsername: async (username) => users.get(username) ?? null,
    countActiveAdmins: async () => [...users.values()].filter((u) => u.role === 'admin' && u.active).length,
    create: async ({ username, name, role }) => {
      const user: UserAccount = { id: username, username, name, role, active: true, lastLoginAt: null, createdAt: new Date(0), email: `${username}@users.invalid` }
      users.set(username, user)
      return user
    },
    rename: async (id, name) => void (byId(id).name = name),
    setRole: async (id, role) => void (byId(id).role = role),
    setActive: async (id, active) => void (byId(id).active = active),
    setPassword: async () => {},
    setEmail: async (id, email) => void (byId(id).email = email),
  }
  return { users, accounts }
}

const ana: UserAccount = { id: 'ana', username: 'ana', name: 'Ana', role: 'admin', active: true, lastLoginAt: null, createdAt: new Date(0), email: 'ana@users.invalid' }
```

- [ ] **Step 7: Rodar os testes de aplicação de identidade**

Run: `pnpm vitest run src/server/identity/application`
Expected: PASS

- [ ] **Step 8: Escrever o teste do caso de uso `setUserEmail`**

Create `src/server/identity/application/set-user-email.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { IdentityError } from '../domain/user'
import { makeSetUserEmail } from './set-user-email'

function setup() {
  const emails = new Map<string, string>([['u1', 'bia@users.invalid']])
  const accounts = {
    findByUsername: async (username: string) => (username === 'bia' ? { id: 'u1' } : null),
    setEmail: async (id: string, email: string) => void emails.set(id, email),
  }
  const audit: unknown[] = []
  const setUserEmail = makeSetUserEmail({ accounts, recordAudit: async (entry) => void audit.push(entry) })
  return { setUserEmail, emails, audit }
}

const admin = { id: 'a', username: 'ana', role: 'admin' as const }
const operator = { id: 'o', username: 'caio', role: 'operator' as const }

describe('set user email', () => {
  it('sets a valid email and audits it', async () => {
    const { setUserEmail, emails, audit } = setup()
    await setUserEmail(admin, 'bia', 'bia@austercontabil.com.br')
    expect(emails.get('u1')).toBe('bia@austercontabil.com.br')
    expect(audit).toEqual([{ action: 'user_email_changed', actorId: 'a', actorUsername: 'ana', reference: 'bia', detail: { email: 'bia@austercontabil.com.br' } }])
  })

  it('refuses a malformed email', async () => {
    const { setUserEmail } = setup()
    await expect(setUserEmail(admin, 'bia', 'não é email')).rejects.toBeInstanceOf(IdentityError)
  })

  it('refuses a user that does not exist', async () => {
    const { setUserEmail } = setup()
    await expect(setUserEmail(admin, 'ninguem', 'x@austercontabil.com.br')).rejects.toMatchObject({ reason: 'not_found' })
  })

  it('only admins change email', async () => {
    const { setUserEmail } = setup()
    await expect(setUserEmail(operator, 'bia', 'bia@austercontabil.com.br')).rejects.toMatchObject({ reason: 'forbidden' })
  })
})
```

- [ ] **Step 9: Rodar e ver falhar**

Run: `pnpm vitest run src/server/identity/application/set-user-email.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 10: Implementar**

Create `src/server/identity/application/set-user-email.ts`:

```ts
import { IdentityError, type Actor } from '../domain/user'

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type AccountEmailPort = { findByUsername(username: string): Promise<{ id: string } | null>; setEmail(id: string, email: string): Promise<void> }
type AuditRecorder = (entry: { action: 'user_email_changed'; actorId: string; actorUsername: string; reference: string; detail: { email: string } }) => Promise<void>

export function makeSetUserEmail(deps: { accounts: AccountEmailPort; recordAudit: AuditRecorder }) {
  return async function setUserEmail(actor: Actor, username: string, email: string): Promise<void> {
    if (actor.role !== 'admin') throw new IdentityError('forbidden')
    const cleaned = email.trim().toLowerCase()
    if (!EMAIL_RULE.test(cleaned)) throw new IdentityError('invalid_email')
    const target = await deps.accounts.findByUsername(username.trim().toLowerCase())
    if (!target) throw new IdentityError('not_found')
    await deps.accounts.setEmail(target.id, cleaned)
    await deps.recordAudit({ action: 'user_email_changed', actorId: actor.id, actorUsername: actor.username, reference: username, detail: { email: cleaned } })
  }
}
```

- [ ] **Step 11: Rodar e ver passar**

Run: `pnpm vitest run src/server/identity/application/set-user-email.test.ts`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add src/server/identity
git commit -m "feat(auth): e-mail do usuário como dado próprio, com caso de uso para alterá-lo"
```

---

## Task 9: Adaptadores — repositório de tokens, gerador e ponte de e-mail

**Files:**
- Create: `src/server/identity/adapters/prisma-password-reset-tokens.ts`
- Create: `src/server/identity/adapters/prisma-password-reset-tokens.int.test.ts`
- Create: `src/server/identity/adapters/random-token-generator.ts`
- Create: `src/server/identity/adapters/random-token-generator.test.ts`
- Create: `src/server/identity/adapters/mail-reset-mailer.ts`
- Create: `src/server/identity/adapters/system-clock.ts`
- Create: `src/server/identity/adapters/prisma-session-ender.ts`

**Interfaces:**
- Produces: `prismaPasswordResetTokens: PasswordResetTokens`, `createRandomTokenGenerator(): TokenGenerator`, `resetMailerOf(sender: { send(message: { to: string; subject: string; text: string; html?: string }): Promise<void> }): ResetMailer`, `systemClock: Clock`, `prismaSessionEnder: { endAllFor(userId: string): Promise<void> }`.

- [ ] **Step 1: Escrever o teste do gerador de token**

Create `src/server/identity/adapters/random-token-generator.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createRandomTokenGenerator } from './random-token-generator'

describe('random token generator', () => {
  it('makes a 64-hex token with its own sha-256 hash, and never repeats', () => {
    const generator = createRandomTokenGenerator()
    const seen = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const { token, tokenHash } = generator.next()
      expect(token).toMatch(/^[0-9a-f]{64}$/)
      expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
      expect(tokenHash).not.toBe(token)
      expect(seen.has(token)).toBe(false)
      seen.add(token)
    }
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/server/identity/adapters/random-token-generator.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar o gerador**

Create `src/server/identity/adapters/random-token-generator.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto'
import type { TokenGenerator } from '../ports/token-generator'

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

// O e-mail carrega o token puro; o banco guarda só o hash (R5). Vazar o banco não basta para redefinir a senha de ninguém.
export const createRandomTokenGenerator = (): TokenGenerator => ({
  next: () => {
    const token = randomBytes(32).toString('hex')
    return { token, tokenHash: sha256(token) }
  },
})

export const hashToken = sha256
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/server/identity/adapters/random-token-generator.test.ts`
Expected: PASS

- [ ] **Step 5: Escrever o teste de integração do repositório de tokens**

Create `src/server/identity/adapters/prisma-password-reset-tokens.int.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import { prismaPasswordResetTokens } from './prisma-password-reset-tokens'

async function createUser(username: string) {
  return prisma.user.create({ data: { id: username, name: username, email: `${username}@users.invalid`, username } })
}

describe('prisma password reset tokens', () => {
  beforeEach(resetDatabase)

  it('issues a token and finds it by hash', async () => {
    const user = await createUser('bia')
    await prismaPasswordResetTokens.issue({ userId: user.id, tokenHash: 'hash-1', expiresAt: new Date('2026-10-12T13:00:00Z') })
    const stored = await prismaPasswordResetTokens.findByHash('hash-1')
    expect(stored).toMatchObject({ userId: user.id, usedAt: null })
    expect(stored?.expiresAt).toEqual(new Date('2026-10-12T13:00:00Z'))
  })

  it('invalidates the previous token of the same user when a new one is issued', async () => {
    const user = await createUser('bia')
    await prismaPasswordResetTokens.issue({ userId: user.id, tokenHash: 'hash-1', expiresAt: new Date('2026-10-12T13:00:00Z') })
    await prismaPasswordResetTokens.issue({ userId: user.id, tokenHash: 'hash-2', expiresAt: new Date('2026-10-12T14:00:00Z') })
    expect(await prismaPasswordResetTokens.findByHash('hash-1')).toBeNull()
    expect(await prismaPasswordResetTokens.findByHash('hash-2')).toMatchObject({ userId: user.id })
  })

  it('marks a token used', async () => {
    const user = await createUser('bia')
    await prismaPasswordResetTokens.issue({ userId: user.id, tokenHash: 'hash-1', expiresAt: new Date('2026-10-12T13:00:00Z') })
    const stored = await prismaPasswordResetTokens.findByHash('hash-1')
    await prismaPasswordResetTokens.markUsed(stored!.id, new Date('2026-10-12T12:30:00Z'))
    expect((await prismaPasswordResetTokens.findByHash('hash-1'))?.usedAt).toEqual(new Date('2026-10-12T12:30:00Z'))
  })

  it('cascades when the user is deleted', async () => {
    const user = await createUser('bia')
    await prismaPasswordResetTokens.issue({ userId: user.id, tokenHash: 'hash-1', expiresAt: new Date('2026-10-12T13:00:00Z') })
    await prisma.user.delete({ where: { id: user.id } })
    expect(await prisma.passwordResetToken.count()).toBe(0)
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `pnpm test:int -- src/server/identity/adapters/prisma-password-reset-tokens.int.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 7: Implementar o repositório**

Create `src/server/identity/adapters/prisma-password-reset-tokens.ts`:

```ts
import { prisma } from '@/server/shared/prisma/client'
import type { PasswordResetTokens } from '../ports/password-reset-tokens'

export const prismaPasswordResetTokens: PasswordResetTokens = {
  async issue({ userId, tokenHash, expiresAt }) {
    // Invalida o anterior e grava o novo numa única transação: nunca ficam dois tokens válidos do mesmo usuário (R5).
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } }),
    ])
  },
  async findByHash(tokenHash) {
    const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })
    return row ? { id: row.id, userId: row.userId, expiresAt: row.expiresAt, usedAt: row.usedAt } : null
  },
  async markUsed(id, at) {
    await prisma.passwordResetToken.update({ where: { id }, data: { usedAt: at } })
  },
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `pnpm test:int -- src/server/identity/adapters/prisma-password-reset-tokens.int.test.ts`
Expected: PASS

- [ ] **Step 9: Criar o relógio, o encerrador de sessões e a ponte de e-mail**

Create `src/server/identity/adapters/system-clock.ts`:

```ts
import type { Clock } from '../ports/clock'

export const systemClock: Clock = { now: () => new Date() }
```

Create `src/server/identity/adapters/prisma-session-ender.ts`:

```ts
import { prisma } from '@/server/shared/prisma/client'

export const prismaSessionEnder = {
  async endAllFor(userId: string): Promise<void> {
    await prisma.session.deleteMany({ where: { userId } })
  },
}
```

Create `src/server/identity/adapters/mail-reset-mailer.ts`:

```ts
import type { ResetMailer } from '../ports/reset-mailer'

// Tipado aqui, sem importar de server/mail: um adapter só importa porta do próprio módulo (fronteira do eslint).
// `mailSender`, de server/mail/composition, satisfaz essa forma estruturalmente — quem o entrega é o composition.ts.
interface SendableMail {
  send(message: { to: string; subject: string; text: string; html?: string }): Promise<void>
}

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const resetMailerOf = (sender: SendableMail): ResetMailer => ({
  async sendResetLink(to, resetUrl) {
    await sender.send({
      to,
      subject: 'Redefinição de senha — Auster',
      text: `Alguém pediu para redefinir a senha da sua conta no portal da Auster. Se foi você, abra o link abaixo nas próximas horas:\n\n${resetUrl}\n\nSe você não pediu isso, não precisa fazer nada: essa caixa não recebe resposta.`,
      html: `<p>Alguém pediu para redefinir a senha da sua conta no portal da Auster. Se foi você, abra o link abaixo nas próximas horas:</p><p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p><p>Se você não pediu isso, não precisa fazer nada: essa caixa não recebe resposta.</p>`,
    })
  },
})
```

Não há teste dedicado para esses três arquivos (são encaixes triviais de uma linha cada, no mesmo padrão de `system-clock.ts` já existente no projeto, que também não tem teste próprio). A Tarefa 11 confere o fluxo completo.

- [ ] **Step 10: Rodar o typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/server/identity/adapters
git commit -m "feat(auth): adaptadores do reset — tokens, gerador, relógio, sessões e e-mail"
```

---

## Task 10: `composition.ts` do reset e extensão do `manage-users`

Liga tudo: os casos de uso ganham os adaptadores de verdade, e a troca de e-mail/as capacidades passam a existir no módulo público do identity.

**Files:**
- Modify: `src/server/identity/composition.ts`

**Interfaces:**
- Produces: `requestPasswordReset`, `completePasswordReset`, `setUserEmail` exportados de `@/server/identity/composition`, prontos para uso pelas `features/*/api`.

- [ ] **Step 1: Escrever a composição**

Em `src/server/identity/composition.ts`, troque o arquivo inteiro por:

```ts
import { recordAudit } from '@/server/audit/composition'
import { mailSender } from '@/server/mail/composition'
import { checkRateLimit } from '@/server/rate-limit/composition'
import { getEnv } from '@/server/shared/env'
import { betterAuthUserAccounts } from './adapters/better-auth-user-accounts'
import { resetMailerOf } from './adapters/mail-reset-mailer'
import { prismaPasswordResetTokens } from './adapters/prisma-password-reset-tokens'
import { prismaSessionEnder } from './adapters/prisma-session-ender'
import { createRandomTokenGenerator, hashToken } from './adapters/random-token-generator'
import { systemClock } from './adapters/system-clock'
import { makeCompletePasswordReset } from './application/complete-password-reset'
import { makeManageUsers } from './application/manage-users'
import { makeRequestPasswordReset } from './application/request-password-reset'
import { makeSetUserEmail } from './application/set-user-email'
import type { RateLimiter } from './ports/rate-limiter'

const manageUsers = makeManageUsers({ accounts: betterAuthUserAccounts, recordAudit })

export const listUsers = manageUsers.listUsers
export const createUser = manageUsers.createUser
export const updateUser = manageUsers.updateUser
export { IdentityError } from './domain/user'
export type { Actor, Role, UserAccount, UserChanges } from './domain/user'

const rateLimiter: RateLimiter = { check: (route, origin) => checkRateLimit({ route, origin }) }

export const requestPasswordReset = makeRequestPasswordReset({
  accounts: betterAuthUserAccounts,
  tokens: prismaPasswordResetTokens,
  tokenGenerator: createRandomTokenGenerator(),
  mailer: resetMailerOf(mailSender),
  clock: systemClock,
  rateLimiter,
  recordAudit,
  baseUrl: getEnv().APP_PUBLIC_URL,
})

export const completePasswordReset = makeCompletePasswordReset({
  tokens: prismaPasswordResetTokens,
  accounts: betterAuthUserAccounts,
  sessions: prismaSessionEnder,
  tokenHasher: { hash: hashToken },
  clock: systemClock,
  recordAudit,
})

export const setUserEmail = makeSetUserEmail({ accounts: betterAuthUserAccounts, recordAudit })

export type { RequestPasswordResetResult } from './application/request-password-reset'
export type { CompletePasswordResetResult } from './application/complete-password-reset'
```

A `baseUrl` vem do ambiente só aqui, na composição: a server function pública (Tarefa 11) não precisa saber de `getEnv`, e isso evita que `features/auth/api` — que só pode importar `server-http` e `composition.ts` de qualquer módulo, não `server-shared` em geral — tenha de importar `@/server/shared/env` diretamente (o lint de fronteiras recusaria).

- [ ] **Step 2: Rodar o typecheck e o lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS — nenhuma violação de fronteira: `identity/composition.ts` só importa de `domain`, `application`, `ports`, `adapters` do próprio módulo, `server-shared` (onde mora `getEnv`), mais `composition.ts` de `audit`, `mail` e `rate-limit` (permitido pela regra de `composition`).

- [ ] **Step 3: Commit**

```bash
git add src/server/identity/composition.ts
git commit -m "feat(auth): liga o reset de senha aos adaptadores reais"
```

---

## Task 11: Rotas e telas públicas — `/forgot-password` e `/reset-password`

**Files:**
- Create: `src/features/auth/api/password-reset.ts`
- Create: `src/features/auth/components/forgot-password-form.tsx`
- Create: `src/features/auth/components/forgot-password-form.test.tsx`
- Create: `src/features/auth/components/reset-password-form.tsx`
- Create: `src/features/auth/components/reset-password-form.test.tsx`
- Create: `src/app/routes/forgot-password.tsx`
- Create: `src/app/routes/reset-password.tsx`
- Modify: `src/features/auth/components/login-form.tsx`

**Interfaces:**
- Produces: `requestPasswordResetFn`, `completePasswordResetFn` (server functions de `features/auth/api/password-reset`); rotas `/forgot-password` e `/reset-password`.

- [ ] **Step 1: Server functions públicas**

Create `src/features/auth/api/password-reset.ts`:

```ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requestClientIp } from '@/server/shared/http/draft-cookie'
import { completePasswordReset, requestPasswordReset } from '@/server/identity/composition'

export const requestPasswordResetFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ username: z.string().max(64) }))
  .handler(({ data }) => requestPasswordReset({ username: data.username, origin: requestClientIp() }))

export const completePasswordResetFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ token: z.string().min(1).max(256), password: z.string().max(128) }))
  .handler(({ data }) => completePasswordReset(data))
```

- [ ] **Step 2: Teste do formulário "esqueci a senha"**

Create `src/features/auth/components/forgot-password-form.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const { requestPasswordResetFn } = vi.hoisted(() => ({ requestPasswordResetFn: vi.fn() }))
vi.mock('../api/password-reset', () => ({ requestPasswordResetFn }))

const { ForgotPasswordForm } = await import('./forgot-password-form')

describe('ForgotPasswordForm', () => {
  it('shows the same message whatever the server answers', async () => {
    requestPasswordResetFn.mockResolvedValue({ ok: true })
    render(<ForgotPasswordForm />)
    await userEvent.type(screen.getByLabelText('Usuário'), 'victor.medeiros')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }))
    await waitFor(() => expect(requestPasswordResetFn).toHaveBeenCalledWith({ data: { username: 'victor.medeiros' } }))
    expect(await screen.findByText(/Se o usuário existir e tiver e-mail cadastrado/)).toBeInTheDocument()
  })

  it('shows the rate limit message when the server says so', async () => {
    requestPasswordResetFn.mockResolvedValue({ ok: false, reason: 'rate_limited', retryAfterSeconds: 42 })
    render(<ForgotPasswordForm />)
    await userEvent.type(screen.getByLabelText('Usuário'), 'victor.medeiros')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }))
    expect(await screen.findByText('Muitas tentativas. Espere um minuto e tente de novo.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm vitest run src/features/auth/components/forgot-password-form.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 4: Implementar o formulário**

Create `src/features/auth/components/forgot-password-form.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { Link, useHydrated } from '@tanstack/react-router'
import { AusterMark } from '@/components/brand/auster-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestPasswordResetFn } from '../api/password-reset'

const SAME_MESSAGE = 'Se o usuário existir e tiver e-mail cadastrado, mandamos o link de redefinição para ele agora.'

export function ForgotPasswordForm() {
  const hydrated = useHydrated()
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const username = String(new FormData(event.currentTarget).get('username') ?? '').trim().toLowerCase()
    setPending(true)
    const result = await requestPasswordResetFn({ data: { username } })
    setPending(false)
    setMessage(result.ok ? SAME_MESSAGE : 'Muitas tentativas. Espere um minuto e tente de novo.')
  }

  return (
    <form method="post" onSubmit={submit} className="w-full max-w-[400px] rounded-xl border border-[#e3e9ee] bg-white px-8 py-[34px] shadow-[0_1px_3px_rgba(5,44,71,.08)]">
      <AusterMark caption="auster · uso interno" />
      <h1 className="mb-1.5 text-[21px] font-normal text-auster-dark">Esqueci a senha</h1>
      <p className="mb-[22px] text-[13px] leading-relaxed text-auster-gray">Informe o seu usuário. Se existir e tiver e-mail cadastrado, enviamos o link de redefinição.</p>
      {message ? <p className="mb-[18px] text-[13px] text-auster-dark">{message}</p> : null}
      <Label htmlFor="username" className="mb-1.5 block text-xs font-normal uppercase tracking-[.9px] text-auster-gray">Usuário</Label>
      <Input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus className="mb-4 h-auto px-3.5 py-3" />
      <Button type="submit" disabled={pending || !hydrated} className="mb-3 h-auto w-full py-[13px] font-medium hover:bg-[#0a3d60]">
        {pending ? 'Enviando…' : 'Enviar link de redefinição'}
      </Button>
      <Link to="/login" className="text-[13px] text-auster-gray underline">Voltar para o login</Link>
    </form>
  )
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm vitest run src/features/auth/components/forgot-password-form.test.tsx`
Expected: PASS

- [ ] **Step 6: Teste do formulário de nova senha**

Create `src/features/auth/components/reset-password-form.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const { completePasswordResetFn, navigate } = vi.hoisted(() => ({ completePasswordResetFn: vi.fn(), navigate: vi.fn() }))
vi.mock('../api/password-reset', () => ({ completePasswordResetFn }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
}))

const { ResetPasswordForm } = await import('./reset-password-form')

const fillAndSubmit = async (password: string) => {
  await userEvent.type(screen.getByPlaceholderText('Nova senha'), password)
  await userEvent.type(screen.getByPlaceholderText('Repita a nova senha'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Definir nova senha' }))
}

describe('ResetPasswordForm', () => {
  it('sets the new password and redirects to login', async () => {
    completePasswordResetFn.mockResolvedValue({ ok: true })
    render(<ResetPasswordForm token="abc123" />)
    await fillAndSubmit('Abc12345!')
    await waitFor(() => expect(completePasswordResetFn).toHaveBeenCalledWith({ data: { token: 'abc123', password: 'Abc12345!' } }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/login' }))
  })

  it('refuses mismatched passwords without calling the server', async () => {
    render(<ResetPasswordForm token="abc123" />)
    await fillAndSubmit('Abc12345!')
    await userEvent.clear(screen.getByPlaceholderText('Repita a nova senha'))
    await userEvent.type(screen.getByPlaceholderText('Repita a nova senha'), 'Outra123!')
    await userEvent.click(screen.getByRole('button', { name: 'Definir nova senha' }))
    expect(screen.getByText('As duas não conferem.')).toBeInTheDocument()
    expect(completePasswordResetFn).not.toHaveBeenCalled()
  })

  it('shows the same message for an invalid or expired token', async () => {
    completePasswordResetFn.mockResolvedValue({ ok: false, reason: 'invalid_token' })
    render(<ResetPasswordForm token="vencido" />)
    await fillAndSubmit('Abc12345!')
    expect(await screen.findByText(/Esse link não vale mais/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `pnpm vitest run src/features/auth/components/reset-password-form.test.tsx`
Expected: FAIL

- [ ] **Step 8: Implementar**

Create `src/features/auth/components/reset-password-form.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { useHydrated, useNavigate } from '@tanstack/react-router'
import { AusterMark } from '@/components/brand/auster-mark'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { completePasswordResetFn } from '../api/password-reset'

const INVALID_TOKEN_MESSAGE = 'Esse link não vale mais (já foi usado, ou passou da validade). Peça um novo em "Esqueci a senha".'
const WEAK_PASSWORD_MESSAGE = 'Precisa de 8 caracteres ou mais, com letra, número e símbolo.'

export function ResetPasswordForm({ token }: { token: string }) {
  const navigate = useNavigate()
  const hydrated = useHydrated()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    const repeated = String(form.get('repeated') ?? '')
    setError(null)
    if (password !== repeated) return setError('As duas não conferem.')
    setPending(true)
    const result = await completePasswordResetFn({ data: { token, password } })
    setPending(false)
    if (!result.ok) return setError(result.reason === 'weak_password' ? WEAK_PASSWORD_MESSAGE : INVALID_TOKEN_MESSAGE)
    await navigate({ to: '/login' })
  }

  return (
    <form method="post" onSubmit={submit} className="w-full max-w-[400px] rounded-xl border border-[#e3e9ee] bg-white px-8 py-[34px] shadow-[0_1px_3px_rgba(5,44,71,.08)]">
      <AusterMark caption="auster · uso interno" />
      <h1 className="mb-1.5 text-[21px] font-normal text-auster-dark">Nova senha</h1>
      {error ? (
        <Alert variant="destructive" className="mb-[18px] border-[#f0c4c4] bg-[#fdf0f0] text-[#8d2226]">
          <AlertDescription className="text-[13px]">{error}</AlertDescription>
        </Alert>
      ) : null}
      <input type="password" name="password" placeholder="Nova senha" autoComplete="new-password" required className="mb-3 w-full rounded-md border border-[#e3e9ee] px-3.5 py-3 text-[14px]" />
      <input type="password" name="repeated" placeholder="Repita a nova senha" autoComplete="new-password" required className="mb-4 w-full rounded-md border border-[#e3e9ee] px-3.5 py-3 text-[14px]" />
      <Button type="submit" disabled={pending || !hydrated} className="h-auto w-full py-[13px] font-medium hover:bg-[#0a3d60]">
        {pending ? 'Salvando…' : 'Definir nova senha'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 9: Rodar e ver passar**

Run: `pnpm vitest run src/features/auth/components/reset-password-form.test.tsx`
Expected: PASS

- [ ] **Step 10: Rotas**

Create `src/app/routes/forgot-password.tsx`:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentUser } from '@/features/auth/api/session'
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form'

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: async () => {
    if (await getCurrentUser()) throw redirect({ to: '/backoffice' })
  },
  head: () => ({ meta: [{ title: 'Esqueci a senha — Conferência do Diagnóstico' }] }),
  component: () => (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7f9] p-6">
      <ForgotPasswordForm />
    </main>
  ),
})
```

Create `src/app/routes/reset-password.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form'

export const Route = createFileRoute('/reset-password')({
  validateSearch: z.object({ token: z.string().min(1).max(256).optional() }),
  head: () => ({ meta: [{ title: 'Nova senha — Conferência do Diagnóstico' }] }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7f9] p-6">
      {token ? <ResetPasswordForm token={token} /> : <p className="text-[14px] text-auster-gray">Link incompleto: falta o token na URL.</p>}
    </main>
  )
}
```

- [ ] **Step 11: Link na tela de login**

Em `src/features/auth/components/login-form.tsx`, troque:

```tsx
      <Button type="submit" disabled={pending || !hydrated} className="h-auto w-full py-[13px] font-medium hover:bg-[#0a3d60]">
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
```

por:

```tsx
      <Button type="submit" disabled={pending || !hydrated} className="mb-3 h-auto w-full py-[13px] font-medium hover:bg-[#0a3d60]">
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
      <Link to="/forgot-password" className="text-[13px] text-auster-gray underline">Esqueci a senha</Link>
    </form>
  )
}
```

E acrescente ao import do topo:

```tsx
import { Link, useHydrated, useNavigate } from '@tanstack/react-router'
```

(trocando a linha de import existente `import { useHydrated, useNavigate } from '@tanstack/react-router'`).

- [ ] **Step 12: Gerar a árvore de rotas e rodar os testes de componente**

Run: `pnpm build && pnpm test:dom`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add src/features/auth src/app/routes/forgot-password.tsx src/app/routes/reset-password.tsx src/app/routeTree.gen.ts
git commit -m "feat(auth): telas públicas de esqueci a senha e nova senha"
```

---

## Task 12: Backoffice — e-mail do usuário, enviar link, enviar para todos

**Files:**
- Create: `src/server/identity/application/send-reset-links.ts`
- Create: `src/server/identity/application/send-reset-links.test.ts`
- Modify: `src/server/identity/composition.ts`
- Modify: `src/features/backoffice-users/api/users.ts`
- Modify: `src/features/backoffice-users/components/users-view.tsx`
- Modify: `src/features/backoffice-users/components/users-view.test.tsx`
- Modify: `src/features/backoffice-users/components/users-panel.tsx`
- Modify: `src/features/backoffice-users/components/users-panel.test.tsx`

**Interfaces:**
- Produces: `makeSendResetLinks(deps): (actor, input: { usernames: string[] } | { all: true }) => Promise<{ sent: number }>`; server functions `setUserEmailFn`, `sendResetLinkFn`, `sendResetLinksToAllFn` em `features/backoffice-users/api/users.ts`.

- [ ] **Step 1: Teste do caso de uso `sendResetLinks`**

Create `src/server/identity/application/send-reset-links.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { UserAccount } from '../domain/user'
import { makeSendResetLinks } from './send-reset-links'

const comEmail: UserAccount = { id: 'u1', username: 'bia', name: 'Bia', role: 'operator', active: true, lastLoginAt: null, createdAt: new Date(0), email: 'bia@austercontabil.com.br' }
const semEmail: UserAccount = { ...comEmail, id: 'u2', username: 'caio', email: 'caio@users.invalid' }
const desativado: UserAccount = { ...comEmail, id: 'u3', username: 'ex', active: false }

function setup(users: UserAccount[]) {
  const issued: { userId: string; expiresAt: Date }[] = []
  const sent: { to: string; resetUrl: string }[] = []
  const audit: unknown[] = []
  const sendResetLinks = makeSendResetLinks({
    accounts: { list: async () => users, findByUsername: async (u) => users.find((x) => x.username === u) ?? null },
    tokens: { issue: async (t) => void issued.push({ userId: t.userId, expiresAt: t.expiresAt }) },
    tokenGenerator: { next: () => ({ token: 'plain', tokenHash: 'hashed' }) },
    mailer: { sendResetLink: async (to, resetUrl) => void sent.push({ to, resetUrl }) },
    clock: { now: () => new Date('2026-10-12T12:00:00Z') },
    recordAudit: async (entry) => void audit.push(entry),
    baseUrl: 'https://reforma-tributaria.austercontabil.com.br',
  })
  return { sendResetLinks, issued, sent, audit }
}

const admin = { id: 'a', username: 'ana', role: 'admin' as const }

describe('send reset links', () => {
  it('sends to every active user with a real email, skipping the rest, with a 48h token', async () => {
    const { sendResetLinks, issued, sent, audit } = setup([comEmail, semEmail, desativado])
    const result = await sendResetLinks(admin, { all: true })
    expect(result).toEqual({ sent: 1 })
    expect(issued).toEqual([{ userId: 'u1', expiresAt: new Date('2026-10-14T12:00:00Z') }])
    expect(sent).toEqual([{ to: 'bia@austercontabil.com.br', resetUrl: 'https://reforma-tributaria.austercontabil.com.br/reset-password?token=plain' }])
    expect(audit).toEqual([{ action: 'password_reset_links_sent', actorId: 'a', actorUsername: 'ana', reference: '1', detail: { count: 1 } }])
  })

  it('sends to one chosen user by username', async () => {
    const { sendResetLinks, sent } = setup([comEmail])
    expect(await sendResetLinks(admin, { usernames: ['bia'] })).toEqual({ sent: 1 })
    expect(sent).toHaveLength(1)
  })

  it('does nothing for a username without a real email', async () => {
    const { sendResetLinks, sent } = setup([semEmail])
    expect(await sendResetLinks(admin, { usernames: ['caio'] })).toEqual({ sent: 0 })
    expect(sent).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/server/identity/application/send-reset-links.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

Create `src/server/identity/application/send-reset-links.ts`:

```ts
import { isDeliverableEmail } from '../domain/contact'
import { BATCH_RESET_TOKEN_TTL_MS, tokenExpiry } from '../domain/reset-token'
import type { UserAccount } from '../domain/user'
import type { Clock } from '../ports/clock'
import type { TokenGenerator } from '../ports/token-generator'
import type { ResetMailer } from '../ports/reset-mailer'

type AuditRecorder = (entry: { action: 'password_reset_links_sent'; actorId: string; actorUsername: string; reference: string; detail: { count: number } }) => Promise<void>

export function makeSendResetLinks(deps: {
  accounts: { list(): Promise<UserAccount[]>; findByUsername(username: string): Promise<UserAccount | null> }
  tokens: { issue(token: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> }
  tokenGenerator: TokenGenerator
  mailer: ResetMailer
  clock: Clock
  recordAudit: AuditRecorder
  baseUrl: string
}) {
  return async function sendResetLinks(actor: { id: string; username: string }, input: { usernames: string[] } | { all: true }): Promise<{ sent: number }> {
    const candidates =
      'all' in input
        ? await deps.accounts.list()
        : (await Promise.all(input.usernames.map((u) => deps.accounts.findByUsername(u)))).filter((u): u is UserAccount => u !== null)

    let sent = 0
    const now = deps.clock.now()
    for (const user of candidates) {
      if (!user.active || !isDeliverableEmail(user.email)) continue
      const { token, tokenHash } = deps.tokenGenerator.next()
      await deps.tokens.issue({ userId: user.id, tokenHash, expiresAt: tokenExpiry(now, BATCH_RESET_TOKEN_TTL_MS) })
      await deps.mailer.sendResetLink(user.email, `${deps.baseUrl}/reset-password?token=${token}`)
      sent++
    }
    await deps.recordAudit({ action: 'password_reset_links_sent', actorId: actor.id, actorUsername: actor.username, reference: String(sent), detail: { count: sent } })
    return { sent }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/server/identity/application/send-reset-links.test.ts`
Expected: PASS

- [ ] **Step 5: Ligar no `composition.ts`**

Em `src/server/identity/composition.ts`, acrescente ao import de `./application/send-reset-links` e à exportação:

```ts
import { makeSendResetLinks } from './application/send-reset-links'
```

```ts
export const sendResetLinks = makeSendResetLinks({
  accounts: betterAuthUserAccounts,
  tokens: prismaPasswordResetTokens,
  tokenGenerator: createRandomTokenGenerator(),
  mailer: resetMailerOf(mailSender),
  clock: systemClock,
  recordAudit,
  baseUrl: getEnv().APP_PUBLIC_URL,
})
```

(`getEnv` já foi importado na Tarefa 10; não duplique a linha.)

- [ ] **Step 6: Server functions do backoffice**

Em `src/features/backoffice-users/api/users.ts`, acrescente aos imports:

```ts
import { sendResetLinks, setUserEmail } from '@/server/identity/composition'
```

E ao final do arquivo:

```ts
export const setUserEmailFn = createServerFn({ method: 'POST' })
  .middleware([requireCapability('manage_users')])
  .inputValidator(z.object({ username: z.string().max(64), email: z.string().max(254) }))
  .handler(({ data, context }) => outcome(() => setUserEmail(context.session.user, data.username, data.email)))

export const sendResetLinkFn = createServerFn({ method: 'POST' })
  .middleware([requireCapability('manage_users')])
  .inputValidator(z.object({ username: z.string().max(64) }))
  .handler(({ data, context }) => sendResetLinks(context.session.user, { usernames: [data.username] }))

export const sendResetLinksToAllFn = createServerFn({ method: 'POST' })
  .middleware([requireCapability('manage_users')])
  .handler(({ context }) => sendResetLinks(context.session.user, { all: true }))
```

Também troque o tipo `UserRow` para incluir `email`, e o mapeamento em `listUsersFn`:

```ts
export type UserRow = { id: string; username: string; name: string; role: Role; active: boolean; lastLoginAt: string | null; createdAt: string; email: string }
```

(`listUsersFn` já espalha `...user`, que agora inclui `email` — nenhuma outra mudança necessária ali.)

- [ ] **Step 7: Rodar a cobertura de capacidades**

Run: `pnpm vitest run tests/architecture/capability-coverage.test.ts`
Expected: PASS — as três funções novas declaram `requireCapability('manage_users')`.

- [ ] **Step 8: Tela — coluna de e-mail e botões de envio**

Em `src/features/backoffice-users/components/users-view.tsx`, troque o tipo `Props` para incluir os novos manipuladores:

```ts
type Props = {
  users: UserRow[]
  error: string | null
  pending: boolean
  onCreate(input: NewUser): void
  onChange(username: string, changes: UserChanges): void
  onRequestPassword(username: string): void
  onRename(username: string, currentName: string): void
  onChangeEmail(username: string, currentEmail: string): void
  onSendResetLink(username: string): void
  onSendResetLinksToAll(): void
}
```

Na função `UserLine`, acrescente uma célula de e-mail entre a de "Papel" e a de "Situação", e um botão de envio de link na célula de ações:

```tsx
function UserLine({ user, pending, onChange, onRequestPassword, onRename, onChangeEmail, onSendResetLink }: { user: UserRow } & Omit<Props, 'users' | 'error' | 'onCreate' | 'onSendResetLinksToAll'>) {
  const hasRealEmail = !user.email.endsWith('@users.invalid')
  return (
    <tr className={user.active ? undefined : 'is-inactive'}>
      <td>
        <b>{user.username}</b>
        <br />
        <span className="bo-muted">{user.name}</span>
      </td>
      <td>
        <span className={user.role === 'admin' ? 'bo-role is-admin' : 'bo-role'}>{ROLE_LABELS[user.role]}</span>
      </td>
      <td>{hasRealEmail ? user.email : <span className="bo-muted">sem e-mail</span>}</td>
      <td>{user.active ? 'ativo' : 'desativado'}</td>
      <td>{formatShortDateTime(user.lastLoginAt)}</td>
      <td>{formatShortDateTime(user.createdAt)}</td>
      <td>
        <button type="button" className="bo-button is-light" disabled={pending} onClick={() => onRequestPassword(user.username)}>
          Trocar senha
        </button>
        <select
          aria-label={`Papel de ${user.username}`}
          className="bo-button is-light"
          disabled={pending}
          value={user.role}
          onChange={(event) => onChange(user.username, { role: toRole(event.target.value) })}
        >
          {ROLE_ORDER.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <button type="button" className="bo-button is-light" disabled={pending} onClick={() => onChange(user.username, { active: !user.active })}>
          {user.active ? 'Desativar' : 'Reativar'}
        </button>
        <button type="button" className="bo-button is-light" disabled={pending} onClick={() => onRename(user.username, user.name)}>
          Renomear
        </button>
        <button type="button" className="bo-button is-light" disabled={pending} onClick={() => onChangeEmail(user.username, hasRealEmail ? user.email : '')}>
          E-mail
        </button>
        <button type="button" className="bo-button is-light" disabled={pending || !hasRealEmail} onClick={() => onSendResetLink(user.username)}>
          Enviar link de redefinição
        </button>
      </td>
    </tr>
  )
}
```

Ajuste o cabeçalho da tabela, acrescentando `<th>E-mail</th>` entre `<th>Papel</th>` e `<th>Situação</th>`.

No componente `UsersView`, acrescente o botão "enviar para todos" perto do título, e repasse os novos manipuladores a `UserLine`:

```tsx
export function UsersView({ users, error, pending, onCreate, onSendResetLinksToAll, ...lineProps }: Props) {
```

Depois do `<h2>` e antes do `<p className="bo-note" ...>`, acrescente:

```tsx
      <button type="button" className="bo-button is-light" style={{ float: 'right' }} disabled={pending} onClick={onSendResetLinksToAll}>
        Enviar link de redefinição para todos com e-mail cadastrado
      </button>
```

E no mapeamento final:

```tsx
            {users.map((user) => (
              <UserLine key={user.id} user={user} pending={pending} {...lineProps} />
            ))}
```

(`lineProps` já inclui `onChange, onRequestPassword, onRename, onChangeEmail, onSendResetLink` via o desestruturamento `{ users, error, pending, onCreate, onSendResetLinksToAll, ...lineProps }` — confira que `onChange`, `onRequestPassword`, `onRename`, `onChangeEmail`, `onSendResetLink` chegam todos por `lineProps`.)

- [ ] **Step 9: Atualizar o teste de `UsersView`**

Em `src/features/backoffice-users/components/users-view.test.tsx`, troque os dados de exemplo para incluir `email`:

```tsx
const users = [
  { id: 'u1', username: 'victor', name: 'Victor', role: 'admin' as const, active: true, lastLoginAt: null, createdAt: '2026-09-01T12:00:00.000Z', email: 'victor@austercontabil.com.br' },
  { id: 'u2', username: 'ana', name: 'Ana', role: 'operator' as const, active: false, lastLoginAt: null, createdAt: '2026-09-02T12:00:00.000Z', email: 'ana@users.invalid' },
]

const handlers = () => ({ onCreate: vi.fn(), onChange: vi.fn(), onRequestPassword: vi.fn(), onRename: vi.fn(), onChangeEmail: vi.fn(), onSendResetLink: vi.fn(), onSendResetLinksToAll: vi.fn() })
```

E acrescente, dentro do `describe('UsersView', ...)`:

```tsx
  it('shows the real email, hides the fake one, and the reset button only works with a real email', async () => {
    const props = handlers()
    render(<UsersView users={users} error={null} pending={false} {...props} />)
    const victor = screen.getByText('victor').closest('tr')!
    const ana = screen.getByText('ana').closest('tr')!
    expect(within(victor).getByText('victor@austercontabil.com.br')).toBeInTheDocument()
    expect(within(ana).getByText('sem e-mail')).toBeInTheDocument()
    expect(within(ana).getByRole('button', { name: 'Enviar link de redefinição' })).toBeDisabled()
    await userEvent.click(within(victor).getByRole('button', { name: 'Enviar link de redefinição' }))
    expect(props.onSendResetLink).toHaveBeenCalledWith('victor')
    await userEvent.click(within(victor).getByRole('button', { name: 'E-mail' }))
    expect(props.onChangeEmail).toHaveBeenCalledWith('victor', 'victor@austercontabil.com.br')
    await userEvent.click(screen.getByRole('button', { name: /Enviar link de redefinição para todos/ }))
    expect(props.onSendResetLinksToAll).toHaveBeenCalled()
  })
```

- [ ] **Step 10: Rodar e ver passar**

Run: `pnpm vitest run src/features/backoffice-users/components/users-view.test.tsx`
Expected: PASS

- [ ] **Step 11: Ligar no painel**

Em `src/features/backoffice-users/components/users-panel.tsx`, troque o import:

```tsx
import { createUserFn, listUsersFn, updateUserFn, type Outcome } from '../api/users'
```

por:

```tsx
import { createUserFn, listUsersFn, sendResetLinkFn, sendResetLinksToAllFn, setUserEmailFn, updateUserFn, type Outcome } from '../api/users'
```

Acrescente, depois das mutações `create` e `change` já existentes:

```tsx
  const setEmail = useMutation({
    mutationFn: ({ username, email }: { username: string; email: string }) => setUserEmailFn({ data: { username, email } }),
    onSuccess: settle('E-mail: '),
    onError: (failure) => setError(`E-mail: não deu para falar com o servidor (${failure.message})`),
  })
  const sendReset = useMutation({
    mutationFn: (username: string) => sendResetLinkFn({ data: { username } }),
    onSuccess: () => setError(null),
    onError: (failure) => setError(`Enviar link: não deu para falar com o servidor (${failure.message})`),
  })
  const sendResetToAll = useMutation({
    mutationFn: () => sendResetLinksToAllFn(),
    onSuccess: (result) => setError(`Enviado para ${result.sent} pessoa(s) com e-mail cadastrado.`),
    onError: (failure) => setError(`Enviar para todos: não deu para falar com o servidor (${failure.message})`),
  })

  const changeEmail = (username: string, currentEmail: string) => {
    const email = window.prompt(`E-mail de ${username}`, currentEmail)?.trim()
    if (email) setEmail.mutate({ username, email })
  }
```

E na chamada de `<UsersView ...>`, acrescente os três novos manipuladores:

```tsx
      <UsersView
        users={list.data}
        error={error}
        pending={create.isPending || change.isPending}
        onCreate={(user) => setAsking({ kind: 'create', user })}
        onChange={(username, changes) => change.mutate({ username, changes, title: changes.role ? 'Mudar papel' : 'Mudar situação' })}
        onRequestPassword={(username) => setAsking({ kind: 'password', username })}
        onRename={rename}
        onChangeEmail={changeEmail}
        onSendResetLink={(username) => sendReset.mutate(username)}
        onSendResetLinksToAll={() => sendResetToAll.mutate()}
      />
```

- [ ] **Step 12: Atualizar o teste do painel**

Em `src/features/backoffice-users/components/users-panel.test.tsx`, troque o objeto `victor` de exemplo para incluir `email: 'victor@austercontabil.com.br'`, e o `vi.mock('../api/users', ...)` para também simular `setUserEmailFn`, `sendResetLinkFn`, `sendResetLinksToAllFn`:

```tsx
const { listUsersFn, createUserFn, updateUserFn, setUserEmailFn, sendResetLinkFn, sendResetLinksToAllFn } = vi.hoisted(() => ({
  listUsersFn: vi.fn(), createUserFn: vi.fn(), updateUserFn: vi.fn(), setUserEmailFn: vi.fn(), sendResetLinkFn: vi.fn(), sendResetLinksToAllFn: vi.fn(),
}))
vi.mock('../api/users', () => ({ listUsersFn, createUserFn, updateUserFn, setUserEmailFn, sendResetLinkFn, sendResetLinksToAllFn }))
```

E acrescente um teste:

```tsx
  it('sends the reset link for one user', async () => {
    listUsersFn.mockResolvedValue([victor])
    sendResetLinkFn.mockResolvedValue({ sent: 1 })
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar link de redefinição' }))
    await waitFor(() => expect(sendResetLinkFn).toHaveBeenCalledWith({ data: { username: 'victor' } }))
  })
```

(`victor` precisa ter `email: 'victor@austercontabil.com.br'` no objeto de exemplo do topo do arquivo para o botão não vir desabilitado.)

- [ ] **Step 13: Rodar todos os testes de componente da área**

Run: `pnpm test:dom`
Expected: PASS

- [ ] **Step 14: Commit**

```bash
git add src/server/identity src/features/backoffice-users
git commit -m "feat(backoffice): e-mail do usuário e envio de link de redefinição"
```

---

## Task 13: Backoffice — colar lista `usuário;e-mail`

**Files:**
- Create: `src/server/identity/application/import-user-emails.ts`
- Create: `src/server/identity/application/import-user-emails.test.ts`
- Modify: `src/server/identity/composition.ts`
- Modify: `src/features/backoffice-users/api/users.ts`
- Create: `src/features/backoffice-users/components/import-emails-form.tsx`
- Create: `src/features/backoffice-users/components/import-emails-form.test.tsx`
- Modify: `src/features/backoffice-users/components/users-panel.tsx`

**Interfaces:**
- Produces: `makeImportUserEmails(deps): (actor, rawText: string) => Promise<ImportUserEmailsResult>`, `ImportUserEmailsResult = { ok: true; appliedUsernames: string[] } | { ok: false; errors: { line: number; reason: string }[] }`; server function `importUserEmailsFn`; componente `<ImportEmailsForm />`.

- [ ] **Step 1: Escrever o teste do caso de uso**

Create `src/server/identity/application/import-user-emails.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { makeImportUserEmails } from './import-user-emails'

function setup(existingUsernames: string[]) {
  const emails = new Map<string, string>()
  const accounts = {
    findByUsername: async (username: string) => (existingUsernames.includes(username) ? { id: username } : null),
    setEmail: async (id: string, email: string) => void emails.set(id, email),
  }
  const audit: unknown[] = []
  const importUserEmails = makeImportUserEmails({ accounts, recordAudit: async (entry) => void audit.push(entry) })
  return { importUserEmails, emails, audit }
}

const admin = { id: 'a', username: 'ana', role: 'admin' as const }

describe('import user emails', () => {
  it('applies every valid line, all at once', async () => {
    const { importUserEmails, emails, audit } = setup(['bia', 'caio'])
    const result = await importUserEmails(admin, 'bia;bia@austercontabil.com.br\ncaio;caio@austercontabil.com.br\n')
    expect(result).toEqual({ ok: true, appliedUsernames: ['bia', 'caio'] })
    expect(emails).toEqual(new Map([['bia', 'bia@austercontabil.com.br'], ['caio', 'caio@austercontabil.com.br']]))
    expect(audit).toEqual([{ action: 'user_email_changed', actorId: 'a', actorUsername: 'ana', reference: '2', detail: { usernames: ['bia', 'caio'] } }])
  })

  it('applies nothing if any line is invalid, and reports every problem', async () => {
    const { importUserEmails, emails } = setup(['bia'])
    const result = await importUserEmails(admin, 'bia;bia@austercontabil.com.br\nninguem;x@austercontabil.com.br\nbia;não é email\n')
    expect(result).toEqual({
      ok: false,
      errors: [
        { line: 2, reason: 'usuário não encontrado' },
        { line: 3, reason: 'e-mail inválido' },
      ],
    })
    expect(emails.size).toBe(0)
  })

  it('ignores blank lines', async () => {
    const { importUserEmails } = setup(['bia'])
    expect(await importUserEmails(admin, '\nbia;bia@austercontabil.com.br\n\n')).toEqual({ ok: true, appliedUsernames: ['bia'] })
  })

  it('only admins import emails', async () => {
    const { importUserEmails } = setup(['bia'])
    await expect(importUserEmails({ id: 'o', username: 'caio', role: 'operator' }, 'bia;bia@austercontabil.com.br')).rejects.toMatchObject({ reason: 'forbidden' })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/server/identity/application/import-user-emails.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

Create `src/server/identity/application/import-user-emails.ts`:

```ts
import { IdentityError, type Actor } from '../domain/user'

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ImportUserEmailsResult = { ok: true; appliedUsernames: string[] } | { ok: false; errors: { line: number; reason: string }[] }

type AccountEmailPort = { findByUsername(username: string): Promise<{ id: string } | null>; setEmail(id: string, email: string): Promise<void> }
type AuditRecorder = (entry: { action: 'user_email_changed'; actorId: string; actorUsername: string; reference: string; detail: { usernames: string[] } }) => Promise<void>

type ParsedLine = { line: number; username: string; email: string }

export function makeImportUserEmails(deps: { accounts: AccountEmailPort; recordAudit: AuditRecorder }) {
  return async function importUserEmails(actor: Actor, rawText: string): Promise<ImportUserEmailsResult> {
    if (actor.role !== 'admin') throw new IdentityError('forbidden')

    const parsed: ParsedLine[] = rawText
      .split('\n')
      .map((text, index) => ({ text: text.trim(), line: index + 1 }))
      .filter(({ text }) => text.length > 0)
      .map(({ text, line }) => {
        const [username = '', email = ''] = text.split(';').map((part) => part.trim())
        return { line, username: username.toLowerCase(), email: email.toLowerCase() }
      })

    const targets = await Promise.all(parsed.map(async (row) => ({ row, target: await deps.accounts.findByUsername(row.username) })))

    const errors: { line: number; reason: string }[] = []
    for (const { row, target } of targets) {
      if (!target) errors.push({ line: row.line, reason: 'usuário não encontrado' })
      else if (!EMAIL_RULE.test(row.email)) errors.push({ line: row.line, reason: 'e-mail inválido' })
    }
    if (errors.length > 0) return { ok: false, errors }

    for (const { row, target } of targets) await deps.accounts.setEmail(target!.id, row.email)
    const appliedUsernames = parsed.map((row) => row.username)
    await deps.recordAudit({ action: 'user_email_changed', actorId: actor.id, actorUsername: actor.username, reference: String(appliedUsernames.length), detail: { usernames: appliedUsernames } })
    return { ok: true, appliedUsernames }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/server/identity/application/import-user-emails.test.ts`
Expected: PASS

- [ ] **Step 5: Ligar no `composition.ts` e na API do backoffice**

Em `src/server/identity/composition.ts`, acrescente:

```ts
import { makeImportUserEmails } from './application/import-user-emails'
```

```ts
export const importUserEmails = makeImportUserEmails({ accounts: betterAuthUserAccounts, recordAudit })
export type { ImportUserEmailsResult } from './application/import-user-emails'
```

Em `src/features/backoffice-users/api/users.ts`, acrescente ao import `import { importUserEmails, sendResetLinks, setUserEmail } from '@/server/identity/composition'` e, ao final do arquivo:

```ts
export const importUserEmailsFn = createServerFn({ method: 'POST' })
  .middleware([requireCapability('manage_users')])
  .inputValidator(z.object({ text: z.string().max(10_000) }))
  .handler(({ data, context }) => importUserEmails(context.session.user, data.text))
```

- [ ] **Step 6: Rodar a cobertura de capacidades**

Run: `pnpm vitest run tests/architecture/capability-coverage.test.ts`
Expected: PASS

- [ ] **Step 7: Teste do componente de importação**

Create `src/features/backoffice-users/components/import-emails-form.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const { importUserEmailsFn } = vi.hoisted(() => ({ importUserEmailsFn: vi.fn() }))
vi.mock('../api/users', () => ({ importUserEmailsFn }))

const { ImportEmailsForm } = await import('./import-emails-form')

describe('ImportEmailsForm', () => {
  it('sends the pasted text and reports how many were applied', async () => {
    importUserEmailsFn.mockResolvedValue({ ok: true, appliedUsernames: ['bia', 'caio'] })
    render(<ImportEmailsForm />)
    await userEvent.type(screen.getByPlaceholderText(/usuario;email/), 'bia;bia@austercontabil.com.br')
    await userEvent.click(screen.getByRole('button', { name: 'Importar e-mails' }))
    await waitFor(() => expect(importUserEmailsFn).toHaveBeenCalledWith({ data: { text: 'bia;bia@austercontabil.com.br' } }))
    expect(await screen.findByText('2 e-mail(s) atualizado(s): bia, caio')).toBeInTheDocument()
  })

  it('lists every rejected line without applying anything', async () => {
    importUserEmailsFn.mockResolvedValue({ ok: false, errors: [{ line: 2, reason: 'usuário não encontrado' }] })
    render(<ImportEmailsForm />)
    await userEvent.type(screen.getByPlaceholderText(/usuario;email/), 'bia;bia@austercontabil.com.br\nninguem;x@a.com.br')
    await userEvent.click(screen.getByRole('button', { name: 'Importar e-mails' }))
    expect(await screen.findByText('Linha 2: usuário não encontrado')).toBeInTheDocument()
  })
})
```

- [ ] **Step 8: Rodar e ver falhar**

Run: `pnpm vitest run src/features/backoffice-users/components/import-emails-form.test.tsx`
Expected: FAIL

- [ ] **Step 9: Implementar**

Create `src/features/backoffice-users/components/import-emails-form.tsx`:

```tsx
import { useState } from 'react'
import { importUserEmailsFn, type ImportUserEmailsResult } from '../api/users'

export function ImportEmailsForm() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<ImportUserEmailsResult | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    setPending(true)
    const outcome = await importUserEmailsFn({ data: { text } })
    setPending(false)
    setResult(outcome)
    if (outcome.ok) setText('')
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 'var(--text-title)', fontWeight: 400 }}>Importar e-mails</h3>
      <p className="bo-note" style={{ margin: '0 0 10px' }}>Uma linha por pessoa, no formato <code>usuario;email</code>.</p>
      <textarea
        placeholder="usuario;email, uma linha por pessoa"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        style={{ width: '100%', maxWidth: 480, fontFamily: 'monospace' }}
      />
      <div>
        <button type="button" className="bo-button" disabled={pending || !text.trim()} onClick={submit}>
          Importar e-mails
        </button>
      </div>
      {result?.ok === false ? (
        <div className="bo-error">
          {result.errors.map((error) => (
            <div key={error.line}>{`Linha ${error.line}: ${error.reason}`}</div>
          ))}
        </div>
      ) : null}
      {result?.ok ? <div className="bo-note">{`${result.appliedUsernames.length} e-mail(s) atualizado(s): ${result.appliedUsernames.join(', ')}`}</div> : null}
    </div>
  )
}
```

- [ ] **Step 10: Rodar e ver passar**

Run: `pnpm vitest run src/features/backoffice-users/components/import-emails-form.test.tsx`
Expected: PASS

- [ ] **Step 11: Encaixar no painel de usuários**

Em `src/features/backoffice-users/components/users-panel.tsx`, importe e renderize o novo componente logo depois de `<UsersView ... />`:

```tsx
import { ImportEmailsForm } from './import-emails-form'
```

```tsx
      <ImportEmailsForm />
```

- [ ] **Step 12: Rodar todos os testes de componente**

Run: `pnpm test:dom`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add src/server/identity src/features/backoffice-users
git commit -m "feat(backoffice): colar lista usuário;e-mail para cadastro em lote"
```

---

## Task 14: Scripts de execução única

**Files:**
- Create: `scripts/fill-user-emails.ts`
- Create: `scripts/fill-user-emails.test.ts`
- Create: `scripts/set-batch-passwords.ts`
- Create: `scripts/set-batch-passwords.test.ts`
- Create: `scripts/send-test-mail.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm run auth:fill-user-emails` (padrão: só lista; `--apply` grava), `pnpm run auth:set-batch-passwords` (padrão: só lista; `--apply` grava, exige `BATCH_PASSWORD_SUFFIX`), `pnpm run auth:send-test-mail -- --to <email>`.

- [ ] **Step 1: Testar a lógica pura de `fill-user-emails` (o que entra e o que fica de fora)**

Create `scripts/fill-user-emails.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { USERNAME_RULE } from '@/server/shared/auth/auth'
import { planEmailFill } from './fill-user-emails'

describe('planEmailFill', () => {
  it('derives the pattern email and flags what does not follow it', () => {
    const plan = planEmailFill(['sara.vinhais', 'victor.medeiros', 'admin', 'e2e-operator'], { 'victor.medeiros': 'victor@austercontabil.com.br' })
    expect(plan.derivable).toEqual([
      { username: 'sara.vinhais', email: 'sara.vinhais@austercontabil.com.br' },
      { username: 'victor.medeiros', email: 'victor@austercontabil.com.br' },
    ])
    expect(plan.notDerivable).toEqual(['admin', 'e2e-operator'])
  })

  it('flags a collision between two derived emails', () => {
    const plan = planEmailFill(['ana', 'ana.silva'], {})
    expect(plan.collisions).toEqual(['ana@austercontabil.com.br'])
  })
})

it('USERNAME_RULE accepts every plain dotted username', () => {
  expect(USERNAME_RULE.test('sara.vinhais')).toBe(true)
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run scripts/fill-user-emails.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar a lógica pura e o script**

Create `scripts/fill-user-emails.ts`:

```ts
import { deriveEmail } from '../src/server/identity/domain/contact'
import { USERNAME_RULE } from '../src/server/shared/auth/auth'

export interface EmailFillPlan {
  derivable: { username: string; email: string }[]
  notDerivable: string[]
  collisions: string[]
}

const PLAIN_USERNAME = /^[a-z]+(\.[a-z]+)+$/

// "nome.sobrenome" dá para derivar com confiança; qualquer outro formato (admin, e2e-*, um nome só) entra à parte.
export function planEmailFill(usernames: string[], overrides: Record<string, string>): EmailFillPlan {
  const derivable: { username: string; email: string }[] = []
  const notDerivable: string[] = []
  for (const username of usernames) {
    if (overrides[username] || PLAIN_USERNAME.test(username)) derivable.push({ username, email: deriveEmail(username, overrides) })
    else notDerivable.push(username)
  }
  const seen = new Map<string, number>()
  for (const { email } of derivable) seen.set(email, (seen.get(email) ?? 0) + 1)
  const collisions = [...seen.entries()].filter(([, count]) => count > 1).map(([email]) => email)
  return { derivable, notDerivable, collisions }
}

async function main() {
  if (import.meta.url !== `file://${process.argv[1]}`) return
  const { prisma } = await import('../src/server/shared/prisma/client')
  const { recordAudit } = await import('../src/server/audit/composition')

  const apply = process.argv.includes('--apply')
  const overrides: Record<string, string> = { 'victor.medeiros': 'victor@austercontabil.com.br' }

  const users = await prisma.user.findMany({ select: { id: true, username: true } })
  const plan = planEmailFill(users.map((u) => u.username ?? ''), overrides)

  console.log(`${plan.derivable.length} e-mail(s) a aplicar:`)
  for (const { username, email } of plan.derivable) console.log(`  ${username} -> ${email}`)
  if (plan.notDerivable.length) console.log(`\nSem derivação automática (informe à mão): ${plan.notDerivable.join(', ')}`)
  if (plan.collisions.length) {
    console.log(`\nColisão de e-mail, nada será gravado para os envolvidos: ${plan.collisions.join(', ')}`)
  }

  if (!apply) {
    console.log('\nSó listando. Rode de novo com --apply para gravar.')
    process.exit(0)
  }
  if (plan.collisions.length) {
    console.log('\nHá colisão: corrija e rode de novo antes de aplicar.')
    process.exit(1)
  }

  const byUsername = new Map(users.map((u) => [u.username, u.id]))
  for (const { username, email } of plan.derivable) {
    const id = byUsername.get(username)
    if (!id) continue
    await prisma.user.update({ where: { id }, data: { email } })
  }
  await recordAudit({ action: 'user_email_changed', actorUsername: 'fill-user-emails', reference: String(plan.derivable.length), detail: { usernames: plan.derivable.map((d) => d.username) } })
  console.log(`\n${plan.derivable.length} e-mail(s) gravado(s).`)
  process.exit(0)
}

main()
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run scripts/fill-user-emails.test.ts`
Expected: PASS

- [ ] **Step 5: Teste da lógica pura de `set-batch-passwords`**

Create `scripts/set-batch-passwords.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { planBatchPasswords } from './set-batch-passwords'

describe('planBatchPasswords', () => {
  it('builds FirstName+suffix for every active, non-e2e user', () => {
    const plan = planBatchPasswords(
      [
        { username: 'sara.vinhais', active: true },
        { username: 'ex.funcionario', active: false },
        { username: 'e2e-operator', active: true },
      ],
      '246!!!',
    )
    expect(plan).toEqual([{ username: 'sara.vinhais', password: 'Sara246!!!' }])
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `pnpm vitest run scripts/set-batch-passwords.test.ts`
Expected: FAIL

- [ ] **Step 7: Implementar**

Create `scripts/set-batch-passwords.ts`:

```ts
import { deriveFirstName } from '../src/server/identity/domain/contact'
import { meetsPasswordRule } from '../src/server/identity/domain/user-rules'

export interface BatchPasswordPlan {
  username: string
  password: string
}

export function planBatchPasswords(users: { username: string; active: boolean }[], suffix: string): BatchPasswordPlan[] {
  return users
    .filter((u) => u.active && !u.username.startsWith('e2e-'))
    .map((u) => ({ username: u.username, password: `${deriveFirstName(u.username)}${suffix}` }))
}

async function main() {
  if (import.meta.url !== `file://${process.argv[1]}`) return
  const suffix = process.env.BATCH_PASSWORD_SUFFIX
  if (!suffix) throw new Error('defina BATCH_PASSWORD_SUFFIX no ambiente antes de rodar')

  const { auth } = await import('../src/server/shared/auth/auth')
  const { prisma } = await import('../src/server/shared/prisma/client')
  const { recordAudit } = await import('../src/server/audit/composition')

  const apply = process.argv.includes('--apply')
  const users = await prisma.user.findMany({ select: { id: true, username: true, banned: true } })
  const plan = planBatchPasswords(users.map((u) => ({ username: u.username ?? '', active: !u.banned })), suffix)

  const rejected = plan.filter((p) => !meetsPasswordRule(p.password))
  if (rejected.length) throw new Error(`a senha gerada não cumpre a regra para: ${rejected.map((r) => r.username).join(', ')}`)

  console.log(`${plan.length} usuário(s) a redefinir: ${plan.map((p) => p.username).join(', ')}`)
  if (!apply) {
    console.log('Só listando. Rode de novo com --apply para gravar. Nenhuma senha aparece neste log.')
    process.exit(0)
  }

  const context = await auth.$context
  const byUsername = new Map(users.map((u) => [u.username, u.id]))
  for (const { username, password } of plan) {
    const id = byUsername.get(username)
    if (!id) continue
    const hash = await context.password.hash(password)
    const updated = await prisma.account.updateMany({ where: { userId: id, providerId: 'credential' }, data: { password: hash } })
    if (updated.count === 0) await prisma.account.create({ data: { id: crypto.randomUUID(), accountId: id, providerId: 'credential', userId: id, password: hash } })
    await prisma.session.deleteMany({ where: { userId: id } })
  }
  await recordAudit({ action: 'passwords_set_in_batch', actorUsername: 'set-batch-passwords', reference: String(plan.length), detail: { count: plan.length } })
  console.log(`${plan.length} senha(s) gravada(s). Avise cada pessoa, individualmente, pelo canal de sempre — nunca em grupo.`)
  process.exit(0)
}

main()
```

- [ ] **Step 8: Rodar e ver passar**

Run: `pnpm vitest run scripts/set-batch-passwords.test.ts`
Expected: PASS

- [ ] **Step 9: Script de teste de envio**

Create `scripts/send-test-mail.ts`:

```ts
import { mailSender } from '../src/server/mail/composition'

async function main() {
  const toIndex = process.argv.indexOf('--to')
  const to = toIndex !== -1 ? process.argv[toIndex + 1] : undefined
  if (!to) throw new Error('uso: tsx scripts/send-test-mail.ts --to <email>')

  await mailSender.send({ to, subject: 'Teste de envio — Auster', text: 'Se você recebeu isto, o SMTP do portal está configurado corretamente.' })
  console.log(`mensagem de teste enviada para ${to}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
```

- [ ] **Step 10: Registrar os três scripts no `package.json`**

Em `package.json`, no bloco `"scripts"`, depois da linha `"migrate:legacy": "tsx --env-file-if-exists=.env scripts/migrate-legacy.ts",`, acrescente:

```json
    "auth:fill-user-emails": "tsx --env-file-if-exists=.env scripts/fill-user-emails.ts",
    "auth:set-batch-passwords": "tsx --env-file-if-exists=.env scripts/set-batch-passwords.ts",
    "auth:send-test-mail": "tsx --env-file-if-exists=.env scripts/send-test-mail.ts",
```

- [ ] **Step 11: Rodar os testes unitários dos scripts e o typecheck**

Run: `pnpm vitest run scripts && pnpm typecheck`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add scripts package.json
git commit -m "feat(auth): scripts de execução única — e-mails por regra e senhas padrão em lote"
```

---

## Task 15: Mailpit local e e2e do fluxo completo

Fecha a spec: como testar o envio sem usar a caixa de produção, e um teste de ponta a ponta que confirma o fluxo inteiro.

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Create: `tests/e2e/password-reset.spec.ts`

**Interfaces:**
- Nenhuma nova — só infraestrutura de desenvolvimento e um teste e2e que exercita as rotas e server functions já prontas.

- [ ] **Step 1: Acrescentar o Mailpit ao `docker-compose.yml`**

Em `docker-compose.yml`, depois do serviço `minio` (antes de `volumes:`), acrescente:

```yaml
  mailpit:
    image: axllent/mailpit:latest
    ports: ['1025:1025', '8025:8025']
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://localhost:8025/readyz']
      interval: 2s
      retries: 20
```

- [ ] **Step 2: Documentar no `.env.example`**

Em `.env.example`, troque:

```
# E-mail no-reply (UOL Host). Sem usuário e senha o app sobe, mas todo envio falha.
# SMTP_HOST=smtps.uhserver.com
# SMTP_PORT=465
# SMTP_USER=no-reply@austercontabil.com.br
SMTP_USER=
SMTP_PASSWORD=
```

por:

```
# E-mail no-reply (UOL Host). Sem usuário e senha o app sobe, mas todo envio falha.
# SMTP_HOST=smtps.uhserver.com
# SMTP_PORT=465
# SMTP_USER=no-reply@austercontabil.com.br
SMTP_USER=
SMTP_PASSWORD=
# Para testar o envio em desenvolvimento sem usar a caixa de produção: suba o Mailpit (pnpm db:up já inclui) e troque
# as três linhas acima por SMTP_HOST=localhost, SMTP_PORT=1025, SMTP_USER=dev, SMTP_PASSWORD=dev. As mensagens aparecem
# em http://localhost:8025, sem sair da máquina.
```

- [ ] **Step 3: Escrever o teste e2e**

Create `tests/e2e/password-reset.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { E2E_OPERATOR } from './users'

test('o operador redefine a própria senha pelo e-mail e entra com a nova', async ({ page, request }) => {
  await page.goto('/forgot-password')
  await page.getByLabel('Usuário').fill(E2E_OPERATOR.username)
  await page.getByRole('button', { name: 'Enviar link de redefinição' }).click()
  await expect(page.getByText(/Se o usuário existir e tiver e-mail cadastrado/)).toBeVisible()

  const mailpit = await request.get('http://localhost:8025/api/v1/search', { params: { query: `to:${E2E_OPERATOR.username}@austercontabil.com.br` } })
  const { messages } = await mailpit.json()
  expect(messages.length).toBeGreaterThan(0)
  const full = await (await request.get(`http://localhost:8025/api/v1/message/${messages[0].ID}`)).json()
  const link = /https?:\/\/[^\s"]+\/reset-password\?token=[a-f0-9]+/.exec(full.Text)?.[0]
  expect(link).toBeTruthy()

  await page.goto(link!)
  await page.getByPlaceholder('Nova senha').fill('Operador246!')
  await page.getByPlaceholder('Repita a nova senha').fill('Operador246!')
  await page.getByRole('button', { name: 'Definir nova senha' }).click()
  await expect(page).toHaveURL(/\/login/)

  await page.getByLabel('Usuário').fill(E2E_OPERATOR.username)
  await page.getByLabel('Senha').fill('Operador246!')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/backoffice/)
})
```

O `tests/e2e/seed-users.ts` precisa dar um e-mail real ao `e2e-operator` para este teste funcionar — acrescente, depois do `for` que cria/reativa os usuários de teste:

```ts
await prisma.user.update({ where: { username: E2E_OPERATOR.username }, data: { email: `${E2E_OPERATOR.username}@austercontabil.com.br` } })
```

E o `playwright.config.ts` precisa das variáveis de SMTP locais no `webServer.env`, apontando para o Mailpit:

```ts
    env: { PORT: String(port), BETTER_AUTH_URL: origin, APP_PUBLIC_URL: origin, SMTP_HOST: 'localhost', SMTP_PORT: '1025', SMTP_USER: 'dev', SMTP_PASSWORD: 'dev' },
```

- [ ] **Step 4: Rodar o fluxo**

Run: `pnpm db:up` (sobe também o Mailpit), depois `E2E_PORT=3100 pnpm test:e2e -- password-reset.spec.ts`
Expected: PASS. Se a porta 465 do Nodemailer insistir em TLS: o adaptador (`createSmtpMailSender`) só liga `secure: true` quando a porta é 465 — com `SMTP_PORT=1025` ele sobe em texto puro, que é o que o Mailpit espera.

- [ ] **Step 5: Rodar a suíte inteira uma última vez**

Run: `pnpm db:up && pnpm lint && pnpm typecheck && pnpm test`
Expected: tudo PASS. Esse é o portão de saída do `AGENTS.md` antes do merge.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example tests/e2e
git commit -m "test(auth): mailpit local e ponta a ponta do reset de senha"
```

---

## Depois de todas as tarefas

Siga o fluxo de git do `AGENTS.md`: merge `--no-ff` da branch de trabalho na `main` com mensagem `merge: reset de senha por e-mail`, e só então `git push origin main` — com a confirmação do Victor antes, porque esse push publica em produção e roda a migração da Tarefa 4 contra o banco real. Depois do deploy, rode `pnpm run auth:fill-user-emails` e `pnpm run auth:send-test-mail -- --to <seu e-mail>` contra produção para confirmar que `SMTP_USER`/`SMTP_PASSWORD` estão configurados no Dokploy antes de divulgar o "esqueci a senha" para a equipe.
