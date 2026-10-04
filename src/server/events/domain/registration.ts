import { normalizeCnpj } from '../../shared/domain/validation'
import type { EventView } from './event'

export interface RegistrationInput {
  evento: string
  sessaoId: number
  nome: string
  email: string
  telefone: string
  empresa: string
  cnpj: string
  cargo: string
  aceite: boolean
}

export interface NormalizedRegistration {
  eventId: number
  sessionId: number
  name: string
  email: string
  phone: string | null
  company: string | null
  cnpj: string | null
  cnpjDigits: string | null
  jobTitle: string | null
}

export type RegistrationCheck = { ok: true; value: NormalizedRegistration } | { ok: false; status: 422; error: string }

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/

export const cnpjDigitsOf = (raw: string): string => normalizeCnpj(raw)

const refuse = (error: string): RegistrationCheck => ({ ok: false, status: 422, error })
const field = (body: Record<string, unknown>, key: string): string => {
  const value = body[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}
const optional = (value: string, max: number): string | null => value.slice(0, max) || null

// Mesma ordem do conferirInscricao: o aceite vem antes do evento, e o servidor não confere dígito do CNPJ nem exige telefone.
// O evento é procurado por quem chama (pelo body.evento) antes desta função; por isso ela recebe null quando não acha.
export function checkRegistration(body: unknown, event: EventView | null): RegistrationCheck {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return refuse('corpo inválido')
  const input = body as Record<string, unknown>
  if (input.aceite !== true) return refuse('sem o aceite de privacidade')
  if (!event) return refuse('evento não encontrado')
  if (event.status !== 'published') return refuse('evento não está publicado')
  if (event.registrations !== 'open') return refuse('as inscrições estão encerradas')
  const session = event.sessions.find((item) => item.id === Number(input.sessaoId))
  if (!session) return refuse('escolha um dos encontros')
  const name = field(input, 'nome')
  if (!name) return refuse('falta o seu nome')
  const email = field(input, 'email')
  if (!email) return refuse('falta o e-mail')
  if (!EMAIL.test(email)) return refuse('e-mail inválido')
  const cnpj = field(input, 'cnpj')
  if (cnpj && cnpjDigitsOf(cnpj).length !== 14) return refuse('CNPJ incompleto')
  return {
    ok: true,
    value: {
      eventId: event.id,
      sessionId: session.id,
      name: name.slice(0, 120),
      email: email.slice(0, 160),
      phone: optional(field(input, 'telefone'), 40),
      company: optional(field(input, 'empresa'), 160),
      cnpj: cnpj || null,
      cnpjDigits: cnpj ? cnpjDigitsOf(cnpj) : null,
      jobTitle: optional(field(input, 'cargo'), 60),
    },
  }
}
