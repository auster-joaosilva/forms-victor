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
  it('matches the auth configuration', { timeout: 20_000 }, async () => {
    const shared = await import('@/server/shared/auth/auth')
    expect(USERNAME_RULE.source).toBe(shared.USERNAME_RULE.source)
    expect(MINIMUM_PASSWORD).toBe(shared.MINIMUM_PASSWORD)
  })
})
