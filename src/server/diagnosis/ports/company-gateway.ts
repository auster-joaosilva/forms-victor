import type { CompanyBadgeLookup } from '../domain/company-badge'

export interface CompanyGateway {
  lookup(input: { cnpj: string; requesterName?: string }): Promise<CompanyBadgeLookup>
}
