import { deleteCookie, getCookie, getRequest, setCookie } from '@tanstack/react-start/server'
import { getEnv } from '../env'
import { requestOrigin } from './request-origin'

export const DRAFT_COOKIE = 'draft_id'
export const DRAFT_COOKIE_MAX_AGE = 7 * 24 * 3600

export const draftCookieOptions = (nodeEnv: string = getEnv().NODE_ENV) => ({
  httpOnly: true as const,
  sameSite: 'lax' as const,
  secure: nodeEnv === 'production',
  path: '/' as const,
  maxAge: DRAFT_COOKIE_MAX_AGE,
})

export const readDraftCookie = (): string | null => getCookie(DRAFT_COOKIE) ?? null
export const writeDraftCookie = (id: string): void => setCookie(DRAFT_COOKIE, id, draftCookieOptions())
export const clearDraftCookie = (): void => deleteCookie(DRAFT_COOKIE, { path: '/' })
export const requestClientIp = (): string | null => requestOrigin(getRequest().headers).ip
