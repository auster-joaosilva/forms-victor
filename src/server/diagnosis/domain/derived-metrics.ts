import type { Answers, MatrixAnswer } from './question-types'
import { bandMidpoint } from './questions'
import {
  checkDeclaredDasRate,
  estimateDasRate,
  type DasEstimate,
  type DeclaredDasStatus,
} from './simples-rates'
import {
  CPP_ON_PAYROLL,
  DAS_MIDPOINTS,
  ESTIMATED_ISS_ICMS,
  MARGIN_ORDER,
  PAYROLL_MIDPOINTS,
  PIS_COFINS_CUMULATIVE,
  PRESUMPTIONS,
  RBT12_ORDER,
  THRESHOLDS,
  lookup,
  type Presumption,
} from './thresholds'

export type Nature = 'produto' | 'servico'

export interface DerivedMetrics {
  creditableRevenue: number | null
  undefinedMix: boolean
  unmappedPortfolio: boolean
  sellsToPublicSector: boolean
  exports: boolean
  creditDensity: number | null
  marginSupports: boolean
  nearCeiling: boolean
  marginKnown: boolean
  aboveSublimit: boolean
  sectorWithOwnRegime: boolean
  customerCannotCredit: boolean
  mixedRevenueInSpecificRegime: boolean
  nature: Nature
  estimatedDas: number | null
  dasSource: string
  dasRange: DasEstimate | null
  dasCheck: DeclaredDasStatus
  estimatedPresumedLoad: number
  federalPresumedLoad: number
  presumptionSource: string
  irpjPresumptionPct: number
  simplesMayBeMoreExpensive: boolean
  marginBelowPresumption: boolean
}

const PURCHASE_MIDPOINTS: Record<string, number> = {
  ate_20: 10,
  de_20_40: 30,
  de_40_60: 50,
  de_60_80: 70,
  acima_80: 90,
}

// Goods weight is the direct measure of cost that passes through third parties: it replaces the payroll factor.
const GOODS_WEIGHT_AS_FACTOR: Record<string, number> = {
  ate_20: 0.45,
  de_20_40: 0.6,
  de_40_60: 0.75,
  de_60_80: 0.9,
  acima_80: 1.0,
}

const MARGIN_BAND_CEILING: Record<string, number | null> = {
  prejuizo: 0,
  ate_5: 5,
  de_5_10: 10,
  de_10_20: 20,
  de_20_30: 30,
  acima_30: null,
}

const text = (answers: Answers, key: string): string => {
  const value = answers[key]
  return typeof value === 'string' ? value : ''
}

const isOneOf = (value: unknown, list: readonly string[]): boolean =>
  typeof value === 'string' && list.includes(value)

function federalPresumedLoad(answers: Answers) {
  const fallback: Presumption = PRESUMPTIONS.servico_demais
  let presumption = lookup<Presumption>(PRESUMPTIONS, answers.segmento) ?? fallback
  if (presumption.requiresConfirmation && answers[presumption.requiresConfirmation] !== 'sim') {
    presumption = fallback
  }
  return {
    pct: +(100 * (0.15 * presumption.irpj + 0.09 * presumption.csll) + PIS_COFINS_CUMULATIVE).toFixed(2),
    irpj: presumption.irpj,
    source: presumption.source,
  }
}

export function deriveMetrics(answers: Answers): DerivedMetrics {
  const matrix = (answers.receitaPorCliente as MatrixAnswer | undefined) ?? {}

  // [DIVERGE-D5] "Não sei" leaves creditable revenue undefined, never zero.
  const regularMidpoint = bandMidpoint(matrix.regime_regular ?? '')
  const publicMidpoint = bandMidpoint(matrix.orgao_publico ?? '')
  const exteriorMidpoint = bandMidpoint(matrix.exterior ?? '')
  const undefinedMix = regularMidpoint === null
  const unmappedPortfolio = [
    'pessoa_fisica',
    'simples_mei',
    'regime_regular',
    'orgao_publico',
    'exterior',
  ].some((k) => matrix[k] === 'nao_sei')
  const creditableRevenue = undefinedMix ? null : regularMidpoint
  const sellsToPublicSector = publicMidpoint !== null && publicMidpoint > 0
  const exports = exteriorMidpoint !== null && exteriorMidpoint > 0

  // [DIVERGE-D2] "Não sei" has no midpoint: density stays undefined.
  const purchaseMidpoint = lookup(PURCHASE_MIDPOINTS, answers.aquisicoesRegimeRegular)
  const factor =
    lookup(GOODS_WEIGHT_AS_FACTOR, answers.pesoMercadorias) ??
    lookup(THRESHOLDS.payrollFactor, answers.pesoFolha) ??
    1
  const personalFactor = lookup(THRESHOLDS.personalUseFactor, answers.aquisicoesUsoPessoal) ?? 1
  const contractorFactor = lookup(THRESHOLDS.contractorFactor, answers.prestadoresPJ) ?? 1
  const creditDensity =
    purchaseMidpoint === undefined
      ? null
      : Math.min(100, purchaseMidpoint * factor * personalFactor * contractorFactor)

  const margin = text(answers, 'margemLiquida')
  const marginKnown = margin !== '' && margin !== 'nao_sei'
  const marginSupports =
    marginKnown &&
    MARGIN_ORDER.indexOf(margin) >= MARGIN_ORDER.indexOf(THRESHOLDS.minimumSupportingMargin) &&
    answers.contratosLongos !== 'sem_clausula'

  // Sublimit (R$ 3.6 mi) is not the permanence limit (R$ 4.8 mi): passing it does not leave the Simples.
  const rbtIndex = RBT12_ORDER.indexOf(text(answers, 'faixaRbt12'))
  const nearCeiling =
    rbtIndex >= RBT12_ORDER.indexOf('de_4_32_4_8mi') ||
    (rbtIndex >= RBT12_ORDER.indexOf('de_3_6_4_32mi') && answers.tendenciaCrescimento === 'cresce_acima_20')
  const aboveSublimit = isOneOf(answers.ultrapassouSublimite, ['sim_corrente', 'sim_anteriores'])

  const nature: Nature = isOneOf(answers.anexoSimples, ['i', 'ii'])
    ? 'produto'
    : isOneOf(answers.anexoSimples, ['iii', 'iv', 'v'])
      ? 'servico'
      : isOneOf(answers.segmento, ['comercio', 'industria', 'agronegocio'])
        ? 'produto'
        : 'servico'
  const presumed = federalPresumedLoad(answers)
  const estimate = estimateDasRate(text(answers, 'anexoSimples'), text(answers, 'faixaRbt12'))
  const declaredDas = lookup(DAS_MIDPOINTS, answers.aliquotaEfetivaDas) ?? null
  const estimatedDas =
    declaredDas !== null
      ? declaredDas
      : estimate
        ? estimate.average + (estimate.issIcmsOutsideDas ? ESTIMATED_ISS_ICMS[nature] : 0)
        : null
  const dasCheck = checkDeclaredDasRate(answers).status
  const dasSource =
    declaredDas === null
      ? estimate
        ? 'estimado pela tabela do anexo'
        : 'indisponível'
      : dasCheck === 'coerente'
        ? 'informado, dentro do estimado'
        : dasCheck === 'fora_do_intervalo'
          ? 'informado, FORA do estimado'
          : 'informado, sem tabela conferida para comparar'
  const estimatedCpp = (lookup(PAYROLL_MIDPOINTS, answers.pesoFolha) ?? 0) * CPP_ON_PAYROLL
  // In Annex IV the CPP is already outside the DAS.
  const cppAddedToPresumed = answers.anexoSimples === 'iv' ? 0 : estimatedCpp
  const estimatedPresumedLoad = presumed.pct + cppAddedToPresumed + ESTIMATED_ISS_ICMS[nature]
  const simplesMayBeMoreExpensive = estimatedDas !== null && estimatedDas > estimatedPresumedLoad
  // Real margin below the segment's IRPJ presumption hints that Lucro Real may cost less than Presumido.
  const marginCeiling = lookup(MARGIN_BAND_CEILING, answers.margemLiquida)
  const irpjPresumptionPct = 100 * presumed.irpj
  const marginBelowPresumption =
    marginCeiling !== null && marginCeiling !== undefined && marginCeiling <= irpjPresumptionPct

  const sector = text(answers, 'setorDiferenciado')
  const sectorWithOwnRegime = sector !== '' && !['nenhum', 'nao_sei'].includes(sector)
  // LC 214/2025, arts. 276 and 283 forbid the buyer's credit; art. 273, § 2º excludes contracted meals and resale.
  const outsideShare = answers.composicaoAlimentacao
  const barInRegime =
    sector === 'bares_restaurantes' && !isOneOf(outsideShare, ['maior_parte_fora', 'parte_fora_do_regime'])
  const customerCannotCredit = barInRegime || sector === 'hotelaria_parques'
  const mixedRevenueInSpecificRegime =
    sector === 'bares_restaurantes' &&
    isOneOf(outsideShare, ['parte_fora_do_regime', 'maior_parte_fora', 'nao_sei'])

  return {
    creditableRevenue,
    undefinedMix,
    unmappedPortfolio,
    sellsToPublicSector,
    exports,
    creditDensity,
    marginSupports,
    nearCeiling,
    marginKnown,
    aboveSublimit,
    sectorWithOwnRegime,
    customerCannotCredit,
    mixedRevenueInSpecificRegime,
    nature,
    estimatedDas,
    dasSource,
    dasRange: estimate,
    dasCheck,
    estimatedPresumedLoad: +estimatedPresumedLoad.toFixed(1),
    federalPresumedLoad: presumed.pct,
    presumptionSource: presumed.source,
    irpjPresumptionPct,
    simplesMayBeMoreExpensive,
    marginBelowPresumption,
  }
}
