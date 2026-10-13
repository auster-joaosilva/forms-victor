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
