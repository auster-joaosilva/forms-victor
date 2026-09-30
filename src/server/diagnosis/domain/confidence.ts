import type { Answers } from './question-types'
import { isShortPath, unansweredMatrixRows, visibleQuestions } from './questions'

export type ConfidenceLevel = 'ALTA' | 'MÉDIA' | 'BAIXA'

export interface Confidence {
  level: ConfidenceLevel
  gaps: string[]
  readableGaps: string[]
  shortPath: boolean
}

export function assessConfidence(answers: Answers): Confidence {
  const gaps: string[] = []
  const readableGaps: string[] = []
  for (const question of visibleQuestions(answers)) {
    const decides = question.feeds.includes('modality') || question.feeds.includes('eligibility')
    if (!decides || !question.unknownValue) continue
    if (question.type === 'matrix') {
      for (const rowKey of unansweredMatrixRows(question, answers)) {
        gaps.push(`${question.key}.${rowKey}`)
        const row = (question.rows ?? []).find((r) => r.key === rowKey)
        readableGaps.push(`${question.gapLabel || question.prompt} ${row?.label || rowKey}`)
      }
    } else if (answers[question.key] === question.unknownValue) {
      // A gap filled by a confirmed table does not lower confidence: there is a number.
      if (question.gapFilled?.(answers)) continue
      gaps.push(question.key)
      readableGaps.push(question.gapLabel || question.prompt)
    }
  }

  const shortPath = isShortPath(answers)
  let level: ConfidenceLevel = gaps.length === 0 ? 'ALTA' : gaps.length <= 2 ? 'MÉDIA' : 'BAIXA'
  // The short path never collects enough for high confidence.
  if (shortPath && level === 'ALTA') level = 'MÉDIA'
  return { level, gaps, readableGaps, shortPath }
}
