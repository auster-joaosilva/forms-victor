import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildActionPlan } from '@/server/diagnosis/domain/action-plan'
import { diagnose } from '@/server/diagnosis/domain/diagnose'
import { resultView } from '@/server/diagnosis/domain/result-view'
import { applicableFill } from '@/server/diagnosis/domain/testing/applicable-fill'
import { SubmissionCard, retryWaitText } from './submission-card'

const answers = applicableFill(7)
const diagnosis = diagnose(answers, new Date('2026-09-15T10:00:00-03:00'))
const result = resultView(diagnosis, buildActionPlan(answers, diagnosis))

describe('SubmissionCard', () => {
  it('says the answers were sent, with the server protocol', () => {
    render(<SubmissionCard submission={{ status: 'sent', protocol: 'DS-260915-AB12', result }} onRetry={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Protocolo DS-260915-AB12' })).toBeInTheDocument()
    expect(screen.getByText(/Respostas enviadas automaticamente\./)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('asks to keep the number before sending and shows the send in progress', () => {
    const { rerender } = render(<SubmissionCard submission={{ status: 'idle' }} onRetry={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Protocolo …' })).toBeInTheDocument()
    expect(screen.getByText('Guarde este número: é por ele que a equipe encontra as suas respostas.')).toBeInTheDocument()
    rerender(<SubmissionCard submission={{ status: 'sending' }} onRetry={() => undefined} />)
    expect(screen.getByText('Enviando…')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers to try again after a failure and shows the wait after a 429', async () => {
    const onRetry = vi.fn()
    const { rerender } = render(<SubmissionCard submission={{ status: 'failed', reason: 'sem conexão' }} onRetry={onRetry} />)
    expect(screen.getByText(/Não deu para enviar agora/)).toBeInTheDocument()
    expect(screen.getByText(/\(sem conexão\)/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar minhas respostas agora' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    rerender(<SubmissionCard submission={{ status: 'rate_limited', retryAfterSeconds: 90 }} onRetry={onRetry} />)
    expect(screen.getByText(/Tente de novo em 2 minutos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar minhas respostas agora' })).toBeInTheDocument()
  })

  it('formats the wait', () => {
    expect([retryWaitText(1), retryWaitText(45), retryWaitText(60), retryWaitText(61)]).toEqual(['1 segundo', '45 segundos', '1 minuto', '2 minutos'])
  })
})
