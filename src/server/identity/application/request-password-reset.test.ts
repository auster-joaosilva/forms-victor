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
