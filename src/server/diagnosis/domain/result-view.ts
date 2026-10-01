import type { ActionItem, ActionPlan } from './action-plan'
import type { ConfidenceLevel } from './confidence'
import type { Conflict, Diagnosis } from './diagnose'
import type { PositionDefinition } from './outcomes'

export type RadarTone = 'forte' | 'atenção' | 'prioritária' | null

export interface AsymmetryView {
  title: string
  text: string
  forWhom: string | null
  source: string
}

export interface ResultView {
  lowConfidence: { gapCount: number; readableGaps: string[] } | null
  decision: {
    certainty: PositionDefinition['certainty']
    family: PositionDefinition['family']
    label: string
    qualifier: string
    singleAction: string
    openPoints: string[]
    preliminaryReading: { condition: string; modalityLabel: string } | null
    why: { preliminary: boolean; title: string; summary: string } | null
    detail: string | null
    showWithdrawalNotice: boolean
  }
  meaning: string | null
  windowText: string
  filingDeadline: { value: string; note: string }
  urgency: ConfidenceLevel
  confidence: { level: ConfidenceLevel; dasEstimated: boolean }
  radar: { title: string; scoreText: string; band: string; width: number; tone: RadarTone }[]
  plan: { clientNow: ActionItem[]; clientLater: ActionItem[]; auster: ActionItem[] }
  conflict: Conflict | null
  asymmetry: AsymmetryView
}

const DEFAULT_CONDITION = 'depende de um ponto que as respostas não fecham'
const ESTIMATED_DAS = 'estimado pela tabela do anexo'
const TONES: Record<string, RadarTone> = { forte: 'forte', 'atenção moderada': 'atenção', 'evolução prioritária': 'prioritária' }

export const showsWithdrawalNotice = (diagnosis: Diagnosis): boolean =>
  diagnosis.position.family === 'hibrido' || diagnosis.position.family === 'a_definir'

export function asymmetryView({ asymmetry, position }: Diagnosis): AsymmetryView {
  return { title: asymmetry.title, text: asymmetry.text, forWhom: position.family === 'padrao' ? asymmetry.forWhom : null, source: asymmetry.source }
}

export function windowText(diagnosis: Diagnosis): string {
  if (!diagnosis.windowOpen) return 'encerrada'
  if (diagnosis.calendarDaysToWindowEnd === 0) return 'hoje é o último dia'
  if (diagnosis.calendarDaysToWindowEnd === 1) return 'termina amanhã'
  return `${diagnosis.calendarDaysToWindowEnd} dias`
}

export function resultView(diagnosis: Diagnosis, plan: ActionPlan): ResultView {
  const { position, outcome, preliminaryReading } = diagnosis
  const reading = preliminaryReading
    ? { condition: preliminaryReading.condition ?? DEFAULT_CONDITION, modalityLabel: preliminaryReading.modality.label }
    : null
  const lead = diagnosis.operationalLeadDays
  return {
    lowConfidence: diagnosis.preliminary
      ? { gapCount: diagnosis.confidence.gaps.length, readableGaps: diagnosis.confidence.readableGaps }
      : null,
    decision: {
      certainty: position.certainty,
      family: position.family,
      label: position.label,
      qualifier: position.qualifier,
      singleAction: position.singleAction,
      openPoints: position.openPoints,
      preliminaryReading: reading,
      why: reading ? null : { preliminary: position.qualifier !== 'decisão fechada', title: outcome.title, summary: outcome.summary },
      detail: position.detail && !reading ? position.detail : null,
      showWithdrawalNotice: showsWithdrawalNotice(diagnosis),
    },
    meaning: outcome.meaning || null,
    windowText: windowText(diagnosis),
    filingDeadline: diagnosis.withinLeadTime
      ? { value: diagnosis.filingDeadline, note: `Antecedência nossa de ${lead} dias úteis para representação, análise prévia e eventual pendência de Estado ou Município. Não é prazo legal.` }
      : { value: 'o quanto antes', note: `A antecedência de ${lead} dias úteis que pedimos já não cabe. Dá para fazer, mas passa a ser prioridade da semana.` },
    urgency: diagnosis.urgency,
    confidence: { level: diagnosis.confidence.level, dasEstimated: diagnosis.derived.dasSource === ESTIMATED_DAS },
    radar: diagnosis.radar.map((axis) => ({
      title: axis.title,
      scoreText: axis.score === null ? '—' : `${axis.score}%`,
      band: axis.band,
      width: axis.score ?? 0,
      tone: TONES[axis.band] ?? null,
    })),
    plan: { clientNow: plan.clientNow, clientLater: plan.clientLater, auster: plan.auster },
    conflict: diagnosis.conflict,
    asymmetry: asymmetryView(diagnosis),
  }
}
