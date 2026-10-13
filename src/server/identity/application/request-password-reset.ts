import { isDeliverableEmail } from '../domain/contact'
import { tokenExpiry } from '../domain/reset-token'
import type { Clock } from '../ports/clock'
import type { PasswordResetTokens } from '../ports/password-reset-tokens'
import type { RateLimiter } from '../ports/rate-limiter'
import type { ResetMailer } from '../ports/reset-mailer'
import type { TokenGenerator } from '../ports/token-generator'
import type { UserAccounts } from '../ports/user-accounts'

export type RequestPasswordResetResult = { ok: true } | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }

type AuditRecorder = (entry: { action: 'password_reset_requested'; actorUsername: string; reference: string }) => Promise<void>

export function makeRequestPasswordReset(deps: {
  accounts: UserAccounts
  tokens: PasswordResetTokens
  tokenGenerator: TokenGenerator
  mailer: ResetMailer
  clock: Clock
  rateLimiter: RateLimiter
  recordAudit: AuditRecorder
  baseUrl: string
}) {
  return async function requestPasswordReset({ username, origin }: { username: string; origin: string | null }): Promise<RequestPasswordResetResult> {
    const decision = await deps.rateLimiter.check('password-reset-request', origin)
    if (!decision.allowed) return { ok: false, reason: 'rate_limited', retryAfterSeconds: decision.retryAfterSeconds }

    // A resposta é a mesma a partir daqui, exista ou não o usuário (R4): ninguém descobre quem tem conta pelo tempo de resposta.
    const user = await deps.accounts.findByUsername(username.trim().toLowerCase())
    if (user && user.active && isDeliverableEmail(user.email)) {
      const now = deps.clock.now()
      const { token, tokenHash } = deps.tokenGenerator.next()
      await deps.tokens.issue({ userId: user.id, tokenHash, expiresAt: tokenExpiry(now) })
      await deps.mailer.sendResetLink(user.email, `${deps.baseUrl}/reset-password?token=${token}`)
      await deps.recordAudit({ action: 'password_reset_requested', actorUsername: user.username, reference: user.id })
    }
    return { ok: true }
  }
}
