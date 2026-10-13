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
