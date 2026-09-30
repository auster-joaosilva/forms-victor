import type { Answers } from './question-types'
import { RADAR_AXES, visibleQuestions } from './questions'

export interface RadarAxisScore {
  number: number
  title: string
  score: number | null
  band: string
  fields: number
}

export function radarBand(score: number | null): string {
  if (score === null) return 'sem dados'
  return score >= 80
    ? 'forte'
    : score >= 60
      ? 'consistente'
      : score >= 40
        ? 'atenção moderada'
        : 'evolução prioritária'
}

// [DIVERGE-D3] Each option carries an explicit score.
export function computeRadar(answers: Answers): RadarAxisScore[] {
  const visible = visibleQuestions(answers)
  return RADAR_AXES.map((axis) => {
    const scores = visible
      .filter((q) => (q.axes ?? []).includes(axis.number) && answers[q.key] !== undefined)
      .map((q) => (q.options ?? []).find((o) => o.value === answers[q.key])?.score)
      .filter((s): s is number => typeof s === 'number')
    const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
    return { ...axis, score, band: radarBand(score), fields: scores.length }
  })
}
