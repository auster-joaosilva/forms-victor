import { describe, expect, it } from 'vitest'
import { ADHESION_PROTOCOL_PATTERN } from '../domain/protocol'
import { createRandomAdhesionProtocolGenerator } from './random-adhesion-protocol-generator'
import { createRandomReceiptTokenGenerator } from './random-receipt-token-generator'

describe('random generators', () => {
  it('makes ADS protocols with the Brasília date and the safe alphabet', () => {
    const generator = createRandomAdhesionProtocolGenerator()
    for (let i = 0; i < 200; i++) {
      const protocol = generator.next(new Date('2026-10-31T02:59:59Z'))
      expect(protocol).toMatch(ADHESION_PROTOCOL_PATTERN)
      expect(protocol.startsWith('ADS-20261030-')).toBe(true)
      expect(protocol.slice(-5)).not.toMatch(/[IO01]/)
    }
  })

  it('makes 64-hex receipt tokens that do not repeat', () => {
    const generator = createRandomReceiptTokenGenerator()
    const tokens = new Set(Array.from({ length: 100 }, () => generator.next()))
    expect(tokens.size).toBe(100)
    for (const token of tokens) expect(token).toMatch(/^[0-9a-f]{64}$/)
  })
})
