import { describe, expect, it } from 'vitest'
import { diagnose } from './diagnose'
import { buildActionPlan } from './action-plan'
import { POSITIONS } from './outcomes'
import { generateFills } from './testing/fill-generator'

const TODAY = new Date('2026-09-15T10:00:00-03:00')
const positionKeys = new Set(Object.keys(POSITIONS))
const positionLabels = new Set(Object.values(POSITIONS).map((position) => position.label))
const technicalName = /\b(?:[a-z]+[A-Z][a-zA-Z]*|[a-z]{3,}_[a-z_]{3,})\b/
const purchasesAsRevenue = /compras que geram crédito são[^.]*da receita/
const purchasesConflict = /das suas compras vêm de fornecedores/
const outsideRegime = ['parte_fora_do_regime', 'maior_parte_fora']

describe('engine invariants over 40 000 fills', () => {
  it('holds every invariant', () => {
    let producedNoData = false
    let producedPurchaseConflict = false
    for (const answers of generateFills({ count: 40_000, seed: 20260915 })) {
      const d = diagnose(answers, TODAY)
      const plan = buildActionPlan(answers, d)
      if (d.outcomeKey === 'E_NO_DATA') {
        producedNoData = true
        expect(d.conflict).toBeNull()
      }
      if (d.conflict && purchasesConflict.test(d.conflict.conflict)) producedPurchaseConflict = true
      if (d.conflict) expect(d.conflict.conflict).not.toMatch(purchasesAsRevenue)
      if (d.derived.dasCheck === 'fora_do_intervalo') {
        expect(d.position.openPoints.some((point) => point.includes('alíquota efetiva'))).toBe(true)
        if (['padrao', 'hibrido', 'a_definir'].includes(d.position.family)) {
          expect(d.position.certainty).not.toBe('fechada')
        }
      }
      expect(d.outcome.title && d.outcome.summary && d.outcome.meaning && d.outcome.modality).toBeTruthy()
      expect(positionKeys.has(d.position.key)).toBe(true)
      expect(positionLabels.has(d.position.label)).toBe(true)
      if (d.position.certainty === 'fechada') expect(d.position.openPoints).toHaveLength(0)
      if (d.position.certainty === 'aberta' && d.position.family !== 'a_definir') {
        expect(d.position.openPoints.length).toBeGreaterThan(0)
      }
      if (d.confidence.level === 'ALTA') expect(d.confidence.gaps).toHaveLength(0)
      expect(d.confidence.gaps.length).toBe(d.confidence.readableGaps.length)
      d.confidence.readableGaps.forEach((gap) => expect(gap).not.toMatch(technicalName))
      if (d.derived.creditableRevenue === null) {
        expect(d.triggers.some((t) => t.startsWith('gate_')) || d.outcome.code === 'E').toBe(true)
      }
      d.radar.forEach((axis) => {
        if (axis.score !== null) {
          expect(axis.score).toBeGreaterThanOrEqual(0)
          expect(axis.score).toBeLessThanOrEqual(100)
        }
      })
      expect(plan.total).toBeGreaterThan(0)
      ;[...plan.clientNow, ...plan.clientLater, ...plan.auster].forEach((item) => {
        expect(item.action && item.reason).toBeTruthy()
        expect([1, 2]).toContain(item.track)
      })
      ;[...plan.clientNow, ...plan.clientLater].forEach((item) => expect(item.executor).toBe('client'))
      if (['ESPECIAL-MEI', 'ESPECIAL-FORA-DO-SIMPLES'].includes(d.outcome.code)) {
        expect(d.position.label).toBe(POSITIONS.nao_se_aplica.label)
      }
      if (answers.ehSimei === 'sim' || (answers.regimeAtual && answers.regimeAtual !== 'simples')) {
        expect(d.position.key).toBe('nao_se_aplica')
      }
      if (
        answers.setorDiferenciado === 'bares_restaurantes' &&
        outsideRegime.includes(String(answers.composicaoAlimentacao))
      ) {
        expect(d.outcomeKey).not.toBe('SECTOR_WITHOUT_CREDIT')
      }
    }
    expect(producedNoData).toBe(true)
    expect(producedPurchaseConflict).toBe(true)
  }, 180_000)
})
