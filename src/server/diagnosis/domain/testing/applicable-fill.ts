import { triageReason } from '../draft-rules'
import type { Answers } from '../question-types'
import { generateFills } from './fill-generator'

export function applicableFill(seed: number): Answers {
  for (const fill of generateFills({ count: 500, seed })) if (!triageReason(fill)) return fill
  throw new Error(`nenhum preenchimento fora da triagem com a semente ${seed}`)
}
