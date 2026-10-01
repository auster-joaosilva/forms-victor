import type { Answers } from './question-types'

export interface CompanyBadge {
  legalName: string
  city: string
  state: string
  simplesOptant: boolean | null
  meiOptant: boolean | null
  active: boolean
  registrationStatus: string
}

export type CompanyBadgeLookup = { ok: true; company: CompanyBadge; requesterInQsa: boolean | null } | { ok: false; reason: string }

export type CompanyBadgeResult =
  | { ok: true; company: CompanyBadgeSource; requesterInQsa: boolean | null }
  | { ok: false; reason: string }

export interface CompanyBadgeSource {
  legalName: string | null
  city: string | null
  state: string | null
  simplesOptant: boolean | null
  meiOptant: boolean | null
  active: boolean
  registrationStatus: string | null
}

export const toCompanyBadge = (company: CompanyBadgeSource): CompanyBadge => ({
  legalName: company.legalName ?? '',
  city: company.city ?? '',
  state: company.state ?? '',
  simplesOptant: company.simplesOptant,
  meiOptant: company.meiOptant,
  active: company.active,
  registrationStatus: company.registrationStatus ?? '',
})

// The only exit of the registry data: the partners (QSA) are dropped here and only the requester check goes on.
export const toCompanyBadgeLookup = (result: CompanyBadgeResult): CompanyBadgeLookup =>
  result.ok ? { ok: true, company: toCompanyBadge(result.company), requesterInQsa: result.requesterInQsa } : { ok: false, reason: result.reason }

// Only what the respondent left blank is filled: the registry never overwrites an answer.
export function applyCompanyPrefill(answers: Answers, company: CompanyBadge): Answers {
  const next = { ...answers }
  if (company.legalName && !next.nomeEmpresa) next.nomeEmpresa = company.legalName
  if (!next.ehSimei) next.ehSimei = company.meiOptant ? 'sim' : 'nao'
  if (!next.regimeAtual && company.simplesOptant) next.regimeAtual = 'simples'
  return next
}
