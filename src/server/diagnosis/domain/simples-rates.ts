import type { Answers } from './question-types'

interface RateBracket {
  upTo: number
  rate: number
  deduction: number
}

interface SimplesTable {
  confirmed: boolean
  source: string
  brackets: RateBracket[]
}

export interface DasEstimate {
  min: number
  max: number
  average: number
  issIcmsOutsideDas: boolean
  source: string
}

export type DeclaredDasStatus = 'nao_declarada' | 'sem_tabela_conferida' | 'coerente' | 'fora_do_intervalo'

// Effective rate = (RBT12 x nominal rate - deduction) / RBT12 — LC 123/2006, art. 18, § 1º-A.
// Annexes I, II and IV are not transcribed from a primary source: the portal keeps asking for the rate.
export const SIMPLES_TABLES: Record<string, SimplesTable | null> = {
  iii: {
    confirmed: true,
    source: 'LC 123/2006, Anexo III (redação da LC 155/2016)',
    brackets: [
      { upTo: 180000, rate: 0.06, deduction: 0 },
      { upTo: 360000, rate: 0.112, deduction: 9360 },
      { upTo: 720000, rate: 0.135, deduction: 17640 },
      { upTo: 1800000, rate: 0.16, deduction: 35640 },
      { upTo: 3600000, rate: 0.21, deduction: 125640 },
      { upTo: 4800000, rate: 0.33, deduction: 648000 },
    ],
  },
  v: {
    confirmed: true,
    source: 'LC 123/2006, Anexo V (redação da LC 155/2016)',
    brackets: [
      { upTo: 180000, rate: 0.155, deduction: 0 },
      { upTo: 360000, rate: 0.18, deduction: 4500 },
      { upTo: 720000, rate: 0.195, deduction: 9900 },
      { upTo: 1800000, rate: 0.205, deduction: 17100 },
      { upTo: 3600000, rate: 0.23, deduction: 62100 },
      { upTo: 4800000, rate: 0.305, deduction: 540000 },
    ],
  },
  i: null,
  ii: null,
  iv: null,
}

export const REVENUE_BAND_LIMITS: Record<string, [number, number]> = {
  ate_180k: [0, 180000],
  de_180_360k: [180000, 360000],
  de_360_720k: [360000, 720000],
  de_720k_1_8mi: [720000, 1800000],
  de_1_8_3_6mi: [1800000, 3600000],
  de_3_6_4_32mi: [3600000, 4320000],
  de_4_32_4_8mi: [4320000, 4800000],
}

// Percentage points; the last band is open (no declared ceiling above 19%).
export const DECLARED_DAS_BANDS: Record<string, [number, number]> = {
  ate_6: [0, 6],
  de_6_9: [6, 9],
  de_9_12: [9, 12],
  de_12_15: [12, 15],
  de_15_19: [15, 19],
  acima_19: [19, 40],
}

function lookup<T>(record: Record<string, T>, key: unknown): T | undefined {
  return typeof key === 'string' && Object.hasOwn(record, key) ? record[key] : undefined
}

function effectiveAt(table: SimplesTable, revenue: number): number | null {
  if (revenue <= 0) return null
  const bracket = table.brackets.find((b) => revenue <= b.upTo) ?? table.brackets.at(-1)
  if (!bracket) return null
  return ((revenue * bracket.rate - bracket.deduction) / revenue) * 100
}

// The form collects a band, not the exact RBT12, so the answer is an interval. null means "ask", never zero.
export function estimateDasRate(annex: string, revenueBand: string): DasEstimate | null {
  const table = lookup(SIMPLES_TABLES, annex)
  const limits = lookup(REVENUE_BAND_LIMITS, revenueBand)
  if (!table || !table.confirmed || !limits) return null

  // The band floor is exclusive: one real above lands in the right bracket.
  const floor = effectiveAt(table, limits[0] + 1)
  const ceiling = effectiveAt(table, limits[1])
  if (floor === null || ceiling === null) return null

  const min = Math.min(floor, ceiling)
  const max = Math.max(floor, ceiling)
  return {
    min: +min.toFixed(2),
    max: +max.toFixed(2),
    average: +((min + max) / 2).toFixed(2),
    // Above the R$ 3.6 mi sublimit, ISS and ICMS leave the DAS: the DAS rate drops, the total cost does not.
    issIcmsOutsideDas: limits[0] >= 3600000,
    source: table.source,
  }
}

function estimateFor(answers: Answers): DasEstimate | null {
  const annex = typeof answers.anexoSimples === 'string' ? answers.anexoSimples : ''
  const band = typeof answers.faixaRbt12 === 'string' ? answers.faixaRbt12 : ''
  return estimateDasRate(annex, band)
}

export function canEstimateDas(answers: Answers): boolean {
  return estimateFor(answers) !== null
}

// Never discards the declaration: many people report the nominal rate believing it is the effective one.
export function checkDeclaredDasRate(answers: Answers): {
  status: DeclaredDasStatus
  declared: [number, number] | null
  estimate: DasEstimate | null
} {
  const declared = lookup(DECLARED_DAS_BANDS, answers.aliquotaEfetivaDas) ?? null
  const estimate = estimateFor(answers)
  if (!declared) return { status: 'nao_declarada', declared: null, estimate }
  if (!estimate) return { status: 'sem_tabela_conferida', declared, estimate: null }
  const overlaps = declared[0] <= estimate.max && estimate.min <= declared[1]
  return { status: overlaps ? 'coerente' : 'fora_do_intervalo', declared, estimate }
}
