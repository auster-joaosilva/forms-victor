import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { toWireAnswers } from '@/server/diagnosis/domain/draft-rules'
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
  it('erases and stops saving the answer of a question that became invisible', async () => {
    const fake = api()
    render(<DiagnosisPage bootstrap={bootstrap()} api={fake} resume={false} />)
    await userEvent.selectOptions(screen.getByLabelText(/Segmento de atuação/), 'servico_saude')
    await userEvent.click(screen.getByLabelText('Sim, as duas'))
    await userEvent.selectOptions(screen.getByLabelText(/Segmento de atuação/), 'comercio')
    expect(screen.queryByText(/sociedade empresária/)).not.toBeInTheDocument()
    await waitFor(() => expect(fake.saveDraft).toHaveBeenCalled())
    const [last] = fake.saveDraft.mock.lastCall ?? []
    expect(last?.answers).toEqual({ segmento: 'comercio' })
  })

  it('shows the legacy required message on "Próximo" and stays on the step', async () => {
    render(<DiagnosisPage bootstrap={bootstrap()} api={api()} resume={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getAllByText('Obrigatório').length).toBeGreaterThan(5)
    expect(screen.getByText('Etapa 1 de 5')).toBeInTheDocument()
  })

  it('offers to resume a saved draft and starts over on request', async () => {
    const fake = api()
    const draft = { step: 2, answers: { versaoFormulario: 'completo', nomeEmpresa: 'Antiga Ltda' }, savedAt: '2026-09-14T15:30:00.000Z', protocol: null }
    render(<DiagnosisPage bootstrap={bootstrap({ draft })} api={fake} resume={false} />)
    expect(screen.getByText(/Você tem um preenchimento começado de 14\/09\/2026 às 12:30, de Antiga Ltda\./)).toBeInTheDocument()
    expect(screen.getByText('Fica guardado só neste navegador — nada foi enviado.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Começar de novo' }))
    expect(fake.discardDraft).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/preenchimento começado/)).not.toBeInTheDocument()
  })

  it('detours a MEI to the Avaliação Prévia and comes back to step 1', async () => {
    const answers = toWireAnswers({ ...applicableFill(3), ehSimei: 'sim' })
    render(<DiagnosisPage bootstrap={bootstrap({ draft: { step: 1, answers, savedAt: '2026-09-14T15:30:00.000Z', protocol: null } })} api={api()} resume />)
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByRole('heading', { name: 'Como MEI, essa escolha não se aplica a você.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para a Avaliação Prévia da Reforma' })).toHaveAttribute('href', 'https://consultoria.austercontabil.com.br/diagnostico-reforma')
    await userEvent.click(screen.getByRole('button', { name: 'Voltar e corrigir' }))
    expect(screen.getByText('Etapa 1 de 5')).toBeInTheDocument()
  })
})
