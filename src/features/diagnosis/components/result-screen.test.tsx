import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildActionPlan } from '@/server/diagnosis/domain/action-plan'
import { diagnose } from '@/server/diagnosis/domain/diagnose'
import { triageReason } from '@/server/diagnosis/domain/draft-rules'
import { resultView, type ResultView } from '@/server/diagnosis/domain/result-view'
import { generateFills } from '@/server/diagnosis/domain/testing/fill-generator'
import { affirmsMerit } from '@/server/diagnosis/domain/testing/screen-text'
import type { SubmissionState } from '../hooks/form-state'
import { ResultScreen } from './result-screen'

const TODAY = new Date('2026-09-15T10:00:00-03:00')
const views: ResultView[] = []
for (const answers of generateFills({ count: 600, seed: 99 })) {
  if (triageReason(answers)) continue
  const diagnosis = diagnose(answers, TODAY)
  views.push(resultView(diagnosis, buildActionPlan(answers, diagnosis)))
}
const sent = { status: 'sent' as const, protocol: 'DS-260915-AB12', result: views[0] as ResultView }
const draw = (view: ResultView, submission: SubmissionState = sent, onDownload = () => undefined) =>
  render(<ResultScreen view={view} submission={submission} onRetry={() => undefined} onReview={() => undefined} onDownload={onDownload} />)

describe('ResultScreen', () => {
  it('shows the November protection on hybrid decisions', () => {
    const hybrid = views.find((view) => view.decision.family === 'hibrido')
    if (!hybrid) throw new Error('a amostra não gerou decisão híbrida')
    draw(hybrid)
    expect(screen.getByText('Setembro não volta; novembro ainda dá.')).toBeInTheDocument()
    expect(document.body.textContent).toContain('30 de novembro de 2026')
  })

  it('never shows undefined, NaN, null or an economic merit claim, and dropped WhatsApp and the engine panel', { timeout: 20_000 }, () => {
    for (const view of views.slice(0, 200)) {
      const { container, unmount } = draw(view)
      const text = container.textContent ?? ''
      expect(text).not.toMatch(/\b(undefined|NaN|null)\b/)
      expect(affirmsMerit(text)).toBeNull()
      expect(text).not.toMatch(/WhatsApp|dados do motor/)
      unmount()
    }
  })

  it('keeps the three cautions and the two closing buttons', async () => {
    const onDownload = vi.fn()
    draw(views[0] as ResultView, sent, onDownload)
    expect(screen.getByText('Três coisas para não errar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar respostas' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Baixar o plano de ação em PDF' }))
    expect(onDownload).toHaveBeenCalledTimes(1)
  })

  it('keeps the PDF closed until the answers are recorded', () => {
    draw(views[0] as ResultView, { status: 'sending' })
    expect(screen.getByRole('button', { name: 'Baixar o plano de ação em PDF' })).toBeDisabled()
  })
})
