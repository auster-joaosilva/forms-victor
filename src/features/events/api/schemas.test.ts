import { describe, expect, it } from 'vitest'
import { isEventSlug, loadEventPageInput, submitRegistrationInput } from './schemas'

const body = { evento: 'conexao-tributaria', sessaoId: 11, nome: 'Ana', email: 'ana@x.com.br', telefone: '', empresa: '', cnpj: '', cargo: '', aceite: true }

describe('submitRegistrationInput', () => {
  it('accepts the body the form sends', () => {
    expect(submitRegistrationInput.safeParse(body).success).toBe(true)
  })

  it('bounds every text and refuses a session that is not a positive integer', () => {
    expect(submitRegistrationInput.safeParse({ ...body, nome: 'a'.repeat(201) }).success).toBe(false)
    expect(submitRegistrationInput.safeParse({ ...body, sessaoId: 0 }).success).toBe(false)
    expect(submitRegistrationInput.safeParse({ ...body, sessaoId: '11' }).success).toBe(false)
  })

  it('has no field for origin, protocol or date: those are the server’s', () => {
    const parsed = submitRegistrationInput.parse({ ...body, protocolo: 'INS-1', origem: '1.2.3.4' })
    expect(parsed).not.toHaveProperty('protocolo')
    expect(parsed).not.toHaveProperty('origem')
  })
})

describe('loadEventPageInput', () => {
  it('lets any address reach the handler, so a bad one becomes "not found" instead of an error', () => {
    expect(loadEventPageInput.safeParse({ slug: 'a'.repeat(500) }).success).toBe(true)
    expect(loadEventPageInput.safeParse({ slug: '' }).success).toBe(true)
  })

  it('tells a plausible slug from one that cannot exist', () => {
    expect(isEventSlug('conexao-tributaria')).toBe(true)
    expect(isEventSlug('a'.repeat(120))).toBe(true)
    expect(isEventSlug('a'.repeat(121))).toBe(false)
    expect(isEventSlug('')).toBe(false)
  })
})
