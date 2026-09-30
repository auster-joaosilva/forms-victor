import { assessConfidence, type Confidence, type ConfidenceLevel } from './confidence'
import { assessUrgencyAndDeadline } from './deadline'
import { deriveMetrics, type DerivedMetrics } from './derived-metrics'
import {
  ASYMMETRY,
  MODALITIES,
  OUTCOMES,
  positionForRegime,
  type Asymmetry,
  type Modality,
  type Outcome,
  type OutcomeKey,
  type Position,
  type PreliminaryReading,
} from './outcomes'
import type { Answers } from './question-types'
import { matrixRowLabel, optionLabel } from './questions'
import { computeRadar, type RadarAxisScore } from './radar'
import { APPLY_DENSITY_TEST_ON_HIGH_BRANCH, DEADLINES, GATE_CONDITIONS, THRESHOLDS } from './thresholds'

export interface Conflict {
  conflict: string
  decides: string
  gather: string
}

export interface Diagnosis {
  outcomeKey: OutcomeKey
  outcome: Outcome
  triggers: string[]
  position: Position
  modality: Modality
  conflict: Conflict | null
  asymmetry: Asymmetry
  preliminaryReading: PreliminaryReading | null
  derived: DerivedMetrics
  confidence: Confidence
  urgency: ConfidenceLevel
  filingDeadline: string
  withinLeadTime: boolean
  windowOpen: boolean
  businessDaysToWindowEnd: number
  calendarDaysToWindowEnd: number
  operationalLeadDays: number
  radar: RadarAxisScore[]
  preliminary: boolean
}

interface Evaluation {
  outcomeKey: OutcomeKey
  triggers: string[]
}

function evaluateGates(answers: Answers, derived: DerivedMetrics): Evaluation | null {
  if (answers.ehSimei === 'sim') return { outcomeKey: 'MEI', triggers: ['gate_simei'] }
  if (answers.regimeAtual && answers.regimeAtual !== 'simples') {
    return { outcomeKey: 'OUTSIDE', triggers: ['gate_fora_do_simples'] }
  }
  if (derived.customerCannotCredit) {
    return { outcomeKey: 'SECTOR_WITHOUT_CREDIT', triggers: ['gate_credito_vedado_ao_adquirente'] }
  }
  if (answers.faixaRbt12 === 'acima_4_8mi') return { outcomeKey: 'D', triggers: ['gate_acima_do_teto'] }
  if (answers.margemLiquida === 'prejuizo' || answers.margemLiquida === 'ate_5') {
    return { outcomeKey: 'E', triggers: ['gate_margem_critica'] }
  }
  if (answers.investimentoPrevisto === 'acima_1mi') {
    return { outcomeKey: 'E', triggers: ['gate_investimento_relevante'] }
  }
  return null
}

function evaluateTree(derived: DerivedMetrics): Evaluation {
  const triggers: string[] = []
  const done = (outcomeKey: OutcomeKey, ...last: string[]): Evaluation => {
    triggers.push(...last)
    return { outcomeKey, triggers }
  }
  const { creditableRevenue: revenue, creditDensity: density } = derived

  if (revenue === null) return done('E_NO_DATA', 'mix_de_clientes_indefinido')
  if (revenue < THRESHOLDS.creditableRevenueLow) return done('A', 'base_b2c')

  if (revenue <= THRESHOLDS.creditableRevenueHigh) {
    triggers.push('cadeia_mista')
    if (derived.marginSupports) return done('B', 'margem_absorve_desconto')
    triggers.push('margem_nao_absorve')
    if (density === null) return done('E_NO_DATA', 'densidade_indefinida')
    if (density >= THRESHOLDS.minimumCreditDensity) return done('C', 'densidade_suficiente')
    return done('E', 'densidade_insuficiente')
  }

  triggers.push('cadeia_entre_empresas')
  if (derived.nearCeiling) return done('D', 'proximo_do_teto')
  if (APPLY_DENSITY_TEST_ON_HIGH_BRANCH) {
    if (density === null) return done('E_NO_DATA', 'densidade_indefinida')
    if (density < THRESHOLDS.minimumCreditDensity) return done('E', 'densidade_insuficiente_entre_empresas')
  }
  return done('C')
}

// When a gate suspends the decision (D and E), the side the tree points to, flagged as conditional.
function preliminaryReadingFor(byGate: Evaluation | null, byTree: Evaluation): PreliminaryReading | null {
  if (!byGate || !['D', 'E'].includes(OUTCOMES[byGate.outcomeKey].code)) return null
  const modalityKey = OUTCOMES[byTree.outcomeKey].modality
  if (modalityKey !== 'padrao' && modalityKey !== 'hibrido') return null
  const trigger = byGate.triggers[0] ?? ''
  return {
    modality: MODALITIES[modalityKey],
    modalityKey,
    condition: GATE_CONDITIONS[trigger] || null,
    triggers: byTree.triggers,
  }
}

// A label in mid-sentence starts in lowercase: options are written to stand alone.
const lowercaseFirst = (s: string | null): string | null => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s)

// Percentages come from the band the respondent marked, not from the engine's internal midpoint.
function conflictOfExitE(answers: Answers, triggers: string[], reading: PreliminaryReading | null): Conflict {
  const toCompanies = lowercaseFirst(matrixRowLabel('receitaPorCliente', 'regime_regular', answers))
  const purchases = lowercaseFirst(optionLabel('aquisicoesRegimeRegular', answers.aquisicoesRegimeRegular))
  const margin = lowercaseFirst(optionLabel('margemLiquida', answers.margemLiquida))
  const readingSide =
    reading?.modalityKey === 'hibrido'
      ? 'tirar o imposto da guia'
      : reading?.modalityKey === 'padrao'
        ? 'ficar no Simples Padrão'
        : null

  if (triggers.includes('gate_margem_critica')) {
    return {
      conflict:
        'A sua margem declarada está na faixa mais apertada' +
        (margin ? ` (${margin})` : '') +
        '. Com margem assim, a diferença entre os dois caminhos cabe dentro do erro de ' +
        'qualquer estimativa — e leitura de perfil deixa de ser suficiente' +
        (readingSide ? `, mesmo apontando para ${readingSide}` : '') +
        '.',
      decides:
        'a margem real apurada, e não a faixa informada. Uma margem verdadeira acima ' +
        'da faixa declarada muda o lado da conta.',
      gather: 'a margem real dos últimos doze meses, com a apuração na mão',
    }
  }

  if (triggers.includes('gate_investimento_relevante')) {
    return {
      conflict:
        'Você tem investimento relevante previsto. Bem de capital gera crédito, e um ' +
        'investimento grande sozinho pode virar o lado da conta — para quem apura por fora. ' +
        'A leitura do seu perfil' +
        (readingSide ? ` aponta para ${readingSide}` : ' existe') +
        ', mas ela não considera esse investimento.',
      decides: 'quando o investimento acontece, quanto dele gera crédito e em qual semestre ' + 'ele cai.',
      gather: 'o valor, a data prevista e o regime de quem vai vender o bem',
    }
  }

  // The question measures a share of PURCHASES, not of revenue.
  const purchasesClause = purchases
    ? `apenas ${purchases} das suas compras vêm de fornecedores que geram crédito`
    : 'uma parte pouco relevante das suas compras vem de fornecedores que geram crédito'

  if (triggers.includes('densidade_insuficiente_entre_empresas')) {
    return {
      conflict:
        'Quase tudo o que você fatura vai para empresas que aproveitam crédito' +
        (toCompanies ? ` (${toCompanies} do faturamento)` : '') +
        ' — elas vão pedir desconto por um crédito que hoje você não entrega, e isso puxa ' +
        'forte para tirar o imposto da guia. Só que ' +
        purchasesClause +
        ', e quem sai da guia única sem crédito próprio passa a recolher sobre quase toda a ' +
        'receita. Os dois lados da mesma conta apontam em direções opostas.',
      decides:
        'quanto do desconto que os seus clientes vão pedir você consegue não dar, ' +
        'contra o crédito que passaria a tomar nas suas compras.',
      gather: 'as compras do último ano por fornecedor, com o CNPJ de cada um, e a margem real',
    }
  }

  if (triggers.includes('densidade_insuficiente')) {
    return {
      conflict:
        'Parte da sua receita vai para empresas que aproveitam crédito' +
        (toCompanies ? ` (${toCompanies} do faturamento)` : '') +
        ', e essa parte puxa para tirar o imposto da guia. Mas a sua margem' +
        (margin ? ` (${margin})` : '') +
        ' não dá espaço para absorver o desconto que esses clientes vão pedir, e ' +
        purchasesClause +
        '.',
      decides:
        'se o desconto negociado cabe na margem, ou se o crédito das suas compras paga ' +
        'a diferença. Nenhum dos dois se resolve por estimativa.',
      gather: 'a margem real por linha de receita e as compras do último ano por fornecedor',
    }
  }

  return {
    conflict: 'Há motivo para mudar e motivo para ficar nas mesmas informações.',
    decides: 'a simulação com os seus números, e não a leitura de perfil.',
    gather: 'faturamento por tipo de cliente, compras por fornecedor e margem real',
  }
}

function conflictOfCase(
  answers: Answers,
  triggers: string[],
  reading: PreliminaryReading | null,
  confidence: Confidence,
): Conflict {
  const base = conflictOfExitE(answers, triggers, reading)
  const gaps = confidence.readableGaps.filter(Boolean)
  return {
    conflict: base.conflict,
    decides: base.decides,
    gather: gaps.length ? gaps.slice(0, 3).join(', ') + ', e ' + base.gather : base.gather,
  }
}

const CONFLICT_CALLOUT =
  'As suas respostas apontam para lados opostos, e o conflito no ' +
  'seu caso é específico. Abaixo está qual é ele, o que decide entre os dois lados e ' +
  'o que precisamos levantar para fechar a conta.'

export function diagnose(answers: Answers, today: Date): Diagnosis {
  const derived = deriveMetrics(answers)
  const confidence = assessConfidence(answers)

  const byGate = evaluateGates(answers, derived)
  // The tree always runs: when a gate decides, its side still becomes the preliminary reading.
  const byTree = evaluateTree(derived)
  const { outcomeKey, triggers } = byGate ?? byTree
  const outcome = OUTCOMES[outcomeKey]
  const reading = preliminaryReadingFor(byGate, byTree)

  // Added here, not in the tree: a case resolved by a gate never goes through it.
  if (derived.dasCheck === 'fora_do_intervalo') triggers.push('aliquota_fora_do_estimado')
  if (derived.sectorWithOwnRegime) triggers.push('setor_com_tratamento_diferenciado')
  if (derived.simplesMayBeMoreExpensive) triggers.push('simples_pode_estar_mais_caro')
  if (derived.marginBelowPresumption) triggers.push('margem_abaixo_da_presuncao')
  if (answers.mercadoriasComST === 'parte' || answers.mercadoriasComST === 'maioria') {
    triggers.push('opera_com_substituicao_tributaria')
  }
  if (derived.sellsToPublicSector) triggers.push('vende_para_orgao_publico')
  if (derived.exports) triggers.push('tem_receita_de_exportacao')
  if (derived.aboveSublimit) triggers.push('passou_do_sublimite_estadual')
  if (derived.mixedRevenueInSpecificRegime) triggers.push('receita_mista_no_regime_especifico')
  if (answers.aquisicoesUsoPessoal === 'relevante') triggers.push('credito_reduzido_por_uso_pessoal')

  const deadline = assessUrgencyAndDeadline(outcome, answers, confidence, today)
  const position = positionForRegime(outcome, confidence, triggers, reading)
  // By key, not by code: E_NO_DATA also has code 'E', and missing data is not a conflict.
  const conflict = outcomeKey === 'E' ? conflictOfCase(answers, triggers, reading, confidence) : null

  return {
    outcomeKey,
    outcome: conflict ? { ...outcome, meaning: CONFLICT_CALLOUT } : outcome,
    triggers,
    position,
    modality: MODALITIES[outcome.modality],
    conflict,
    asymmetry: ASYMMETRY,
    preliminaryReading: reading,
    derived,
    confidence,
    urgency: deadline.level,
    filingDeadline: deadline.filingDeadline,
    withinLeadTime: deadline.withinLeadTime,
    windowOpen: deadline.windowOpen,
    businessDaysToWindowEnd: deadline.businessDaysToEnd,
    calendarDaysToWindowEnd: deadline.calendarDaysToEnd,
    operationalLeadDays: DEADLINES.filingSlackDays,
    radar: computeRadar(answers),
    preliminary: confidence.level === 'BAIXA',
  }
}
