import { describe, expect, it } from 'vitest'
import { buildActionPlan } from './action-plan'
import { diagnose } from './diagnose'
import { visibleQuestions } from './questions'
import { reportSheets } from './report-sheets'
import { resultView } from './result-view'
import { reviewItems } from './review'
import { generateFills } from './testing/fill-generator'
import { affirmsMerit, collectText } from './testing/screen-text'
import { validateAnswers } from './validate-answers'

const TODAY = new Date('2026-09-15T10:00:00-03:00')
const PROTOCOL = 'DS-260915-AB12'

// Plain loops collect the offenders and one expect reports them: an expect per text makes 40 000 fills take minutes.
function expectCleanScreen(view: unknown) {
  const { texts, numbers } = collectText(view)
  const leaked = texts.filter((text) => /\b(undefined|NaN)\b/.test(text) || text.trim() === 'null')
  expect(leaked).toEqual([])
  expect(numbers.filter((number) => !Number.isFinite(number))).toEqual([])
  expect(affirmsMerit(texts.join(' '))).toBeNull()
}

// origin/main testes.mjs (212aea5): a data revogada é pior que nenhuma, porque o cliente planeja por ela.
// Cobra a data como prazo ("até …"); "Emitido em 30 de setembro" é data de emissão, não promessa.
const REVOKED_DEADLINE = /at[ée]\s+30 de (setembro|novembro)|30\/09\/2026|30\/11\/2026/
function expectNoRevokedDeadline(view: unknown) {
  expect(collectText(view).texts.filter((text) => REVOKED_DEADLINE.test(text))).toEqual([])
}

describe('screen invariants over 40 000 fills', () => {
  it('holds every screen invariant of the legacy battery (#18–22, #25–30)', () => {
    let checked = 0
    for (const answers of generateFills({ count: 40_000, seed: 20260915 })) {
      const diagnosis = diagnose(answers, TODAY)
      const plan = buildActionPlan(answers, diagnosis)
      const result = resultView(diagnosis, plan)
      const review = reviewItems(answers)
      const report = reportSheets({ answers, protocol: PROTOCOL, issuedOn: TODAY }, diagnosis, plan)
      const visible = visibleQuestions(answers)
      const reviewRows = review.blocks.flatMap((block) => block.rows)

      expect(validateAnswers(answers)).toEqual({})
      expect(review.total).toBe(visible.length)
      expect(reviewRows.map((row) => row.key).sort()).toEqual(visible.map((question) => question.key).sort())
      for (const row of reviewRows) {
        if (visible.find((question) => question.key === row.key)?.required !== 'never') expect(row.answer).not.toBeNull()
      }
      if (diagnosis.position.family === 'hibrido') expect(result.decision.showWithdrawalNotice).toBe(true)
      expectCleanScreen(result)
      expectCleanScreen(report)
      expectNoRevokedDeadline(result)
      expectNoRevokedDeadline(review)
      expectNoRevokedDeadline(report)
      expect(report.sheetCount).toBe(plan.auster.length ? 6 : 5)
      const choiceQuestions = visible.filter((question) => question.type !== 'consent' && question.type !== 'textarea')
      expect(report.summary.blocks.reduce((total, block) => total + block.rows.length, 0)).toBe(choiceQuestions.length)
      expect(report.cover.protocol).toMatch(/^DS-\d{6}-[A-Z0-9]{4}$/)
      checked++
    }
    expect(checked).toBe(40_000)
  }, 300_000)
})
