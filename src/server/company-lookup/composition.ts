import { checkRateLimit } from '@/server/rate-limit/composition'
import { createBrasilApiCompanyRegistry } from './adapters/brasilapi-company-registry'
import { makeLookupCompany } from './application/lookup-company'
import type { RateLimiter } from './ports/rate-limiter'

const rateLimiter: RateLimiter = { check: (route, origin) => checkRateLimit({ route, origin }) }

export const lookupCompany = makeLookupCompany(createBrasilApiCompanyRegistry({ fetch: globalThis.fetch, timeoutMs: 4000 }), rateLimiter)
export type { CompanyLookup, LookupCompanyInput } from './application/lookup-company'
export type { CompanyData } from './domain/company'
