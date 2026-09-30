import { createBrasilApiCompanyRegistry } from './adapters/brasilapi-company-registry'
import { makeLookupCompany } from './application/lookup-company'

export const lookupCompany = makeLookupCompany(createBrasilApiCompanyRegistry({ fetch: globalThis.fetch, timeoutMs: 4000 }))
export type { CompanyLookup } from './application/lookup-company'
export type { CompanyData } from './domain/company'
