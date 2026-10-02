import { describe, expect, it, vi } from 'vitest'
import { guardSubmit } from './guard-submit'

describe('guardSubmit', () => {
  it('devolve o resultado do caso de uso quando ele responde', async () => {
    expect(await guardSubmit(async () => ({ ok: false as const, error: 'corpo inválido' }))).toEqual({
      ok: false,
      error: 'corpo inválido',
    })
  })

  it('transforma exceção em recusa genérica e registra no servidor', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const result = await guardSubmit(async () => {
      throw new Error('Prisma: connection refused')
    })
    expect(result).toEqual({ ok: false, error: 'não foi possível registrar' })
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
