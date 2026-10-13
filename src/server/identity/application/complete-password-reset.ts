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
