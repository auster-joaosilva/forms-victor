import { describe, expect, it } from 'vitest'
import { requestOrigin } from './request-origin'

const headers = (entries: Record<string, string>) => new Headers(entries)

describe('requestOrigin', () => {
  it('prefers Cloudflare, then Traefik, then the first forwarded hop, then the socket', () => {
    expect(requestOrigin(headers({ 'cf-connecting-ip': '1.1.1.1', 'x-real-ip': '2.2.2.2' }))).toEqual({ ip: '1.1.1.1', source: 'cf-connecting-ip', chain: null })
    expect(requestOrigin(headers({ 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3, 4.4.4.4' }))).toEqual({ ip: '2.2.2.2', source: 'x-real-ip', chain: '3.3.3.3, 4.4.4.4' })
    expect(requestOrigin(headers({ 'x-forwarded-for': '3.3.3.3, 4.4.4.4' }))).toEqual({ ip: '3.3.3.3', source: 'x-forwarded-for', chain: '3.3.3.3, 4.4.4.4' })
    expect(requestOrigin(headers({}), '::ffff:5.5.5.5')).toEqual({ ip: '5.5.5.5', source: 'socket', chain: null })
  })
})
