import { describe, expect, it } from 'vitest'
import type { RateLimitStore } from '../ports/rate-limit-store'
import { makeCheckRateLimit } from './check-rate-limit'

function memoryStore(): RateLimitStore {
  const counts = new Map<string, number>()
  return {
    async increment(key, start) {
      const id = `${key}|${start.toISOString()}`
      const next = (counts.get(id) ?? 0) + 1
      counts.set(id, next)
      return next
    },
    async purgeBefore() {},
  }
}

describe('checkRateLimit', () => {
  const now = new Date('2026-10-01T12:00:10Z')
  it('allows five per minute and blocks the sixth', async () => {
    const check = makeCheckRateLimit(memoryStore())
    for (let i = 0; i < 5; i++) expect(await check({ route: '/diagnosis', origin: '1.1.1.1', now })).toEqual({ allowed: true })
    expect(await check({ route: '/diagnosis', origin: '1.1.1.1', now })).toEqual({ allowed: false, retryAfterSeconds: 50 })
  })
  it('keeps origins apart', async () => {
    const check = makeCheckRateLimit(memoryStore())
    for (let i = 0; i < 5; i++) await check({ route: '/diagnosis', origin: '1.1.1.1', now })
    expect(await check({ route: '/diagnosis', origin: '2.2.2.2', now })).toEqual({ allowed: true })
  })
  it('blocks after thirty in the hour', async () => {
    const check = makeCheckRateLimit(memoryStore())
    for (let minute = 0; minute < 6; minute++) {
      const at = new Date(Date.UTC(2026, 9, 1, 12, minute, 5))
      for (let i = 0; i < 5; i++) await check({ route: '/r', origin: 'o', now: at })
    }
    const result = await check({ route: '/r', origin: 'o', now: new Date(Date.UTC(2026, 9, 1, 12, 10, 0)) })
    expect(result).toEqual({ allowed: false, retryAfterSeconds: 3000 })
  })
})
