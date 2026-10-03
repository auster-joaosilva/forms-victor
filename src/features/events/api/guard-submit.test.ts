import { describe, expect, it, vi } from 'vitest'
import { REGISTRATION_FALLBACK, guardRegistration } from './guard-submit'

describe('guardRegistration', () => {
  it('passes the use case result through, dropping nothing the screen needs', async () => {
    const receipt = { protocol: 'INS-20261018-AB2CD', repeated: false, sessionLabel: 'x', name: 'Ana', email: 'ana@x.com.br' }
    await expect(guardRegistration(async () => ({ ok: true as const, receipt }))).resolves.toEqual({ ok: true, receipt })
    await expect(guardRegistration(async () => ({ ok: false as const, status: 409 as const, error: 'sessão sem vaga' }))).resolves.toEqual({
      ok: false,
      error: 'sessão sem vaga',
    })
  })

  it('turns an unexpected failure into the generic refusal and logs it on the server', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(guardRegistration(async () => Promise.reject(new Error('relation "registrations" does not exist')))).resolves.toEqual({
      ok: false,
      error: REGISTRATION_FALLBACK,
    })
    expect(log).toHaveBeenCalledOnce()
    log.mockRestore()
  })
})
