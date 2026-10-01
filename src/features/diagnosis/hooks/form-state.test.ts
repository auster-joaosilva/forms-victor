import { describe, expect, it } from 'vitest'
import { applicableFill } from '@/server/diagnosis/domain/testing/applicable-fill'
import { formReducer, initialFormState, stepOf, type FormState } from './form-state'

const empty = () => initialFormState({ today: '2026-09-15T13:00:00.000Z', draft: null, invitation: null }, { resume: false })
const run = (state: FormState, ...actions: Parameters<typeof formReducer>[1][]) => actions.reduce(formReducer, state)

describe('form state', () => {
  it('blocks the step with the legacy messages', () => {
    const state = run(empty(), { type: 'next' })
    expect(state.view).toEqual({ kind: 'form', step: 1 })
    expect(state.errors.cnpj).toBe('Obrigatório')
  })

  it('detours to the referral and comes back to the same step', () => {
    const answers = applicableFill(3)
    let state: FormState = { ...empty(), answers: { ...answers, ehSimei: 'sim' } }
    state = run(state, { type: 'next' })
    expect(state.view).toEqual({ kind: 'referral', reason: 'mei', returnStep: 1 })
    expect(run(state, { type: 'back' }).view).toEqual({ kind: 'form', step: 1 })
  })

  it('walks the five steps, the review and the result, and only goes back by the step bar', () => {
    let state: FormState = { ...empty(), answers: applicableFill(3) }
    for (let i = 0; i < 5; i++) state = run(state, { type: 'next' })
    expect(state.view).toEqual({ kind: 'review' })
    state = run(state, { type: 'next' })
    expect(stepOf(state.view)).toBe(7)
    expect(run(state, { type: 'goTo', step: 6 }).view).toEqual({ kind: 'review' })
    const atTwo = run(state, { type: 'goTo', step: 2 })
    expect(run(atTwo, { type: 'goTo', step: 4 }).view).toEqual({ kind: 'form', step: 2 })
  })

  it('resets the submission when an answer changes after sending', () => {
    const sent: FormState = { ...empty(), submission: { status: 'failed', reason: 'x' } }
    expect(run(sent, { type: 'answer', key: 'telefone', value: '(34) 99999-9999' }).submission).toEqual({ status: 'idle' })
  })

  it('fills only blank company fields from the registry and drops a stale badge', () => {
    let state = run(empty(), { type: 'answer', key: 'cnpj', value: '11.222.333/0001-81' }, { type: 'answer', key: 'nomeEmpresa', value: 'Meu nome' })
    state = run(state, { type: 'companyLookupStarted', cnpj: '11.222.333/0001-81' }, {
      type: 'companyLookupFound', cnpj: '11.222.333/0001-81',
      company: { legalName: 'RAZÃO', city: 'UBERLANDIA', state: 'MG', simplesOptant: true, meiOptant: false, active: true, registrationStatus: 'ATIVA' },
    })
    expect(state.answers).toMatchObject({ nomeEmpresa: 'Meu nome', ehSimei: 'nao', regimeAtual: 'simples' })
    expect(state.company.status).toBe('found')
    expect(run(state, { type: 'answer', key: 'cnpj', value: '11.222.333/0001-8' }).company).toEqual({ status: 'idle' })
  })
})
