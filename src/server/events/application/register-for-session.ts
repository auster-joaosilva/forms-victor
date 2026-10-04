import { sessionLabel } from '../domain/event'
import { checkRegistration } from '../domain/registration'
import type { EventsAuditRecorder } from '../ports/audit-recorder'
import type { Clock } from '../ports/clock'
import type { EventRepository } from '../ports/event-repository'
import type { ProtocolGenerator } from '../ports/protocol-generator'
import type { RateLimiter } from '../ports/rate-limiter'
import type { RegistrationRepository } from '../ports/registration-repository'
import type { ResponseLookup } from '../ports/response-lookup'

export const REGISTRATION_USER_AGENT_LIMIT = 300
export const TOO_MANY_SUBMISSIONS = 'muitos envios seguidos; tente daqui a pouco'
const PROTOCOL_ATTEMPTS = 10

export interface SubmissionOrigin {
  ip: string | null
  source: string
  chain: string | null
}

export interface RegistrationReceipt {
  protocol: string
  repeated: boolean
  sessionLabel: string
  name: string
  email: string
}

export type RegisterResult =
  | { ok: true; receipt: RegistrationReceipt }
  | { ok: false; status: 409 | 422 | 429; error: string; retryAfterSeconds?: number }

const slugOf = (body: unknown): string =>
  body && typeof body === 'object' && 'evento' in body && typeof body.evento === 'string' ? body.evento : ''

export function makeRegisterForSession(deps: {
  events: Pick<EventRepository, 'findBySlug'>
  registrations: Pick<RegistrationRepository, 'register'>
  responses: ResponseLookup
  protocols: ProtocolGenerator
  clock: Clock
  rateLimiter: RateLimiter
  recordAudit: EventsAuditRecorder
}) {
  return async function registerForSession({ body, origin, userAgent }: { body: unknown; origin: SubmissionOrigin; userAgent: string | null }): Promise<RegisterResult> {
    // Como no portal antigo, o limite vem antes de ler o corpo: quem dispara envios não ganha validação de graça.
    const decision = await deps.rateLimiter.check('event-registration', origin.ip)
    if (!decision.allowed) return { ok: false, status: 429, error: TOO_MANY_SUBMISSIONS, retryAfterSeconds: decision.retryAfterSeconds }

    const slug = slugOf(body)
    const event = slug ? await deps.events.findBySlug(slug) : null
    const check = checkRegistration(body, event)
    if (!check.ok) return { ok: false, status: 422, error: check.error }
    // checkRegistration já recusou evento ausente, e a sessão é uma das dele.
    const registration = check.value
    const session = event?.sessions.find((candidate) => candidate.id === registration.sessionId)
    // Defesa: o repositório lança se a sessão não é do evento, então nunca chega a ele sem uma sessão conferida.
    if (!event || !session) return { ok: false, status: 422, error: 'escolha um dos encontros' }

    const now = deps.clock.now()
    const responseId = registration.cnpjDigits ? await deps.responses.latestByCnpjDigits(registration.cnpjDigits) : null
    const agent = userAgent?.slice(0, REGISTRATION_USER_AGENT_LIMIT) || null
    // O mesmo objeto que o portal antigo guardava no `pacote` da inscrição.
    const payload = {
      evento: event.slug,
      eventoId: event.id,
      sessaoId: session.id,
      nome: registration.name,
      email: registration.email,
      telefone: registration.phone,
      empresa: registration.company,
      cnpj: registration.cnpj,
      cargo: registration.jobTitle,
      aceiteLgpd: true,
      origem: origin.ip,
      comoObtido: origin.source,
      cadeia: origin.chain,
      agente: agent,
    }
    const receipt = (protocol: string, repeated: boolean): RegistrationReceipt => ({
      protocol, repeated, sessionLabel: sessionLabel(session), name: registration.name, email: registration.email,
    })

    for (let attempt = 0; attempt < PROTOCOL_ATTEMPTS; attempt++) {
      const result = await deps.registrations.register({
        protocol: deps.protocols.next(now),
        responseId,
        ...registration,
        originIp: origin.ip,
        userAgent: agent,
        payload,
      })
      if (result.kind === 'protocol_taken') continue
      if (result.kind === 'full') return { ok: false, status: 409, error: 'sessão sem vaga' }
      if (result.kind === 'repeated') return { ok: true, receipt: receipt(result.protocol, true) }
      // A inscrição já está gravada: falha na auditoria vai para o log, senão a pessoa reenvia achando que não entrou.
      try {
        await deps.recordAudit({ action: 'registration_received', reference: result.protocol, detail: { event: event.id, session: session.id } })
      } catch (error) {
        console.error('falha ao auditar registration_received', error)
      }
      return { ok: true, receipt: receipt(result.protocol, false) }
    }
    return { ok: false, status: 409, error: 'não foi possível gerar o protocolo' }
  }
}
