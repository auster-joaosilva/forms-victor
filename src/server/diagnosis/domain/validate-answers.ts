import { VALIDATORS } from '../../shared/domain/validation'
import type { Answers, MatrixAnswer } from './question-types'
import { BLOCKS, QUESTIONS, visibleQuestions } from './questions'

export type AnswerProblems = Record<string, string>

export function stepProblems(answers: Answers, block: number): AnswerProblems {
  const problems: AnswerProblems = {}
  for (const question of visibleQuestions(answers)) {
    if (question.block !== block || question.required === 'never') continue
    const value = answers[question.key]
    if (question.type === 'matrix') {
      const matrix = (value as MatrixAnswer | undefined) ?? {}
      if ((question.rows ?? []).some((row) => !matrix[row.key])) problems[question.key] = 'Responda todas as linhas.'
      continue
    }
    if (!value || !String(value).trim()) {
      problems[question.key] = 'Obrigatório'
      continue
    }
    const validator = question.validator ? VALIDATORS[question.validator] : undefined
    if (validator && !validator.validate(String(value))) problems[question.key] = validator.error
  }
  return problems
}

export const validateAnswers = (answers: Answers): AnswerProblems =>
  Object.assign({}, ...BLOCKS.map((block) => stepProblems(answers, block.number)))

export function fieldProblem(answers: Answers, key: string): string | null {
  const question = QUESTIONS.find((q) => q.key === key)
  const value = answers[key]
  if (!question?.validator || typeof value !== 'string' || !value.trim()) return null
  const validator = VALIDATORS[question.validator]
  return validator.validate(value) ? null : validator.error
}
