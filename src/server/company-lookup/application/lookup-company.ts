import { isNameInQsa, type CompanyData } from '../domain/company'
import type { CompanyRegistry } from '../ports/company-registry'
import type { RateLimiter } from '../ports/rate-limiter'

export type CompanyLookup =
  | { ok: false; reason: 'cnpj incompleto' | 'tempo esgotado' | 'indisponível' | `HTTP ${number}` }
  | { ok: true; company: CompanyData; requesterInQsa: boolean | null }

export interface LookupCompanyInput {
  cnpj: string
  requesterName?: string
  origin: string | null
}

// Estourado o limite, a resposta é a mesma da BrasilAPI fora do ar: a tela já sabe tratar, sem texto novo.
export const makeLookupCompany =
  (registry: CompanyRegistry, rateLimiter: RateLimiter) =>
  async ({ cnpj, requesterName, origin }: LookupCompanyInput): Promise<CompanyLookup> => {
    const digits = cnpj.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    if (digits.length !== 14) return { ok: false, reason: 'cnpj incompleto' }
    const decision = await rateLimiter.check('cnpj-lookup', origin)
    if (!decision.allowed) return { ok: false, reason: 'indisponível' }
    const result = await registry.find(digits)
    if (!result.ok) return result
    return {
      ok: true,
      company: result.company,
      requesterInQsa: requesterName ? isNameInQsa(requesterName, result.partners) : null,
    }
  }
