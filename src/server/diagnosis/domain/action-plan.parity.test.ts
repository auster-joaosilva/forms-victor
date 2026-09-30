import { describe, expect, it } from 'vitest'
import * as legacyEngine from '../../../../legacy/src/motor.js'
import * as legacyActions from '../../../../legacy/src/acoes.js'
import { diagnose } from './diagnose'
import { buildActionPlan } from './action-plan'
import { generateFills } from './testing/fill-generator'

const TODAY = new Date('2026-09-15T10:00:00-03:00')
const ids = (items: { id: string }[]) => items.map((item) => item.id)

describe('action plan parity over 40 000 fills', () => {
  it('picks the same actions in the same buckets', () => {
    for (const answers of generateFills({ count: 40_000, seed: 20260915 })) {
      const now = buildActionPlan(answers, diagnose(answers, TODAY))
      const old = legacyActions.planoDeAcao(answers, legacyEngine.diagnosticar(answers, TODAY))
      expect(ids(now.clientNow)).toEqual(ids(old.clienteAgora))
      expect(ids(now.clientLater)).toEqual(ids(old.clienteDepois))
      expect(ids(now.auster)).toEqual(ids(old.auster))
      expect(now.total).toBe(old.total)
      expect(now.clientNow.map((item) => item.action)).toEqual(old.clienteAgora.map((item) => item.acao))
    }
  }, 180_000)
})
