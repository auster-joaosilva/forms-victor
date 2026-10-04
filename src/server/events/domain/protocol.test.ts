import { describe, expect, it } from 'vitest'
import { REGISTRATION_PROTOCOL_ALPHABET, REGISTRATION_PROTOCOL_PATTERN, formatRegistrationProtocol } from './protocol'

describe('protocolo da inscrição', () => {
  it('usa INS- com a data de Brasília', () => {
    expect(formatRegistrationProtocol(new Date('2026-10-21T15:00:00Z'), 'AB2C9')).toBe('INS-20261021-AB2C9')
  })

  it('perto da meia-noite UTC ainda vale o dia de Brasília', () => {
    expect(formatRegistrationProtocol(new Date('2026-10-22T02:30:00Z'), 'AB2C9')).toBe('INS-20261021-AB2C9')
    expect(formatRegistrationProtocol(new Date('2026-10-22T03:00:00Z'), 'AB2C9')).toBe('INS-20261022-AB2C9')
  })

  it('o formato casa com o padrão e o alfabeto não tem I, O, 0 nem 1', () => {
    expect(REGISTRATION_PROTOCOL_PATTERN.test('INS-20261021-AB2C9')).toBe(true)
    expect(REGISTRATION_PROTOCOL_PATTERN.test('ADS-20261021-AB2C9')).toBe(false)
    expect(REGISTRATION_PROTOCOL_ALPHABET).toHaveLength(32)
    expect(REGISTRATION_PROTOCOL_ALPHABET).not.toMatch(/[IO01]/)
  })
})
