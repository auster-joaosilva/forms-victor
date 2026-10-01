import { applyCompanyPrefill, type CompanyBadge } from '@/server/diagnosis/domain/company-badge'
import { FORM_STEPS, RESULT_STEP, REVIEW_STEP, cleanInvisibleAnswers, triageReason, type TriageReason } from '@/server/diagnosis/domain/draft-rules'
import type { Answers, MatrixAnswer } from '@/server/diagnosis/domain/question-types'
import type { ResultView } from '@/server/diagnosis/domain/result-view'
import { fieldProblem, stepProblems, type AnswerProblems } from '@/server/diagnosis/domain/validate-answers'
import type { DiagnosisBootstrap, SubmitWireResult } from '../types/diagnosis'

export type View =
  | { kind: 'form'; step: number }
  | { kind: 'review' }
  | { kind: 'result' }
  | { kind: 'referral'; reason: TriageReason; returnStep: number }

export type CompanyState =
  | { status: 'idle' }
  | { status: 'loading'; cnpj: string }
  | { status: 'failed'; cnpj: string; reason: string }
  | { status: 'found'; cnpj: string; company: CompanyBadge }

export type SubmissionState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent'; protocol: string; result: ResultView }
  | { status: 'failed'; reason: string }
  | { status: 'rate_limited'; retryAfterSeconds: number }

export interface Resumable {
  step: number
  answers: Answers
  savedAt: string
  protocol: string | null
}

export interface FormState {
  view: View
  answers: Answers
  errors: AnswerProblems
  resumable: Resumable | null
  invitationToken: string | null
  company: CompanyState
  saveFailed: boolean
  submission: SubmissionState
  highlight: string | null
  revision: number
}

export type FormAction =
  | { type: 'answer'; key: string; value: string }
  | { type: 'answerMatrix'; key: string; row: string; value: string }
  | { type: 'blur'; key: string }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'goTo'; step: number }
  | { type: 'goToField'; block: number; key: string }
  | { type: 'clearHighlight' }
  | { type: 'resume' }
  | { type: 'startOver' }
  | { type: 'companyLookupStarted'; cnpj: string }
  | { type: 'companyLookupFailed'; cnpj: string; reason: string }
  | { type: 'companyLookupFound'; cnpj: string; company: CompanyBadge }
  | { type: 'saveFailed' }
  | { type: 'saveSucceeded' }
  | { type: 'submitStarted' }
  | { type: 'submitSucceeded'; protocol: string; result: ResultView }
  | { type: 'submitFailed'; reason: string }
  | { type: 'submitRateLimited'; retryAfterSeconds: number }

type FailureReason = Exclude<Extract<SubmitWireResult, { ok: false }>['reason'], 'rate_limited'>

export const NO_CONNECTION = 'sem conexão'

export const SUBMIT_FAILURES: Record<FailureReason, string> = {
  no_draft: 'o rascunho não foi encontrado',
  no_consent: 'falta o aceite de privacidade',
  not_applicable: 'este diagnóstico não se aplica ao seu caso',
  invalid: 'há respostas obrigatórias em branco',
}

const alphanumeric = (value: string) => value.replace(/[^0-9A-Za-z]/g, '').toUpperCase()

export const sameCnpj = (a: string, b: string) => alphanumeric(a) === alphanumeric(b)

const answeredCnpj = (state: FormState) => String(state.answers.cnpj ?? '')

export function stepOf(view: View): number {
  if (view.kind === 'form') return view.step
  if (view.kind === 'review') return REVIEW_STEP
  if (view.kind === 'result') return RESULT_STEP
  return view.returnStep
}

const viewOf = (step: number): View =>
  step >= RESULT_STEP ? { kind: 'result' } : step === REVIEW_STEP ? { kind: 'review' } : { kind: 'form', step: Math.max(1, step) }

const withoutKey = (errors: AnswerProblems, key: string): AnswerProblems =>
  Object.fromEntries(Object.entries(errors).filter(([name]) => name !== key))

function changeAnswers(state: FormState, answers: Answers, key: string): FormState {
  const company =
    key === 'cnpj' && state.company.status !== 'idle' && !sameCnpj(String(answers.cnpj ?? ''), state.company.cnpj)
      ? ({ status: 'idle' } as const)
      : state.company
  return {
    ...state,
    answers: cleanInvisibleAnswers(answers),
    errors: withoutKey(state.errors, key),
    resumable: null,
    company,
    submission: state.submission.status === 'sending' ? state.submission : { status: 'idle' },
    revision: state.revision + 1,
  }
}

const navigate = (state: FormState, view: View): FormState => ({ ...state, view, errors: {}, revision: state.revision + 1 })

export function initialFormState(bootstrap: DiagnosisBootstrap, { resume }: { resume: boolean }): FormState {
  const answers: Answers = {}
  if (bootstrap.invitation?.companyName) answers.nomeEmpresa = bootstrap.invitation.companyName
  if (bootstrap.invitation?.cnpj) answers.cnpj = bootstrap.invitation.cnpj
  const state: FormState = {
    view: { kind: 'form', step: 1 },
    answers,
    errors: {},
    resumable: bootstrap.draft ? { ...bootstrap.draft } : null,
    invitationToken: bootstrap.invitation?.token ?? null,
    company: { status: 'idle' },
    saveFailed: false,
    submission: { status: 'idle' },
    highlight: null,
    revision: 0,
  }
  return resume && state.resumable ? formReducer(state, { type: 'resume' }) : state
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'answer':
      return changeAnswers(state, { ...state.answers, [action.key]: action.value }, action.key)
    case 'answerMatrix': {
      const matrix = (state.answers[action.key] as MatrixAnswer | undefined) ?? {}
      return changeAnswers(state, { ...state.answers, [action.key]: { ...matrix, [action.row]: action.value } }, action.key)
    }
    case 'blur': {
      const problem = fieldProblem(state.answers, action.key)
      return { ...state, errors: problem ? { ...state.errors, [action.key]: problem } : withoutKey(state.errors, action.key) }
    }
    case 'next': {
      if (state.view.kind === 'review') return navigate(state, { kind: 'result' })
      if (state.view.kind !== 'form') return state
      const step = state.view.step
      const problems = stepProblems(state.answers, step)
      if (Object.keys(problems).length) return { ...state, errors: problems }
      const reason = triageReason(state.answers)
      if (reason) return navigate(state, { kind: 'referral', reason, returnStep: step })
      return navigate(state, step < FORM_STEPS ? { kind: 'form', step: step + 1 } : { kind: 'review' })
    }
    case 'back': {
      const { view } = state
      if (view.kind === 'referral') return navigate(state, { kind: 'form', step: view.returnStep })
      if (view.kind === 'result') return navigate(state, { kind: 'review' })
      if (view.kind === 'review') return navigate(state, { kind: 'form', step: FORM_STEPS })
      return view.step > 1 ? navigate(state, { kind: 'form', step: view.step - 1 }) : state
    }
    case 'goTo':
      if (state.view.kind === 'referral' || action.step < stepOf(state.view)) return navigate(state, viewOf(action.step))
      return state
    case 'goToField':
      return { ...navigate(state, { kind: 'form', step: action.block }), highlight: action.key }
    case 'clearHighlight':
      return { ...state, highlight: null }
    case 'resume':
      if (!state.resumable) return state
      return { ...state, answers: { ...state.answers, ...state.resumable.answers }, view: viewOf(state.resumable.step), resumable: null }
    case 'startOver':
      return { ...state, answers: {}, errors: {}, view: { kind: 'form', step: 1 }, resumable: null, company: { status: 'idle' }, submission: { status: 'idle' } }
    case 'companyLookupStarted':
      return { ...state, company: { status: 'loading', cnpj: action.cnpj } }
    case 'companyLookupFailed':
      if (!sameCnpj(action.cnpj, answeredCnpj(state))) return state
      return { ...state, company: { status: 'failed', cnpj: action.cnpj, reason: action.reason } }
    case 'companyLookupFound': {
      if (!sameCnpj(action.cnpj, answeredCnpj(state))) return state
      return {
        ...state,
        answers: cleanInvisibleAnswers(applyCompanyPrefill(state.answers, action.company)),
        company: { status: 'found', cnpj: action.cnpj, company: action.company },
        revision: state.revision + 1,
      }
    }
    case 'saveFailed':
      return { ...state, saveFailed: true }
    case 'saveSucceeded':
      return { ...state, saveFailed: false }
    case 'submitStarted':
      return { ...state, submission: { status: 'sending' } }
    case 'submitSucceeded':
      return { ...state, submission: { status: 'sent', protocol: action.protocol, result: action.result } }
    case 'submitFailed':
      return { ...state, submission: { status: 'failed', reason: action.reason } }
    case 'submitRateLimited':
      return { ...state, submission: { status: 'rate_limited', retryAfterSeconds: action.retryAfterSeconds } }
  }
}
