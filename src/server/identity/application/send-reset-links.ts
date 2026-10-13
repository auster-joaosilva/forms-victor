import { isDeliverableEmail } from '../domain/contact'
import { BATCH_RESET_TOKEN_TTL_MS, tokenExpiry } from '../domain/reset-token'
import type { UserAccount } from '../domain/user'
import type { Clock } from '../ports/clock'
import type { TokenGenerator } from '../ports/token-generator'
import type { ResetMailer } from '../ports/reset-mailer'

type AuditRecorder = (entry: { action: 'password_reset_links_sent'; actorId: string; actorUsername: string; reference: string; detail: { count: number } }) => Promise<void>

export function makeSendResetLinks(deps: {
  accounts: { list(): Promise<UserAccount[]>; findByUsername(username: string): Promise<UserAccount | null> }
  tokens: { issue(token: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> }
  tokenGenerator: TokenGenerator
  mailer: ResetMailer
  clock: Clock
  recordAudit: AuditRecorder
  baseUrl: string
}) {
  return async function sendResetLinks(actor: { id: string; username: string }, input: { usernames: string[] } | { all: true }): Promise<{ sent: number }> {
    const candidates =
      'all' in input
        ? await deps.accounts.list()
        : (await Promise.all(input.usernames.map((u) => deps.accounts.findByUsername(u)))).filter((u): u is UserAccount => u !== null)

    let sent = 0
    const now = deps.clock.now()
    for (const user of candidates) {
      if (!user.active || !isDeliverableEmail(user.email)) continue
      const { token, tokenHash } = deps.tokenGenerator.next()
      await deps.tokens.issue({ userId: user.id, tokenHash, expiresAt: tokenExpiry(now, BATCH_RESET_TOKEN_TTL_MS) })
      await deps.mailer.sendResetLink(user.email, `${deps.baseUrl}/reset-password?token=${token}`)
      sent++
    }
    await deps.recordAudit({ action: 'password_reset_links_sent', actorId: actor.id, actorUsername: actor.username, reference: String(sent), detail: { count: sent } })
    return { sent }
  }
}
