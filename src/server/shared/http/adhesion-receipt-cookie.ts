import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { getEnv } from '../env'

export const ADHESION_RECEIPT_COOKIE = 'adhesion_receipt'
export const ADHESION_RECEIPT_MAX_AGE = 7 * 24 * 3600
const RECEIPT_TOKEN = /^[0-9a-f]{64}$/

export const adhesionReceiptCookieOptions = (nodeEnv: string = getEnv().NODE_ENV) => ({
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: nodeEnv === 'production',
  path: '/' as const,
  maxAge: ADHESION_RECEIPT_MAX_AGE,
})

// O cookie carrega um token sorteado, nunca o id: trocar 5 por 6 no navegador abriria o CPF de outra empresa.
export function readAdhesionReceiptCookie(): string | null {
  const value = getCookie(ADHESION_RECEIPT_COOKIE)
  return value && RECEIPT_TOKEN.test(value) ? value : null
}

export const writeAdhesionReceiptCookie = (token: string): void => setCookie(ADHESION_RECEIPT_COOKIE, token, adhesionReceiptCookieOptions())
export const clearAdhesionReceiptCookie = (): void => deleteCookie(ADHESION_RECEIPT_COOKIE, { path: '/' })
