import type { Answers } from './question-types'
import { QUESTIONS, visibleQuestions } from './questions'

export const FIRST_STEP = 1
export const FORM_STEPS = 5
export const REVIEW_STEP = 6
export const RESULT_STEP = 7
export const DRAFT_TTL_MS = 7 * 24 * 3600 * 1000
export const DRAFT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TriageReason = 'mei' | 'outside'
export type AnswerValue = string | Record<string, string>
export type WireAnswers = Record<string, AnswerValue>

const QUESTION_KEYS = new Set(QUESTIONS.map((question) => question.key))

export const draftExpiry = (now: Date): Date => new Date(now.getTime() + DRAFT_TTL_MS)

export const isDraftExpired = (expiresAt: Date, now: Date): boolean => expiresAt.getTime() <= now.getTime()

export const clampStep = (step: number): number =>
  Number.isFinite(step) ? Math.min(Math.max(Math.trunc(step), 1), RESULT_STEP) : 1

export const stripInternalKeys = (answers: Answers): Answers =>
  Object.fromEntries(Object.entries(answers).filter(([key]) => !key.startsWith('_')))

// Repeats until stable: erasing one answer can hide the question that conditioned another.
export function cleanInvisibleAnswers(answers: Answers): Answers {
  let current = answers
  for (let pass = 0; pass < QUESTIONS.length; pass++) {
    const visible = new Set(visibleQuestions(current).map((question) => question.key))
    const next = Object.fromEntries(Object.entries(current).filter(([key]) => visible.has(key) || !QUESTION_KEYS.has(key)))
    if (Object.keys(next).length === Object.keys(current).length) return next
    current = next
  }
  return current
}

export function triageReason(answers: Answers): TriageReason | null {
  if (answers.ehSimei === 'sim') return 'mei'
  if (answers.regimeAtual && answers.regimeAtual !== 'simples' && answers.regimeAtual !== 'nao_sei') return 'outside'
  return null
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export const sameAnswers = (a: Answers, b: Answers): boolean => stable(a) === stable(b)

export function toWireAnswers(answers: Answers): WireAnswers {
  const wire: WireAnswers = {}
  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === 'string') wire[key] = value
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      wire[key] = Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    }
  }
  return wire
}
