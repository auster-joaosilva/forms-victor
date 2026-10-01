import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { reviewItems } from '@/server/diagnosis/domain/review'
import { visibleQuestions } from '@/server/diagnosis/domain/questions'
import { applicableFill } from '@/server/diagnosis/domain/testing/applicable-fill'
import { ReviewScreen } from './review-screen'

describe('ReviewScreen', () => {
  it('lists every visible question, tags the deciding ones and jumps to the field', async () => {
    const answers = applicableFill(5)
    const onChange = vi.fn()
    const { container } = render(<ReviewScreen review={reviewItems(answers)} onBack={() => undefined} onNext={() => undefined} onChange={onChange} />)
    expect(container.querySelectorAll('.dx-review-row')).toHaveLength(visibleQuestions(answers).length)
    expect(screen.getAllByText('decide').length).toBeGreaterThan(1)
    await userEvent.click(screen.getAllByRole('button', { name: 'alterar' })[0] as HTMLElement)
    expect(onChange).toHaveBeenCalledWith(1, expect.any(String))
  })

  it('lists the gaps that weigh on the decision', () => {
    const answers = { ...applicableFill(5), margemLiquida: 'nao_sei' }
    render(<ReviewScreen review={reviewItems(answers)} onBack={() => undefined} onNext={() => undefined} onChange={() => undefined} />)
    expect(screen.getByText(/em "não sei"/)).toBeInTheDocument()
  })
})
