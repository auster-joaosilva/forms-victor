import type { CompanyData } from '../domain/company'

export type RegistryResult =
  | { ok: true; company: CompanyData; partners: { name: string }[] }
  | { ok: false; reason: 'tempo esgotado' | 'indisponível' | `HTTP ${number}` }

export interface CompanyRegistry {
  find(cnpjDigits: string): Promise<RegistryResult>
}
