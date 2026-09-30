import { describe, expect, it } from 'vitest'
import { withSecurityHeaders } from './security-headers'

const expectSecured = (response: Response) => {
  expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  expect(response.headers.get('x-frame-options')).toBe('DENY')
  expect(response.headers.get('referrer-policy')).toBe('same-origin')
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
}

describe('withSecurityHeaders', () => {
  it('sets the headers on a mutable response', () => {
    const response = new Response('ok', { status: 201, headers: { 'x-extra': '1' } })
    const secured = withSecurityHeaders(response)
    expect(secured).toBe(response)
    expectSecured(secured)
    expect(secured.headers.get('x-extra')).toBe('1')
  })

  it('rebuilds a response whose headers are immutable', () => {
    const response = Response.redirect('https://hml-reforma.austercontabil.com.br/events', 301)
    expect(() => response.headers.set('x-probe', '1')).toThrow()
    const secured = withSecurityHeaders(response)
    expect(secured).not.toBe(response)
    expect(secured.status).toBe(301)
    expect(secured.headers.get('location')).toBe('https://hml-reforma.austercontabil.com.br/events')
    expectSecured(secured)
  })

  it('keeps the status, headers and body when rebuilding a fetched response', async () => {
    const original = await fetch('data:text/plain,corpo')
    const secured = withSecurityHeaders(original)
    expect(secured.status).toBe(200)
    expect(secured.headers.get('content-type')).toBe('text/plain')
    expect(await secured.text()).toBe('corpo')
    expectSecured(secured)
  })
})
