import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { buildActionPlan } from '@/server/diagnosis/domain/action-plan'
import { diagnose } from '@/server/diagnosis/domain/diagnose'
import { REVIEW_STEP, toWireAnswers } from '@/server/diagnosis/domain/draft-rules'
import { resultView } from '@/server/diagnosis/domain/result-view'
import { applicableFill } from '@/server/diagnosis/domain/testing/applicable-fill'
import type { DiagnosisApi, DiagnosisBootstrap } from '../types/diagnosis'
import { DiagnosisPage } from './diagnosis-page'

const bootstrap = (extra: Partial<DiagnosisBootstrap> = {}): DiagnosisBootstrap => ({ today: '2026-09-15T13:00:00.000Z', draft: null, invitation: null, ...extra })
const api = () => ({
  saveDraft: vi.fn<DiagnosisApi['saveDraft']>(async () => ({ ok: true })),
  discardDraft: vi.fn<DiagnosisApi['discardDraft']>(async () => undefined),
  lookupCnpj: vi.fn<DiagnosisApi['lookupCnpj']>(async () => ({ ok: false, reason: 'indisponível' })),
  submitDiagnosis: vi.fn<DiagnosisApi['submitDiagnosis']>(async () => ({ ok: false, reason: 'no_draft' })),
})

describe('DiagnosisPage — form', () => {
  it('keeps the step fields and buttons disabled until hydrated, so nothing typed early is lost', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToString(<DiagnosisPage bootstrap={bootstrap()} api={api()} resume={false} onDownloadReport={() => undefined} />)
    expect(host.querySelector<HTMLInputElement>('[data-field="nomeEmpresa"] input')?.matches(':disabled')).toBe(true)
    expect([...host.querySelectorAll<HTMLButtonElement>('.dx-nav button')].every((button) => button.matches(':disabled'))).toBe(true)
  })

  it('enables the step fields once hydrated', () => {
    render(<DiagnosisPage bootstrap={bootstrap()} api={api()} resume={false} onDownloadReport={() => undefined} />)
    expect(screen.getByRole('textbox', { name: /Nome da empresa/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeEnabled()
  })

  it('erases and stops saving the answer of a question that became invisible', async () => {
    const fake = api()
    render(<DiagnosisPage bootstrap={bootstrap()} api={fake} resume={false} onDownloadReport={() => undefined} />)
    await userEvent.selectOptions(screen.getByLabelText(/Segmento de atuação/), 'servico_saude')
    await userEvent.click(screen.getByLabelText('Sim, as duas'))
    await userEvent.selectOptions(screen.getByLabelText(/Segmento de atuação/), 'comercio')
    expect(screen.queryByText(/sociedade empresária/)).not.toBeInTheDocument()
    await waitFor(() => expect(fake.saveDraft).toHaveBeenCalled())
    const [last] = fake.saveDraft.mock.lastCall ?? []
    expect(last?.answers).toEqual({ segmento: 'comercio' })
  })

  it('shows the legacy required message on "Próximo" and stays on the step', async () => {
    render(<DiagnosisPage bootstrap={bootstrap()} api={api()} resume={false} onDownloadReport={() => undefined} />)
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getAllByText('Obrigatório').length).toBeGreaterThan(5)
    expect(screen.getByText('Etapa 1 de 5')).toBeInTheDocument()
  })

  it('offers to resume a saved draft and starts over on request', async () => {
    const fake = api()
    const draft = { step: 2, answers: { versaoFormulario: 'completo', nomeEmpresa: 'Antiga Ltda' }, savedAt: '2026-09-14T15:30:00.000Z', protocol: null }
    render(<DiagnosisPage bootstrap={bootstrap({ draft })} api={fake} resume={false} onDownloadReport={() => undefined} />)
    expect(screen.getByText(/Você tem um preenchimento começado de 14\/09\/2026 às 12:30, de Antiga Ltda\./)).toBeInTheDocument()
    expect(screen.getByText('Fica guardado só neste navegador — nada foi enviado.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Começar de novo' }))
    expect(fake.discardDraft).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/preenchimento começado/)).not.toBeInTheDocument()
  })

  it('starts over when the person answers without choosing on the resume offer', async () => {
    const fake = api()
    const draft = { step: 2, answers: { versaoFormulario: 'completo', nomeEmpresa: 'Antiga Ltda' }, savedAt: '2026-09-14T15:30:00.000Z', protocol: 'DS-260914-AB12' }
    render(<DiagnosisPage bootstrap={bootstrap({ draft })} api={fake} resume={false} onDownloadReport={() => undefined} />)
    await userEvent.type(screen.getByRole('textbox', { name: /Nome da empresa/ }), 'Nova')
    expect(screen.queryByText(/preenchimento começado/)).not.toBeInTheDocument()
    await waitFor(() => expect(fake.saveDraft).toHaveBeenCalled())
    expect(fake.discardDraft).toHaveBeenCalledTimes(1)
    expect(fake.discardDraft.mock.invocationCallOrder[0]).toBeLessThan(fake.saveDraft.mock.invocationCallOrder[0] ?? 0)
    expect(fake.saveDraft.mock.lastCall?.[0].answers).toEqual({ nomeEmpresa: 'Nova' })
  })

  it('detours a MEI to the Avaliação Prévia and comes back to step 1', async () => {
    const answers = toWireAnswers({ ...applicableFill(3), ehSimei: 'sim' })
    render(<DiagnosisPage bootstrap={bootstrap({ draft: { step: 1, answers, savedAt: '2026-09-14T15:30:00.000Z', protocol: null } })} api={api()} resume onDownloadReport={() => undefined} />)
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByRole('heading', { name: 'Como MEI, essa escolha não se aplica a você.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para a Avaliação Prévia da Reforma' })).toHaveAttribute('href', 'https://consultoria.austercontabil.com.br/diagnostico-reforma')
    await userEvent.click(screen.getByRole('button', { name: 'Voltar e corrigir' }))
    expect(screen.getByText('Etapa 1 de 5')).toBeInTheDocument()
  })
})

describe('DiagnosisPage — review and result', () => {
  it('goes from the review to the result, sends it and shows what the server recalculated', async () => {
    const answers = applicableFill(4)
    const diagnosis = diagnose(answers, new Date('2026-09-15T10:00:00-03:00'))
    const computed = resultView(diagnosis, buildActionPlan(answers, diagnosis))
    const recalculated = { ...computed, decision: { ...computed.decision, label: 'Recalculado pelo servidor' } }
    const fake = api()
    fake.submitDiagnosis.mockResolvedValue({ ok: true, protocol: 'DS-260915-AB12', result: recalculated })
    const onDownloadReport = vi.fn()
    const draft = { step: REVIEW_STEP, answers: toWireAnswers(answers), savedAt: '2026-09-14T15:30:00.000Z', protocol: null }
    render(<DiagnosisPage bootstrap={bootstrap({ draft })} api={fake} resume onDownloadReport={onDownloadReport} />)
    expect(screen.getByRole('heading', { name: 'Confira antes de ver o resultado' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver diagnóstico' }))
    expect(await screen.findByRole('heading', { name: 'Protocolo DS-260915-AB12' })).toBeInTheDocument()
    expect(screen.getByText('Recalculado pelo servidor')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Baixar o plano de ação em PDF' }))
    expect(onDownloadReport).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Revisar respostas' }))
    expect(screen.getByRole('heading', { name: 'Confira antes de ver o resultado' })).toBeInTheDocument()
  })
})
