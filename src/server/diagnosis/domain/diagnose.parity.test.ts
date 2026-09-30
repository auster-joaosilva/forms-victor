import { describe, expect, it } from 'vitest'
import * as legacy from '../../../../legacy/src/motor.js'
import { diagnose } from './diagnose'
import { OUTCOMES } from './outcomes'
import { generateFills } from './testing/fill-generator'

const TODAY = new Date('2026-09-15T10:00:00-03:00')
// Legacy returns a copy of SAIDAS.E (with its own `significa`) exactly when there is a conflict.
const legacyOutcomeKey = (old: { saida: object; conflito: object | null }) =>
  old.conflito ? 'E' : Object.entries(legacy.SAIDAS).find(([, value]) => value === old.saida)?.[0]
const outcomeKeyMap: Record<string, string> = {
  E_SEM_DADO: 'E_NO_DATA', SETOR_SEM_CREDITO: 'SECTOR_WITHOUT_CREDIT', FORA: 'OUTSIDE',
}

describe('engine parity over 40 000 fills', () => {
  it('returns the same decision for every fill', () => {
    let checked = 0
    for (const answers of generateFills({ count: 40_000, seed: 20260915 })) {
      const now = diagnose(answers, TODAY)
      const old = legacy.diagnosticar(answers, TODAY)
      const oldKey = legacyOutcomeKey(old) ?? ''
      expect(now.outcomeKey).toBe(outcomeKeyMap[oldKey] ?? oldKey)
      expect(now.outcome.code).toBe(old.saida.codigo)
      expect(now.outcome.meaning).toBe(old.saida.significa)
      expect(now.triggers).toEqual(old.gatilhos)
      expect([now.position.label, now.position.qualifier, now.position.certainty, now.position.family]).toEqual([
        old.posicao.rotulo, old.posicao.qualificador, old.posicao.certeza, old.posicao.familia,
      ])
      expect(now.position.openPoints).toEqual(old.posicao.pontosEmAberto)
      expect([now.confidence.level, now.confidence.gaps, now.confidence.readableGaps]).toEqual([
        old.confianca.nivel, old.confianca.lacunas, old.confianca.lacunasLegiveis,
      ])
      expect(now.urgency).toBe(old.urgencia)
      expect([now.filingDeadline, now.withinLeadTime, now.windowOpen, now.businessDaysToWindowEnd]).toEqual([
        old.dataLimiteProtocolo, old.dentroDaAntecedencia, old.janelaAberta, old.diasUteisAteFimDaJanela,
      ])
      expect(now.radar.map((axis) => axis.score)).toEqual(old.radar.map((axis) => axis.score))
      expect(now.preliminaryReading?.condition ?? null).toBe(old.leituraPreliminar?.condicao ?? null)
      expect(now.conflict && [now.conflict.conflict, now.conflict.decides, now.conflict.gather]).toEqual(
        old.conflito && [old.conflito.conflito, old.conflito.decide, old.conflito.levantar],
      )
      expect([now.derived.creditableRevenue, now.derived.creditDensity, now.derived.estimatedDas]).toEqual([
        old.derivadas.receitaCreditavel, old.derivadas.densidadeCredito, old.derivadas.dasEstimado,
      ])
      expect(now.preliminary).toBe(old.preliminar)
      checked++
    }
    expect(checked).toBe(40_000)
    expect(OUTCOMES.E_NO_DATA.code).toBe('E')
  }, 120_000)
})
