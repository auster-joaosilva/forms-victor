import { describe, expect, it } from 'vitest'
import { MINIMUM_PASSWORD, USERNAME_RULE, assertKeepsAnAdmin, assertMayChange, assertPassword, meetsPasswordRule, normalizeUsername } from './user-rules'
import type { UserAccount } from './user'

const admin: UserAccount = { id: 'a', username: 'ana', name: 'Ana', role: 'admin', active: true, lastLoginAt: null, createdAt: new Date(0) }
const team: UserAccount = { ...admin, id: 't', username: 'bia', role: 'operator' }

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

describe('user rules', () => {
  it('normalizes usernames', () => {
    expect(normalizeUsername('  Ana.Souza ')).toBe('ana.souza')
    expect(() => normalizeUsername('1ana')).toThrow(/começando por letra/)
  })
  it('lets team members change only their own password', () => {
    expect(() => assertMayChange({ id: 't', username: 'bia', role: 'operator' }, team, { password: 'x'.repeat(12) })).not.toThrow()
    expect(() => assertMayChange({ id: 't', username: 'bia', role: 'operator' }, team, { name: 'B' })).toThrow('só administrador')
    expect(() => assertMayChange({ id: 't', username: 'bia', role: 'operator' }, admin, { password: 'x'.repeat(12) })).toThrow('só administrador')
  })
  it('refuses to remove the last active admin', () => {
    expect(() => assertKeepsAnAdmin(admin, { active: false }, 1)).toThrow(/único administrador/)
    expect(() => assertKeepsAnAdmin(admin, { role: 'operator' }, 2)).not.toThrow()
    for (const role of ['manager', 'regularization', 'operator'] as const) {
      expect(() => assertKeepsAnAdmin(admin, { role }, 1)).toThrow(/único administrador/)
    }
    expect(() => assertKeepsAnAdmin(admin, { role: 'admin' }, 1)).not.toThrow()
  })
  it('lets only the admin change other users, whatever the other role', () => {
    for (const role of ['manager', 'regularization', 'operator'] as const) {
      expect(() => assertMayChange({ id: 't', username: 'bia', role }, team, { name: 'B' })).toThrow('só administrador')
      expect(() => assertMayChange({ id: 't', username: 'bia', role }, team, { password: 'x'.repeat(12) })).not.toThrow()
    }
  })
  it('matches the auth configuration', { timeout: 20_000 }, async () => {
    const shared = await import('@/server/shared/auth/auth')
    expect(USERNAME_RULE.source).toBe(shared.USERNAME_RULE.source)
    expect(MINIMUM_PASSWORD).toBe(shared.MINIMUM_PASSWORD)
  })
})
