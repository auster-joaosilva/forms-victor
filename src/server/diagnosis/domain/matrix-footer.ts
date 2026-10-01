import type { Answers, MatrixAnswer } from './question-types'
import { bandMidpoint } from './questions'

// "Não sei" enters as a gap, not as 0%: otherwise the 100% warning would accuse the honest answer.
export function matrixFooter(answers: Answers, key: string): { warning: boolean; text: string } {
  const matrix = (answers[key] as MatrixAnswer | undefined) ?? {}
  let sum = 0
  let unknown = 0
  for (const value of Object.values(matrix)) {
    const midpoint = bandMidpoint(value)
    if (midpoint === null) unknown++
    else sum += midpoint
  }
  if (unknown) {
    const rows = unknown === 1 ? 'uma linha ficou' : `${unknown} linhas ficaram`
    return { warning: false, text: `Soma das linhas respondidas: ${sum}% — ${rows} em "não sei".` }
  }
  const outside = sum > 0 && (sum < 80 || sum > 120)
  return { warning: outside, text: `Soma aproximada: ${sum}%${outside ? ' — revise, o total deveria ficar perto de 100%.' : ''}` }
}
