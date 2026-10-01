import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookies = vi.hoisted(() => ({ getCookie: vi.fn(), setCookie: vi.fn(), deleteCookie: vi.fn() }))
vi.mock('@tanstack/react-start/server', () => cookies)

import {
  ADHESION_RECEIPT_COOKIE,
  adhesionReceiptCookieOptions,
  clearAdhesionReceiptCookie,
  readAdhesionReceiptCookie,
  writeAdhesionReceiptCookie,
} from './adhesion-receipt-cookie'

const TOKEN = '0123456789abcdef'.repeat(4)

describe('adhesion receipt cookie', () => {
  beforeEach(() => vi.clearAllMocks())

  it('é httpOnly, Lax, sete dias, no caminho raiz, e Secure só em produção', () => {
    expect(adhesionReceiptCookieOptions('production')).toEqual({ httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 604_800 })
    expect(adhesionReceiptCookieOptions('test').secure).toBe(false)
  })

  it('lê só um token de 64 hexadecimais minúsculos', () => {
    for (const forged of [undefined, '', TOKEN.toUpperCase(), TOKEN.slice(1), `${TOKEN}0`, `${TOKEN.slice(0, 63)}g`, "1' OR '1'='1", '5']) {
      cookies.getCookie.mockReturnValueOnce(forged)
      expect(readAdhesionReceiptCookie()).toBeNull()
    }
    cookies.getCookie.mockReturnValueOnce(TOKEN)
    expect(readAdhesionReceiptCookie()).toBe(TOKEN)
    expect(cookies.getCookie).toHaveBeenCalledWith(ADHESION_RECEIPT_COOKIE)
  })

  it('grava o token e apaga no caminho raiz', () => {
    writeAdhesionReceiptCookie(TOKEN)
    expect(cookies.setCookie).toHaveBeenCalledWith(ADHESION_RECEIPT_COOKIE, TOKEN, adhesionReceiptCookieOptions())
    clearAdhesionReceiptCookie()
    expect(cookies.deleteCookie).toHaveBeenCalledWith(ADHESION_RECEIPT_COOKIE, { path: '/' })
  })
})
