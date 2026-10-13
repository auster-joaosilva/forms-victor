import { describe, expect, it } from 'vitest'
import { deriveEmail, deriveFirstName, isDeliverableEmail } from './contact'

describe('isDeliverableEmail', () => {
  it('rejects the placeholder domain from the migration and anything empty', () => {
    expect(isDeliverableEmail('victor.medeiros@users.invalid')).toBe(false)
    expect(isDeliverableEmail(null)).toBe(false)
    expect(isDeliverableEmail(undefined)).toBe(false)
    expect(isDeliverableEmail('')).toBe(false)
  })
  it('accepts a real address', () => {
    expect(isDeliverableEmail('victor@austercontabil.com.br')).toBe(true)
  })
})

describe('deriveFirstName', () => {
  it('takes the part before the first separator and capitalizes it', () => {
    expect(deriveFirstName('victor.medeiros')).toBe('Victor')
    expect(deriveFirstName('ana-paula.silva')).toBe('Ana')
    expect(deriveFirstName('fabiola..souza')).toBe('Fabiola')
    expect(deriveFirstName('joao_pedro')).toBe('Joao')
    expect(deriveFirstName('sara')).toBe('Sara')
  })
})

describe('deriveEmail', () => {
  it('uses the username as the local part of the company domain', () => {
    expect(deriveEmail('sara.vinhais')).toBe('sara.vinhais@austercontabil.com.br')
  })
  it('honors an override for a username that does not follow the pattern', () => {
    expect(deriveEmail('victor.medeiros', { 'victor.medeiros': 'victor@austercontabil.com.br' })).toBe('victor@austercontabil.com.br')
    expect(deriveEmail('sara.vinhais', { 'victor.medeiros': 'victor@austercontabil.com.br' })).toBe('sara.vinhais@austercontabil.com.br')
  })
})
