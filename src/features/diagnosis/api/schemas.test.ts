import { describe, expect, it } from 'vitest'
import { loadDraftInput, lookupCnpjInput, saveDraftInput } from './schemas'

describe('diagnosis input schemas', () => {
  it('accepts answers made of strings and string maps only', () => {
    expect(saveDraftInput.safeParse({ step: 3, answers: { a: 'x', receitaPorCliente: { pessoa_fisica: 'zero' } }, invitationToken: null }).success).toBe(true)
    expect(saveDraftInput.safeParse({ step: 3, answers: { a: ['x'] }, invitationToken: null }).success).toBe(false)
    expect(saveDraftInput.safeParse({ step: 3, answers: { a: { b: { c: 'd' } } }, invitationToken: null }).success).toBe(false)
    expect(saveDraftInput.safeParse({ step: 8, answers: {}, invitationToken: null }).success).toBe(false)
    expect(saveDraftInput.safeParse({ step: 1, answers: { a: 'x'.repeat(5001) }, invitationToken: null }).success).toBe(false)
  })

  it('bounds the invite and the CNPJ lookup', () => {
    expect(loadDraftInput.safeParse({}).success).toBe(true)
    expect(loadDraftInput.safeParse({ invite: 'x'.repeat(33) }).success).toBe(false)
    expect(lookupCnpjInput.safeParse({ cnpj: '11.222.333/0001-81', requesterName: 'Maria' }).success).toBe(true)
  })
})
