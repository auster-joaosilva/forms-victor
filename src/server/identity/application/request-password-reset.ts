import { isDeliverableEmail } from '../domain/contact'
import { tokenExpiry } from '../domain/reset-token'
import type { UserAccount } from '../domain/user'
import type { Clock } from '../ports/clock'
import type { PasswordResetTokens } from '../ports/password-reset-tokens'
import type { RateLimiter } from '../ports/rate-limiter'
import type { ResetMailer } from '../ports/reset-mailer'
import type { TokenGenerator } from '../ports/token-generator'
import type { UserAccounts } from '../ports/user-accounts'

export type RequestPasswordResetResult = { ok: true } | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }

type AuditRecorder = (entry: { action: 'password_reset_requested'; actorUsername: string; reference: string }) => Promise<void>

// Spec, seção 2: no máximo um envio ao mesmo usuário a cada 10 minutos, em silêncio. Sem isso, pedidos repetidos
// derrubam o link anterior a cada vez — inclusive o de 48h que o admin acabou de mandar.
const MIN_INTERVAL_MS = 10 * 60 * 1000

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
  async function issueAndSend(user: UserAccount): Promise<void> {
    const now = deps.clock.now()
    const lastIssuedAt = await deps.tokens.lastIssuedAt(user.id)
    if (lastIssuedAt && now.getTime() - lastIssuedAt.getTime() < MIN_INTERVAL_MS) return
    const { token, tokenHash } = deps.tokenGenerator.next()
    await deps.tokens.issue({ userId: user.id, tokenHash, expiresAt: tokenExpiry(now) })
    await deps.mailer.sendResetLink(user.email, `${deps.baseUrl}/reset-password?token=${token}`)
    await deps.recordAudit({ action: 'password_reset_requested', actorUsername: user.username, reference: user.id })
  }

  return async function requestPasswordReset({ username, origin }: { username: string; origin: string | null }): Promise<RequestPasswordResetResult> {
    const decision = await deps.rateLimiter.check('password-reset-request', origin)
    if (!decision.allowed) return { ok: false, reason: 'rate_limited', retryAfterSeconds: decision.retryAfterSeconds }

    const user = await deps.accounts.findByUsername(username.trim().toLowerCase())
    if (user && user.active && isDeliverableEmail(user.email)) {
      // Sem await (R4): a resposta sai no mesmo tempo exista ou não o usuário, e falha de gravação ou de envio nunca
      // chega a quem pediu. O token já gravado não se desfaz por falha de envio: registra e segue (AGENTS.md, E-mail).
      void issueAndSend(user).catch((error: unknown) => console.error('falha ao emitir ou enviar o link de redefinição de senha', error))
    }
    return { ok: true }
  }
}
