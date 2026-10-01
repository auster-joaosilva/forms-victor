import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildActionPlan } from '@/server/diagnosis/domain/action-plan'
import { diagnose } from '@/server/diagnosis/domain/diagnose'
import { RESULT_STEP, REVIEW_STEP, toWireAnswers } from '@/server/diagnosis/domain/draft-rules'
import { resultView } from '@/server/diagnosis/domain/result-view'
import { applicableFill } from '@/server/diagnosis/domain/testing/applicable-fill'
import type { DiagnosisApi, DiagnosisBootstrap } from '../types/diagnosis'
import { SAVE_DELAY_MS, useDiagnosisForm } from './use-diagnosis-form'

const TODAY = '2026-09-15T13:00:00.000Z'
const bootstrap = (extra: Partial<DiagnosisBootstrap> = {}): DiagnosisBootstrap => ({ today: TODAY, draft: null, invitation: null, ...extra })

function fakeApi(overrides: Partial<DiagnosisApi> = {}) {
  return {
    saveDraft: vi.fn<DiagnosisApi['saveDraft']>(async () => ({ ok: true })),
    discardDraft: vi.fn<DiagnosisApi['discardDraft']>(async () => undefined),
    lookupCnpj: vi.fn<DiagnosisApi['lookupCnpj']>(async () => ({ ok: false, reason: 'indisponível' })),
    submitDiagnosis: vi.fn<DiagnosisApi['submitDiagnosis']>(async () => ({ ok: false, reason: 'no_draft' })),
    ...overrides,
  }
}

afterEach(() => vi.useRealTimers())

describe('useDiagnosisForm', () => {
  it('erases the answer of a question that became invisible', () => {
    const { result } = renderHook(() => useDiagnosisForm(bootstrap(), { api: fakeApi() }))
    act(() => result.current.actions.setAnswer('segmento', 'servico_saude'))
    act(() => result.current.actions.setAnswer('servicoHospitalar', 'sim'))
    expect(result.current.state.answers.servicoHospitalar).toBe('sim')
    act(() => result.current.actions.setAnswer('segmento', 'comercio'))
    expect(result.current.state.answers).not.toHaveProperty('servicoHospitalar')
  })

  it('saves once, 600 ms after the last change, with the latest answers', async () => {
    vi.useFakeTimers()
    const api = fakeApi()
    const { result } = renderHook(() => useDiagnosisForm(bootstrap(), { api }))
    act(() => result.current.actions.setAnswer('versaoFormulario', 'sintetico'))
    act(() => vi.advanceTimersByTime(300))
    act(() => result.current.actions.setAnswer('nomeEmpresa', 'Empresa X'))
    act(() => vi.advanceTimersByTime(SAVE_DELAY_MS - 1))
    expect(api.saveDraft).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(1))
    expect(api.saveDraft).toHaveBeenCalledTimes(1)
    expect(api.saveDraft).toHaveBeenCalledWith({ step: 1, answers: { versaoFormulario: 'sintetico', nomeEmpresa: 'Empresa X' }, invitationToken: null })
  })

  it('shows a save failure and clears it on the next successful save', async () => {
    vi.useFakeTimers()
    const api = fakeApi()
    vi.mocked(api.saveDraft).mockResolvedValueOnce({ ok: false, reason: 'rate_limited', retryAfterSeconds: 10 })
    const { result } = renderHook(() => useDiagnosisForm(bootstrap(), { api }))
    act(() => result.current.actions.setAnswer('versaoFormulario', 'sintetico'))
    await act(async () => vi.advanceTimersByTime(SAVE_DELAY_MS))
    expect(result.current.state.saveFailed).toBe(true)
    act(() => result.current.actions.setAnswer('versaoFormulario', 'completo'))
    await act(async () => vi.advanceTimersByTime(SAVE_DELAY_MS))
    expect(result.current.state.saveFailed).toBe(false)
  })

  it('offers to resume, resumes at the saved step and starts over on request', async () => {
    const api = fakeApi()
    const draft = { step: 3, answers: { versaoFormulario: 'completo', nomeEmpresa: 'Antiga' }, savedAt: '2026-09-14T12:00:00.000Z', protocol: null }
    const { result } = renderHook(() => useDiagnosisForm(bootstrap({ draft }), { api }))
    expect(result.current.state.resumable).not.toBeNull()
    expect(result.current.state.view).toEqual({ kind: 'form', step: 1 })
    act(() => result.current.actions.resume())
    expect(result.current.state.view).toEqual({ kind: 'form', step: 3 })
    expect(result.current.state.answers.nomeEmpresa).toBe('Antiga')
    await act(async () => result.current.actions.startOver())
    expect(result.current.state.answers).toEqual({})
    expect(api.discardDraft).toHaveBeenCalledTimes(1)
  })

  it('prefills the invitation and sends its token with the save', async () => {
    vi.useFakeTimers()
    const api = fakeApi()
    const invitation = { token: 'ABCDEFGHJK', companyName: 'Convidada', cnpj: '11.222.333/0001-81' }
    const { result } = renderHook(() => useDiagnosisForm(bootstrap({ invitation }), { api }))
    expect(result.current.state.answers).toEqual({ nomeEmpresa: 'Convidada', cnpj: '11.222.333/0001-81' })
    act(() => result.current.actions.setAnswer('versaoFormulario', 'sintetico'))
    await act(async () => vi.advanceTimersByTime(SAVE_DELAY_MS))
    expect(api.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ invitationToken: 'ABCDEFGHJK' }))
  })

  it('on reaching the result, saves at once, submits once and shows the server result', async () => {
    const answers = applicableFill(7)
    const diagnosis = diagnose(answers, new Date(TODAY))
    const serverView = { ...resultView(diagnosis, buildActionPlan(answers, diagnosis)), windowText: 'do servidor' }
    const api = fakeApi({ submitDiagnosis: vi.fn<DiagnosisApi['submitDiagnosis']>(async () => ({ ok: true, protocol: 'DS-260915-AB12', result: serverView })) })
    const draft = { step: REVIEW_STEP, answers: toWireAnswers(answers), savedAt: TODAY, protocol: null }
    const { result } = renderHook(() => useDiagnosisForm(bootstrap({ draft }), { api, resume: true }))
    expect(result.current.state.view).toEqual({ kind: 'review' })
    act(() => result.current.actions.next())
    expect(result.current.shownResult).not.toBeNull()
    await waitFor(() => expect(result.current.state.submission.status).toBe('sent'))
    expect(api.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ step: RESULT_STEP }))
    expect(api.submitDiagnosis).toHaveBeenCalledTimes(1)
    expect(result.current.shownResult?.windowText).toBe('do servidor')
  })

  it('sends saves one at a time and submits only after the pending ones', async () => {
    const answers = applicableFill(7)
    let release: (value: { ok: true }) => void = () => undefined
    const api = fakeApi()
    vi.mocked(api.saveDraft).mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
    const draft = { step: REVIEW_STEP, answers: toWireAnswers(answers), savedAt: TODAY, protocol: null }
    vi.useFakeTimers()
    const { result } = renderHook(() => useDiagnosisForm(bootstrap({ draft }), { api, resume: true }))
    act(() => result.current.actions.setAnswer('nomeEmpresa', 'Primeira'))
    await act(async () => vi.advanceTimersByTime(SAVE_DELAY_MS))
    expect(api.saveDraft).toHaveBeenCalledTimes(1)
    act(() => result.current.actions.next())
    await act(async () => vi.advanceTimersByTime(0))
    expect(api.saveDraft).toHaveBeenCalledTimes(1)
    expect(api.submitDiagnosis).not.toHaveBeenCalled()
    await act(async () => release({ ok: true }))
    expect(api.saveDraft).toHaveBeenCalledTimes(2)
    expect(api.saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({ step: RESULT_STEP }))
    expect(api.submitDiagnosis).toHaveBeenCalledTimes(1)
  })

  it('shows the wait time when the server answers 429', async () => {
    const answers = applicableFill(7)
    const api = fakeApi({ submitDiagnosis: vi.fn<DiagnosisApi['submitDiagnosis']>(async () => ({ ok: false, reason: 'rate_limited', retryAfterSeconds: 90 })) })
    const draft = { step: RESULT_STEP, answers: toWireAnswers(answers), savedAt: TODAY, protocol: null }
    const { result } = renderHook(() => useDiagnosisForm(bootstrap({ draft }), { api, resume: true }))
    await waitFor(() => expect(result.current.state.submission).toEqual({ status: 'rate_limited', retryAfterSeconds: 90 }))
  })

  it('looks the CNPJ up on blur and fills the blank company fields', async () => {
    const api = fakeApi({
      lookupCnpj: vi.fn<DiagnosisApi['lookupCnpj']>(async () => ({
        ok: true, requesterInQsa: null,
        company: { legalName: 'RAZÃO LTDA', city: 'UBERLANDIA', state: 'MG', simplesOptant: true, meiOptant: false, active: true, registrationStatus: 'ATIVA' },
      })),
    })
    const { result } = renderHook(() => useDiagnosisForm(bootstrap(), { api }))
    act(() => result.current.actions.setAnswer('cnpj', '11.222.333/0001-81'))
    act(() => result.current.actions.blurField('cnpj'))
    await waitFor(() => expect(result.current.state.company.status).toBe('found'))
    expect(api.lookupCnpj).toHaveBeenCalledWith({ cnpj: '11.222.333/0001-81', requesterName: undefined })
    expect(result.current.state.answers).toMatchObject({ nomeEmpresa: 'RAZÃO LTDA', ehSimei: 'nao', regimeAtual: 'simples' })
  })
})
