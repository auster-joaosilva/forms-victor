import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UserAccount } from '../domain/user'
import type { UserAccounts } from '../ports/user-accounts'
import type { PasswordResetTokens, StoredPasswordResetToken } from '../ports/password-reset-tokens'
import type { ResetMailer } from '../ports/reset-mailer'
import { makeRequestPasswordReset } from './request-password-reset'

const victor: UserAccount = {
  id: 'u1', username: 'victor.medeiros', name: 'Victor', role: 'admin', active: true,
  lastLoginAt: null, createdAt: new Date(0), email: 'victor@austercontabil.com.br',
}
const semEmail: UserAccount = { ...victor, id: 'u2', username: 'sara.vinhais', email: 'sara.vinhais@users.invalid' }
const desativado: UserAccount = { ...victor, id: 'u3', username: 'ex.funcionario', active: false }

// O envio corre fora do caminho da resposta (R4): espera a fila de microtarefas esvaziar antes de olhar o efeito.
const backgroundWork = () => new Promise((resolve) => setTimeout(resolve, 0))

function fakeAccounts(users: UserAccount[]): UserAccounts {
  return {
    list: async () => users,
    findByUsername: async (username) => users.find((u) => u.username === username) ?? null,
    countActiveAdmins: async () => users.filter((u) => u.role === 'admin' && u.active).length,
    create: async () => { throw new Error('não usado') },
    rename: async () => {},
    setRole: async () => {},
    setActive: async () => {},
    setPassword: async () => {},
    setEmail: async () => {},
    setEmails: async () => {},
  }
}

function setup(users: UserAccount[], options: { baseUrl?: string; mailer?: ResetMailer } = {}) {
  let now = new Date('2026-10-12T12:00:00Z')
  const issued: (StoredPasswordResetToken & { createdAt: Date })[] = []
  const tokens: PasswordResetTokens = {
    issue: async (input) => void issued.push({ id: `t${issued.length}`, userId: input.userId, expiresAt: input.expiresAt, usedAt: null, createdAt: now }),
    findByHash: async () => null,
    markUsed: async () => {},
    lastIssuedAt: async (userId) => issued.filter((t) => t.userId === userId).at(-1)?.createdAt ?? null,
  }
  const sent: { to: string; resetUrl: string }[] = []
  const mailer = options.mailer ?? { sendResetLink: async (to: string, resetUrl: string) => void sent.push({ to, resetUrl }) }
  const audit: unknown[] = []
  const requestPasswordReset = makeRequestPasswordReset({
    accounts: fakeAccounts(users),
    tokens,
    tokenGenerator: { next: () => ({ token: 'plain-token', tokenHash: 'hashed-token' }) },
    mailer,
    clock: { now: () => now },
    rateLimiter: { check: async () => ({ allowed: true }) },
    recordAudit: async (entry) => void audit.push(entry),
    baseUrl: options.baseUrl ?? 'https://reforma-tributaria.austercontabil.com.br',
  })
  return { requestPasswordReset, issued, sent, audit, setNow: (at: string) => void (now = new Date(at)) }
}

describe('request password reset', () => {
  afterEach(() => vi.restoreAllMocks())

  it('issues a token and sends the email for a user with a real email', async () => {
    const { requestPasswordReset, issued, sent, audit } = setup([victor])
    const result = await requestPasswordReset({ username: 'victor.medeiros', origin: '203.0.113.9' })
    expect(result).toEqual({ ok: true })
    await backgroundWork()
    expect(issued).toEqual([{ id: 't0', userId: 'u1', expiresAt: new Date('2026-10-12T13:00:00Z'), usedAt: null, createdAt: new Date('2026-10-12T12:00:00Z') }])
    expect(sent).toEqual([{ to: 'victor@austercontabil.com.br', resetUrl: 'https://reforma-tributaria.austercontabil.com.br/reset-password?token=plain-token' }])
    expect(audit).toEqual([{ action: 'password_reset_requested', actorUsername: 'victor.medeiros', reference: 'u1' }])
  })

  it('answers the same for a user without a real email, but sends nothing', async () => {
    const { requestPasswordReset, issued, sent } = setup([semEmail], { baseUrl: 'https://x' })
    const result = await requestPasswordReset({ username: 'sara.vinhais', origin: null })
    expect(result).toEqual({ ok: true })
    await backgroundWork()
    expect(issued).toEqual([])
    expect(sent).toEqual([])
  })

  it('answers the same for a deactivated account, but sends nothing', async () => {
    const { requestPasswordReset, sent } = setup([desativado], { baseUrl: 'https://x' })
    expect(await requestPasswordReset({ username: 'ex.funcionario', origin: null })).toEqual({ ok: true })
    await backgroundWork()
    expect(sent).toEqual([])
  })

  it('answers the same for a username that does not exist, but sends nothing', async () => {
    const { requestPasswordReset, sent } = setup([], { baseUrl: 'https://x' })
    expect(await requestPasswordReset({ username: 'ninguem', origin: null })).toEqual({ ok: true })
    await backgroundWork()
    expect(sent).toEqual([])
  })

  it('never lets a mailer failure reach the caller, and keeps the token already written', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { requestPasswordReset, issued, audit } = setup([victor], { mailer: { sendResetLink: async () => { throw new Error('SMTP não configurado') } } })
    expect(await requestPasswordReset({ username: 'victor.medeiros', origin: null })).toEqual({ ok: true })
    await backgroundWork()
    expect(issued).toHaveLength(1)
    expect(audit).toEqual([])
    expect(logged).toHaveBeenCalled()
  })

  it('answers without waiting for the email to go out, so the response time does not reveal who has an account', async () => {
    const { requestPasswordReset } = setup([victor], { mailer: { sendResetLink: () => new Promise<void>(() => {}) } })
    const timedOut = new Promise((resolve) => setTimeout(() => resolve('esperou o envio'), 50))
    expect(await Promise.race([requestPasswordReset({ username: 'victor.medeiros', origin: null }), timedOut])).toEqual({ ok: true })
  })

  it('sends at most one link per user every 10 minutes, silently answering the same', async () => {
    const { requestPasswordReset, issued, sent, setNow } = setup([victor])
    expect(await requestPasswordReset({ username: 'victor.medeiros', origin: null })).toEqual({ ok: true })
    await backgroundWork()
    setNow('2026-10-12T12:09:59Z')
    expect(await requestPasswordReset({ username: 'victor.medeiros', origin: null })).toEqual({ ok: true })
    await backgroundWork()
    expect(issued).toHaveLength(1)
    expect(sent).toHaveLength(1)
    setNow('2026-10-12T12:10:00Z')
    expect(await requestPasswordReset({ username: 'victor.medeiros', origin: null })).toEqual({ ok: true })
    await backgroundWork()
    expect(issued).toHaveLength(2)
    expect(sent).toHaveLength(2)
  })

  it('rate-limits by origin before touching the database', async () => {
    const issue = vi.fn()
    const requestPasswordReset = makeRequestPasswordReset({
      accounts: fakeAccounts([victor]),
      tokens: { issue, findByHash: async () => null, markUsed: async () => {}, lastIssuedAt: async () => null },
      tokenGenerator: { next: () => ({ token: 'a', tokenHash: 'b' }) },
      mailer: { sendResetLink: async () => {} },
      clock: { now: () => new Date('2026-10-12T12:00:00Z') },
      rateLimiter: { check: async () => ({ allowed: false, retryAfterSeconds: 42 }) },
      recordAudit: async () => {},
      baseUrl: 'https://x',
    })
    const result = await requestPasswordReset({ username: 'victor.medeiros', origin: '203.0.113.9' })
    expect(result).toEqual({ ok: false, reason: 'rate_limited', retryAfterSeconds: 42 })
    await backgroundWork()
    expect(issue).not.toHaveBeenCalled()
  })
})
