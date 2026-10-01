import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildActionPlan } from '@/server/diagnosis/domain/action-plan'
import { diagnose } from '@/server/diagnosis/domain/diagnose'
import { triageReason } from '@/server/diagnosis/domain/draft-rules'
import { reportSheets } from '@/server/diagnosis/domain/report-sheets'
import { applicableFill } from '@/server/diagnosis/domain/testing/applicable-fill'
import { generateFills } from '@/server/diagnosis/domain/testing/fill-generator'
import { affirmsMerit } from '@/server/diagnosis/domain/testing/screen-text'
import { ReportDocument } from './report-document'

const TODAY = new Date('2026-09-15T10:00:00-03:00')

describe('ReportDocument', () => {
  it('draws 5 or 6 sheets, one summary row per choice question, the protocol and no merit claim', { timeout: 30_000 }, () => {
    let drawn = 0
    for (const answers of generateFills({ count: 500, seed: 31 })) {
      if (triageReason(answers)) continue
      const diagnosis = diagnose(answers, TODAY)
      const sheets = reportSheets({ answers, protocol: 'DS-260915-AB12', issuedOn: TODAY }, diagnosis, buildActionPlan(answers, diagnosis))
      const { container, unmount } = render(<ReportDocument sheets={sheets} toolbar={null} />)
      const text = container.textContent ?? ''
      expect(container.querySelectorAll('.rp-sheet')).toHaveLength(sheets.sheetCount)
      expect(container.querySelectorAll('td.rp-summary-question')).toHaveLength(sheets.summary.blocks.reduce((n, b) => n + b.rows.length, 0))
      expect(text).toContain('DS-260915-AB12')
      expect(text).not.toMatch(/\b(undefined|NaN|null)\b/)
      expect(affirmsMerit(text)).toBeNull()
      if (sheets.meaning.showDeadlines) expect(text).toContain('30 de novembro de 2026')
      unmount()
      drawn++
    }
    expect(drawn).toBeGreaterThan(100)
  })

  it('drops the Auster sheet when there is nothing for the Auster to do', () => {
    const answers = applicableFill(31)
    const diagnosis = diagnose(answers, TODAY)
    const sheets = reportSheets({ answers, protocol: 'DS-260915-AB12', issuedOn: TODAY }, diagnosis, { ...buildActionPlan(answers, diagnosis), auster: [] })
    const { container } = render(<ReportDocument sheets={sheets} toolbar={null} />)
    expect(container.querySelectorAll('.rp-sheet')).toHaveLength(5)
    expect(container.textContent).not.toContain('Como a Auster pode ajudar')
  })
})
