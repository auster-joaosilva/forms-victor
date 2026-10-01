import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookies = vi.hoisted(() => ({ getCookie: vi.fn(), setCookie: vi.fn(), deleteCookie: vi.fn(), getRequest: vi.fn() }))
vi.mock('@tanstack/react-start/server', () => cookies)

import { DRAFT_COOKIE, clearDraftCookie, draftCookieOptions, readDraftCookie, requestClientIp, writeDraftCookie } from './draft-cookie'

describe('draft cookie', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is httpOnly, Lax, seven days, and Secure only in production', () => {
    expect(draftCookieOptions('production')).toEqual({ httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 604_800 })
    expect(draftCookieOptions('test').secure).toBe(false)
  })

  it('reads, writes and clears only the id', () => {
    cookies.getCookie.mockReturnValueOnce('abc').mockReturnValueOnce(undefined)
    expect(readDraftCookie()).toBe('abc')
    expect(readDraftCookie()).toBeNull()
    writeDraftCookie('id-1')
    expect(cookies.setCookie).toHaveBeenCalledWith(DRAFT_COOKIE, 'id-1', draftCookieOptions())
    clearDraftCookie()
    expect(cookies.deleteCookie).toHaveBeenCalledWith(DRAFT_COOKIE, { path: '/' })
  })

  it('takes the client address the same way as the login rate limit', () => {
    cookies.getRequest.mockReturnValue(new Request('http://x', { headers: { 'x-real-ip': '203.0.113.9' } }))
    expect(requestClientIp()).toBe('203.0.113.9')
  })
})
