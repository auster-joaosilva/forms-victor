import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { buildActionPlan } from '@/server/diagnosis/domain/action-plan'
import { diagnose } from '@/server/diagnosis/domain/diagnose'
import { toWireAnswers } from '@/server/diagnosis/domain/draft-rules'
import { resultView, type ResultView } from '@/server/diagnosis/domain/result-view'
import { fieldProblem } from '@/server/diagnosis/domain/validate-answers'
import type { DiagnosisApi, DiagnosisBootstrap, SaveDraftWireResult } from '../types/diagnosis'
import { NO_CONNECTION, SUBMIT_FAILURES, formReducer, initialFormState, sameCnpj, stepOf, type FormState } from './form-state'

export const SAVE_DELAY_MS = 600

export interface DiagnosisForm {
  state: FormState
  shownResult: ResultView | null
  actions: {
    setAnswer(key: string, value: string): void
    setMatrixAnswer(key: string, row: string, value: string): void
    blurField(key: string): void
    next(): void
    back(): void
    goTo(step: number): void
    goToField(block: number, key: string): void
    clearHighlight(): void
    resume(): void
    startOver(): void
    retrySubmit(): void
  }
}

const textAnswer = (state: FormState, key: string) => {
  const value = state.answers[key]
  return typeof value === 'string' ? value : ''
}

export function useDiagnosisForm(bootstrap: DiagnosisBootstrap, { api, resume = false }: { api: DiagnosisApi; resume?: boolean }): DiagnosisForm {
  const [state, dispatch] = useReducer(formReducer, bootstrap, (initial) => initialFormState(initial, { resume }))
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
  })
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submitting = useRef(false)
  const today = useMemo(() => new Date(bootstrap.today), [bootstrap.today])

  const cancelPendingSave = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const discardDraft = () => {
    cancelPendingSave()
    queue.current = queue.current.then(() => api.discardDraft()).catch(() => undefined)
  }

  // Answering past the resume offer starts a new fill: saving into the old draft would overwrite the response it already sent.
  const startOverIfOffered = () => {
    if (latest.current.resumable) discardDraft()
  }

  const persist = useCallback((): Promise<SaveDraftWireResult | null> => {
    const save = async () => {
      const current = latest.current
      try {
        const saved = await api.saveDraft({ step: stepOf(current.view), answers: toWireAnswers(current.answers), invitationToken: current.invitationToken })
        dispatch({ type: saved.ok ? 'saveSucceeded' : 'saveFailed' })
        return saved
      } catch {
        dispatch({ type: 'saveFailed' })
        return null
      }
    }
    const saving = queue.current.then(save)
    queue.current = saving
    return saving
  }, [api])

  const submit = useCallback(async () => {
    if (submitting.current) return
    submitting.current = true
    dispatch({ type: 'submitStarted' })
    cancelPendingSave()
    try {
      const saved = await persist()
      if (!saved) return dispatch({ type: 'submitFailed', reason: NO_CONNECTION })
      if (!saved.ok) return dispatch({ type: 'submitRateLimited', retryAfterSeconds: saved.retryAfterSeconds })
      const sent = await api.submitDiagnosis()
      if (sent.ok) dispatch({ type: 'submitSucceeded', protocol: sent.protocol, result: sent.result })
      else if (sent.reason === 'rate_limited') dispatch({ type: 'submitRateLimited', retryAfterSeconds: sent.retryAfterSeconds })
      else dispatch({ type: 'submitFailed', reason: SUBMIT_FAILURES[sent.reason] })
    } catch {
      dispatch({ type: 'submitFailed', reason: NO_CONNECTION })
    } finally {
      submitting.current = false
    }
  }, [api, persist])

  // Declared before the submit effect: on entering the result the debounce is armed and the submit effect cancels it.
  useEffect(() => {
    if (state.revision === 0) return
    cancelPendingSave()
    timer.current = setTimeout(() => {
      timer.current = null
      void persist()
    }, SAVE_DELAY_MS)
    return cancelPendingSave
  }, [state.revision, persist])

  useEffect(() => {
    if (state.view.kind === 'result' && state.submission.status === 'idle') void submit()
  }, [state.view.kind, state.submission.status, submit])

  const lookup = useCallback(
    async (cnpj: string, quiet: boolean) => {
      if (!quiet) dispatch({ type: 'companyLookupStarted', cnpj })
      try {
        const requesterName = textAnswer(latest.current, 'solicitante') || undefined
        const result = await api.lookupCnpj({ cnpj, requesterName })
        if (quiet) return
        dispatch(result.ok ? { type: 'companyLookupFound', cnpj, company: result.company } : { type: 'companyLookupFailed', cnpj, reason: result.reason })
      } catch {
        if (!quiet) dispatch({ type: 'companyLookupFailed', cnpj, reason: 'indisponível' })
      }
    },
    [api],
  )

  const blurField = useCallback(
    (key: string) => {
      dispatch({ type: 'blur', key })
      const current = latest.current
      const value = textAnswer(current, key)
      if (!value.trim() || fieldProblem(current.answers, key)) return
      const { company } = current
      if (key === 'cnpj') {
        const alreadyLooked = (company.status === 'found' || company.status === 'loading') && sameCnpj(company.cnpj, value)
        if (!alreadyLooked) void lookup(value, false)
      }
      if (key === 'solicitante' && company.status === 'found') void lookup(company.cnpj, true)
    },
    [lookup],
  )

  const shownResult = useMemo(() => {
    if (state.view.kind !== 'result') return null
    if (state.submission.status === 'sent') return state.submission.result
    const diagnosis = diagnose(state.answers, today)
    return resultView(diagnosis, buildActionPlan(state.answers, diagnosis))
  }, [state.view.kind, state.submission, state.answers, today])

  return {
    state,
    shownResult,
    actions: {
      setAnswer: (key, value) => {
        startOverIfOffered()
        dispatch({ type: 'answer', key, value })
      },
      setMatrixAnswer: (key, row, value) => {
        startOverIfOffered()
        dispatch({ type: 'answerMatrix', key, row, value })
      },
      blurField,
      next: () => dispatch({ type: 'next' }),
      back: () => dispatch({ type: 'back' }),
      goTo: (step) => dispatch({ type: 'goTo', step }),
      goToField: (block, key) => dispatch({ type: 'goToField', block, key }),
      clearHighlight: () => dispatch({ type: 'clearHighlight' }),
      resume: () => dispatch({ type: 'resume' }),
      startOver: () => {
        dispatch({ type: 'startOver' })
        discardDraft()
      },
      retrySubmit: () => void submit(),
    },
  }
}
