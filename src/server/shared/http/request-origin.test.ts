import { describe, expect, it } from 'vitest'
import { requestOrigin } from './request-origin'

const headers = (entries: Record<string, string>) => new Headers(entries)

describe('requestOrigin', () => {
  it('uses Traefik, then the first forwarded hop, then the socket', () => {
    expect(requestOrigin(headers({ 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3, 4.4.4.4' }))).toEqual({ ip: '2.2.2.2', source: 'x-real-ip', chain: '3.3.3.3, 4.4.4.4' })
    expect(requestOrigin(headers({ 'x-forwarded-for': '3.3.3.3, 4.4.4.4' }))).toEqual({ ip: '3.3.3.3', source: 'x-forwarded-for', chain: '3.3.3.3, 4.4.4.4' })
    expect(requestOrigin(headers({}), '::ffff:5.5.5.5')).toEqual({ ip: '5.5.5.5', source: 'socket', chain: null })
  })

  it('trusts CF-Connecting-IP when the peer is a Cloudflare IPv4 edge', () => {
    expect(requestOrigin(headers({ 'cf-connecting-ip': '1.1.1.1', 'x-real-ip': '172.68.10.20', 'x-forwarded-for': '1.1.1.1, 172.68.10.20' }))).toEqual({
      ip: '1.1.1.1',
      source: 'cf-connecting-ip',
      chain: '1.1.1.1, 172.68.10.20',
    })
  })

  it('trusts CF-Connecting-IP when the peer is a Cloudflare IPv6 edge', () => {
    expect(requestOrigin(headers({ 'cf-connecting-ip': '2804:14c::1', 'x-real-ip': '2a06:98c1:3120::3' }))).toEqual({
      ip: '2804:14c::1',
      source: 'cf-connecting-ip',
      chain: null,
    })
  })

  it('ignores a forged CF-Connecting-IP from a peer outside Cloudflare', () => {
    expect(requestOrigin(headers({ 'cf-connecting-ip': '1.1.1.1', 'x-real-ip': '2.2.2.2' }))).toEqual({ ip: '2.2.2.2', source: 'x-real-ip', chain: null })
    expect(requestOrigin(headers({ 'cf-connecting-ip': '1.1.1.1', 'x-real-ip': '2a06:98c8::1' }))).toEqual({ ip: '2a06:98c8::1', source: 'x-real-ip', chain: null })
    expect(requestOrigin(headers({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '172.68.10.20' }))).toEqual({ ip: '172.68.10.20', source: 'x-forwarded-for', chain: '172.68.10.20' })
    expect(requestOrigin(headers({ 'cf-connecting-ip': '1.1.1.1' }), '9.9.9.9')).toEqual({ ip: '9.9.9.9', source: 'socket', chain: null })
  })

  it('has no IP without headers or socket', () => {
    expect(requestOrigin(headers({}))).toEqual({ ip: null, source: 'socket', chain: null })
    expect(requestOrigin(headers({ 'cf-connecting-ip': '1.1.1.1' }))).toEqual({ ip: null, source: 'socket', chain: null })
  })
})
