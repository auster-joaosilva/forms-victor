import { isNameInQsa, type CompanyData } from '../domain/company'
import type { CompanyRegistry } from '../ports/company-registry'

export type CompanyLookup =
  | { ok: false; reason: 'cnpj incompleto' | 'tempo esgotado' | 'indisponível' | `HTTP ${number}` }
  | { ok: true; company: CompanyData; requesterInQsa: boolean | null }

export const makeLookupCompany =
  (registry: CompanyRegistry) =>
  async ({ cnpj, requesterName }: { cnpj: string; requesterName?: string }): Promise<CompanyLookup> => {
    const digits = cnpj.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    if (digits.length !== 14) return { ok: false, reason: 'cnpj incompleto' }
    const result = await registry.find(digits)
    if (!result.ok) return result
    return {
      ok: true,
      company: result.company,
      requesterInQsa: requesterName ? isNameInQsa(requesterName, result.partners) : null,
    }
  }
