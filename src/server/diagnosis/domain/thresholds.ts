export const THRESHOLDS = {
  creditableRevenueLow: 20,
  creditableRevenueHigh: 60,
  minimumCreditDensity: 40,
  minimumSupportingMargin: 'de_10_20',
  payrollFactor: {
    nenhuma: 1.0,
    ate_15: 1.0,
    de_15_30: 0.9,
    de_30_45: 0.75,
    de_45_60: 0.6,
    acima_60: 0.45,
  } as Record<string, number>,
  // Personal-use purchases do not generate credit (LC 214/2025, art. 47, caput, c/c art. 57); "não sei" does not penalize.
  personalUseFactor: { nao: 1.0, pouco: 0.9, relevante: 0.75, nao_sei: 1.0 } as Record<string, number>,
  contractorFactor: { nao: 1.0, alguns: 1.1, boa_parte: 1.25, nao_sei: 1.0 } as Record<string, number>,
}

// [DIVERGE-D1] Turned on 15/09/2026 by management: the high branch also tests credit density.
export const APPLY_DENSITY_TEST_ON_HIGH_BRANCH = true

// LC 123/2006, art. 13, §§ 9º e 10 (LC 227/2026); withdrawal until 30/11: CGSN option manual, item 4.2.
export const DEADLINES = {
  windowEnd: '2026-09-30',
  withdrawalUntil: '2026-11-30',
  effectSemester: '1º semestre de 2027',
  nextWindow: 'março de 2027',
  nextWindowEffect: '2º semestre de 2027',
  // Operational lead time asked by the firm, in business days. Not a legal deadline.
  filingSlackDays: 3,
}

export const MARGIN_ORDER = ['prejuizo', 'ate_5', 'de_5_10', 'de_10_20', 'de_20_30', 'acima_30']

export interface Presumption {
  irpj: number
  csll: number
  source: string
  requiresConfirmation?: string
}

// Lei 9.249/1995, arts. 15 e 20.
export const PRESUMPTIONS = {
  comercio: { irpj: 0.08, csll: 0.12, source: 'art. 15, caput, e art. 20, III' },
  industria: { irpj: 0.08, csll: 0.12, source: 'art. 15, caput, e art. 20, III' },
  agronegocio: { irpj: 0.08, csll: 0.12, source: 'art. 15, caput, e art. 20, III' },
  transporte_carga: { irpj: 0.08, csll: 0.12, source: "art. 15, § 1º, II, 'a', parte final" },
  transporte_passageiros: { irpj: 0.16, csll: 0.12, source: "art. 15, § 1º, II, 'a'" },
  // Back to the caput only for a business company that meets Anvisa rules; otherwise services in general.
  servico_saude: {
    irpj: 0.08,
    csll: 0.12,
    source: "art. 15, § 1º, III, 'a', a contrario",
    requiresConfirmation: 'servicoHospitalar',
  },
  servico_demais: { irpj: 0.32, csll: 0.32, source: "art. 15, § 1º, III, 'a'" },
  // [CONFERIR] Kept at the higher rate: conservative, it never makes Presumido look better than it is.
  construcao_civil: { irpj: 0.32, csll: 0.32, source: '[CONFERIR] presunção da empreitada' },
  outro: { irpj: 0.32, csll: 0.32, source: "art. 15, § 1º, III, 'a'" },
} satisfies Record<string, Presumption>

// [DECIDIR] 2026 base; from 2027 PIS/COFINS is revoked (LC 214, art. 542 c/c art. 544, III).
export const PIS_COFINS_CUMULATIVE = 3.65

// 20% + RAT + third parties [CONFERIR].
export const CPP_ON_PAYROLL = 0.268

export const PAYROLL_MIDPOINTS: Record<string, number> = {
  nenhuma: 0,
  ate_15: 7.5,
  de_15_30: 22.5,
  de_30_45: 37.5,
  de_45_60: 52.5,
  acima_60: 70,
}

export const ESTIMATED_ISS_ICMS = { servico: 3.5, produto: 4.0 }

export const DAS_MIDPOINTS: Record<string, number> = {
  ate_6: 5,
  de_6_9: 7.5,
  de_9_12: 10.5,
  de_12_15: 13.5,
  de_15_19: 17,
  acima_19: 21,
}

export const RBT12_ORDER = [
  'ate_180k',
  'de_180_360k',
  'de_360_720k',
  'de_720k_1_8mi',
  'de_1_8_3_6mi',
  'de_3_6_4_32mi',
  'de_4_32_4_8mi',
  'acima_4_8mi',
]

// Each one changes the size of the IBS/CBS credit; the "stay in Simples" triggers are left out on purpose.
export const OPENS_OPEN_POINT = [
  'aliquota_fora_do_estimado',
  'setor_com_tratamento_diferenciado',
  'credito_reduzido_por_uso_pessoal',
  'opera_com_substituicao_tributaria',
  'receita_mista_no_regime_especifico',
]

export const READABLE_OPEN_POINT: Record<string, string> = {
  aliquota_fora_do_estimado:
    'a alíquota efetiva que você informou não bate com a faixa de ' +
    'receita e o anexo declarados — uma das três precisa ser revista antes de fechar a conta',
  setor_com_tratamento_diferenciado:
    'sua atividade está em setor com alíquota reduzida ou regime próprio, e o tamanho dessa redução muda a conta',
  credito_reduzido_por_uso_pessoal:
    'há parcela relevante de compras de uso pessoal em nome da empresa, e ela não gera crédito',
  opera_com_substituicao_tributaria:
    'parte das mercadorias tem substituição tributária hoje, e ela deixa de existir no IBS e na CBS',
  receita_mista_no_regime_especifico:
    'parte do que você vende fica fora do regime próprio de bares e restaurantes, e essa parte segue a regra geral — precisa ser separada',
}

export const GAPS_THAT_LOCK_DECISION = [
  'receitaPorCliente.regime_regular',
  'receitaPorCliente.orgao_publico',
  'aquisicoesRegimeRegular',
  'margemLiquida',
  'contratosLongos',
  'aquisicoesUsoPessoal',
  'prestadoresPJ',
]

export const GATE_CONDITIONS: Record<string, string> = {
  gate_acima_do_teto: 'depende de a empresa continuar no Simples em 2027',
  gate_margem_critica: 'depende de conferir a margem real, hoje abaixo de 5%',
  gate_investimento_relevante: 'depende de como o investimento previsto entra na conta do crédito',
}

export function lookup<T>(record: Record<string, T>, key: unknown): T | undefined {
  return typeof key === 'string' && Object.hasOwn(record, key) ? record[key] : undefined
}
