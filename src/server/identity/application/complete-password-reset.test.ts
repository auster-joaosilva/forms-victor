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
    lastIssuedAt: async () => null,
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
