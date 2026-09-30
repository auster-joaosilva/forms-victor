import { describe, expect, it } from 'vitest'
import type { UserAccount } from '../domain/user'
import type { UserAccounts } from '../ports/user-accounts'
import { makeManageUsers } from './manage-users'

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
