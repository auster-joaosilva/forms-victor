import { describe, expect, it } from 'vitest'
import { makeCheckRateLimit } from '@/server/rate-limit/application/check-rate-limit'
import type { RateLimitStore } from '@/server/rate-limit/ports/rate-limit-store'
import type { CompanyRegistry } from '../ports/company-registry'
import type { RateLimitDecision, RateLimiter } from '../ports/rate-limiter'
import { makeLookupCompany } from './lookup-company'

function recordingLimiter(decision: RateLimitDecision = { allowed: true }) {
  const calls: [string, string | null][] = []
  const limiter: RateLimiter = {
    check: async (route, origin) => {
      calls.push([route, origin])
      return decision
    },
  }
  return { calls, limiter }
}

function countingRegistry() {
  let calls = 0
  const registry: CompanyRegistry = {
    find: async () => {
      calls++
      return { ok: true, company: { legalName: 'X' } as never, partners: [] }
    },
  }
  return { registry, calls: () => calls }
}

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

describe('lookupCompany', () => {
  it('returns company data and the QSA check, never the partner list', async () => {
    const lookup = makeLookupCompany(
      { find: async () => ({ ok: true, company: { legalName: 'X' } as never, partners: [{ name: 'MARIA SOUZA' }] }) },
      recordingLimiter().limiter,
    )
    const result = await lookup({ cnpj: '11.222.333/0001-81', requesterName: 'Maria Souza', origin: '1.1.1.1' })
    expect(result).toEqual({ ok: true, company: { legalName: 'X' }, requesterInQsa: true })
    expect(JSON.stringify(result)).not.toContain('partners')
  })

  it('refuses an incomplete cnpj without counting it and without calling the registry', async () => {
    const registry = countingRegistry()
    const rate = recordingLimiter()
    const lookup = makeLookupCompany(registry.registry, rate.limiter)
    expect(await lookup({ cnpj: '11.222', origin: '1.1.1.1' })).toEqual({ ok: false, reason: 'cnpj incompleto' })
    expect(registry.calls()).toBe(0)
    expect(rate.calls).toEqual([])
  })

  it('answers indisponível without calling the registry when the origin is over the limit', async () => {
    const registry = countingRegistry()
    const rate = recordingLimiter({ allowed: false, retryAfterSeconds: 30 })
    const lookup = makeLookupCompany(registry.registry, rate.limiter)
    expect(await lookup({ cnpj: '11.222.333/0001-81', origin: '1.1.1.1' })).toEqual({ ok: false, reason: 'indisponível' })
    expect(registry.calls()).toBe(0)
    expect(rate.calls).toEqual([['cnpj-lookup', '1.1.1.1']])
  })

  it('passes a missing origin as null to the limiter', async () => {
    const rate = recordingLimiter()
    await makeLookupCompany(countingRegistry().registry, rate.limiter)({ cnpj: '11.222.333/0001-81', origin: null })
    expect(rate.calls).toEqual([['cnpj-lookup', null]])
  })

  it('blocks the 31st lookup of the hour from the same origin before the registry', async () => {
    const check = makeCheckRateLimit(memoryStore())
    let now = new Date(Date.UTC(2026, 9, 1, 12, 0, 5))
    const limiter: RateLimiter = { check: (route, origin) => check({ route, origin, now }) }
    const registry = countingRegistry()
    const lookup = makeLookupCompany(registry.registry, limiter)
    for (let minute = 0; minute < 6; minute++) {
      now = new Date(Date.UTC(2026, 9, 1, 12, minute, 5))
      for (let i = 0; i < 5; i++) expect((await lookup({ cnpj: '11.222.333/0001-81', origin: '9.9.9.9' })).ok).toBe(true)
    }
    now = new Date(Date.UTC(2026, 9, 1, 12, 10, 0))
    expect(await lookup({ cnpj: '11.222.333/0001-81', origin: '9.9.9.9' })).toEqual({ ok: false, reason: 'indisponível' })
    expect(registry.calls()).toBe(30)
  })
})
