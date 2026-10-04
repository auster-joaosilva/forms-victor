import { describe, expect, it } from 'vitest'
import { REGISTRATION_PROTOCOL_PATTERN } from '../domain/protocol'
import { createRandomRegistrationProtocolGenerator } from './random-registration-protocol-generator'

describe('gerador de protocolo da inscrição', () => {
  it('gera INS- com a data de Brasília e cinco símbolos do alfabeto', () => {
    const protocol = createRandomRegistrationProtocolGenerator().next(new Date('2026-10-22T02:30:00Z'))
    expect(protocol).toMatch(REGISTRATION_PROTOCOL_PATTERN)
    expect(protocol.startsWith('INS-20261021-')).toBe(true)
    expect(protocol.slice(-5)).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/)
  })
})
