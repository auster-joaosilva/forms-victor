import { assessConfidence } from './confidence'
import type { Answers, MatrixAnswer, Question } from './question-types'
import { BLOCKS, visibleQuestions } from './questions'

export type ReadableAnswer =
  | { kind: 'text'; text: string; gap: boolean }
  | { kind: 'matrix'; rows: { label: string; value: string; gap: boolean }[]; gap: boolean }

export interface ReviewRow {
  key: string
  block: number
  prompt: string
  decides: boolean
  answer: ReadableAnswer | null
}

export interface ReviewBlock {
  number: number
  title: string
  position: number
  rows: ReviewRow[]
}

export interface ReviewView {
  blocks: ReviewBlock[]
  total: number
  readableGaps: string[]
}

export const optionText = (question: Question, value: unknown): string =>
  question.options?.find((option) => option.value === value)?.label ?? String(value)

export const columnText = (question: Question, value: string): string =>
  question.columns?.find((column) => column.value === value)?.label ?? value

export function readableAnswer(question: Question, answers: Answers): ReadableAnswer | null {
  const value = answers[question.key]
  if (question.type === 'matrix') {
    const matrix = (value as MatrixAnswer | undefined) ?? {}
    const rows = (question.rows ?? []).map((row) => {
      const raw = matrix[row.key]
      return { label: row.label, value: raw === undefined ? 'não respondido' : columnText(question, raw), gap: raw === question.unknownValue }
    })
    return { kind: 'matrix', rows, gap: rows.some((row) => row.gap) }
  }
  if (!value || !String(value).trim()) return null
  if (question.type === 'consent') return { kind: 'text', text: 'Concordou com o uso das informações', gap: false }
  return { kind: 'text', text: optionText(question, value), gap: question.options !== undefined && value === question.unknownValue }
}

const decides = (question: Question) => question.feeds.includes('modality') || question.feeds.includes('eligibility')

export function reviewItems(answers: Answers): ReviewView {
  const visible = visibleQuestions(answers)
  const blocks = BLOCKS.map((block, index) => ({
    number: block.number,
    title: block.title,
    position: index + 1,
    rows: visible
      .filter((question) => question.block === block.number)
      .map((question) => ({ key: question.key, block: question.block, prompt: question.prompt, decides: decides(question), answer: readableAnswer(question, answers) })),
  })).filter((block) => block.rows.length > 0)
  return { blocks, total: visible.length, readableGaps: assessConfidence(answers).readableGaps }
}
