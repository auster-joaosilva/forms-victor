import { describe, expect, it } from 'vitest'
import { DEADLINES } from './deadlines'
import { DEADLINES as ENGINE_DEADLINES } from '../../diagnosis/domain/thresholds'

describe('DEADLINES (Resolução CGSN 194/2026)', () => {
  it('moves the option to 30/10 and turns the withdrawal into a window from 03/11 to 20/12', () => {
    expect(DEADLINES).toEqual({
      windowEnd: '2026-10-30',
      simplesEntryUntil: '2026-10-15',
      withdrawalFrom: '2026-11-03',
      withdrawalUntil: '2026-12-20',
      effectSemester: '1º semestre de 2027',
      nextWindow: 'março de 2027',
      nextWindowEffect: '2º semestre de 2027',
      filingSlackDays: 3,
    })
  })

  it('is the same object the engine reads', () => {
    expect(ENGINE_DEADLINES).toBe(DEADLINES)
  })
})
