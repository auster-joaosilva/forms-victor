export const SUBMIT_FALLBACK = 'não foi possível registrar'

// Falha inesperada do caso de uso vira recusa genérica: o detalhe fica no log do servidor.
export async function guardSubmit<T extends { ok: boolean }>(
  run: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await run()
  } catch (error) {
    console.error('adhesion submit failed', error)
    return { ok: false, error: SUBMIT_FALLBACK }
  }
}
