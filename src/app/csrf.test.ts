import { afterEach, describe, expect, it, vi } from 'vitest'
import { csrfProtection } from './csrf'

const run = async (headers: Record<string, string>, handlerType: 'serverFn' | 'router' = 'serverFn') => {
  const request = new Request('http://10.0.0.5:3000/_serverFn/abc', { method: 'POST', headers })
  const next = vi.fn(async () => undefined)
  const result = await csrfProtection.options.server?.({ request, handlerType, next } as never)
  return result instanceof Response ? result.status : 'passed'
}

afterEach(() => vi.unstubAllEnvs())

describe('csrfProtection', () => {
  it('refuses a cross-site or same-site server function call', async () => {
    expect(await run({ 'sec-fetch-site': 'cross-site' })).toBe(403)
    expect(await run({ 'sec-fetch-site': 'same-site' })).toBe(403)
  })

  it('lets a same-origin server function call through', async () => {
    expect(await run({ 'sec-fetch-site': 'same-origin' })).toBe('passed')
  })

  it('without Sec-Fetch-Site, accepts only the public origins of the app', async () => {
    vi.stubEnv('APP_PUBLIC_URL', 'https://reforma.austercontabil.com.br')
    vi.stubEnv('BETTER_AUTH_URL', 'https://reforma.austercontabil.com.br/')
    expect(await run({ origin: 'https://reforma.austercontabil.com.br' })).toBe('passed')
    expect(await run({ origin: 'http://10.0.0.5:3000' })).toBe('passed')
    expect(await run({ origin: 'https://legado.austercontabil.com.br' })).toBe(403)
    expect(await run({})).toBe(403)
  })

  it('leaves pages and server routes alone', async () => {
    expect(await run({ 'sec-fetch-site': 'cross-site' }, 'router')).toBe('passed')
  })
})
