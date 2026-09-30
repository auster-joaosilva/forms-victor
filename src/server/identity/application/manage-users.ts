import { IdentityError, type Actor, type Role, type UserChanges } from '../domain/user'
import { assertKeepsAnAdmin, assertMayChange, assertPassword, normalizeUsername } from '../domain/user-rules'
import type { UserAccounts } from '../ports/user-accounts'

type AuditRecorder = (entry: { action: 'user_created' | 'user_updated'; actorId: string; actorUsername: string; reference: string; detail: Record<string, unknown> }) => Promise<void>

export function makeManageUsers({ accounts, recordAudit }: { accounts: UserAccounts; recordAudit: AuditRecorder }) {
  return {
    listUsers: () => accounts.list(),

    async createUser(actor: Actor, input: { username: string; name: string; password: string; role: Role }) {
      if (actor.role !== 'admin') throw new IdentityError('forbidden')
      const username = normalizeUsername(input.username)
      assertPassword(input.password)
      if (await accounts.findByUsername(username)) throw new IdentityError('username_taken')
      const created = await accounts.create({ username, name: input.name.trim() || username, password: input.password, role: input.role })
      await recordAudit({ action: 'user_created', actorId: actor.id, actorUsername: actor.username, reference: username, detail: { role: input.role } })
      return created
    },

    async updateUser(actor: Actor, rawUsername: string, changes: UserChanges) {
      const target = await accounts.findByUsername(normalizeUsername(rawUsername))
      if (!target) throw new IdentityError('not_found')
      assertMayChange(actor, target, changes)
      assertKeepsAnAdmin(target, changes, await accounts.countActiveAdmins())
      if (changes.password !== undefined) assertPassword(changes.password)
      if (changes.name !== undefined) await accounts.rename(target.id, changes.name.trim())
      if (changes.role !== undefined) await accounts.setRole(target.id, changes.role)
      if (changes.active !== undefined) await accounts.setActive(target.id, changes.active)
      if (changes.password !== undefined) await accounts.setPassword(target.id, changes.password)
      const changed = Object.keys(changes).filter((key) => changes[key as keyof UserChanges] !== undefined)
      await recordAudit({ action: 'user_updated', actorId: actor.id, actorUsername: actor.username, reference: target.username, detail: { changed } })
    },
  }
}
