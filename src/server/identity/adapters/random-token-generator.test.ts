import { describe, expect, it } from 'vitest'
import { createRandomTokenGenerator } from './random-token-generator'

describe('random token generator', () => {
  it('makes a 64-hex token with its own sha-256 hash, and never repeats', () => {
    const generator = createRandomTokenGenerator()
    const seen = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const { token, tokenHash } = generator.next()
      expect(token).toMatch(/^[0-9a-f]{64}$/)
      expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
      expect(tokenHash).not.toBe(token)
      expect(seen.has(token)).toBe(false)
      seen.add(token)
    }
  })
})
