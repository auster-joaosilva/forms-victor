import type { SubmitRegistrationWire } from '../types/events'

export const REGISTRATION_FALLBACK = 'não foi possível inscrever'

type UseCaseResult = { ok: true; receipt: Extract<SubmitRegistrationWire, { ok: true }>['receipt'] } | { ok: false; error: string }

// Falha inesperada vira a recusa genérica do antigo; o detalhe (banco, rede interna) fica só no log do servidor.
export async function guardRegistration(run: () => Promise<UseCaseResult>): Promise<SubmitRegistrationWire> {
  try {
    const result = await run()
    return result.ok ? { ok: true, receipt: result.receipt } : { ok: false, error: result.error }
  } catch (error) {
    console.error('event registration failed', error)
    return { ok: false, error: REGISTRATION_FALLBACK }
  }
}
