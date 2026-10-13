import { describe, expect, it } from 'vitest'
import { BATCH_RESET_TOKEN_TTL_MS, RESET_TOKEN_TTL_MS, isUsableToken, tokenExpiry } from './reset-token'

describe('reset token validity', () => {
  it('expires one hour after the request, by default', () => {
    const now = new Date('2026-10-12T12:00:00Z')
    expect(tokenExpiry(now)).toEqual(new Date('2026-10-12T13:00:00Z'))
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000)
  })

  it('accepts a longer TTL for the admin batch send', () => {
    const now = new Date('2026-10-12T12:00:00Z')
    expect(tokenExpiry(now, BATCH_RESET_TOKEN_TTL_MS)).toEqual(new Date('2026-10-14T12:00:00Z'))
    expect(BATCH_RESET_TOKEN_TTL_MS).toBe(48 * 60 * 60 * 1000)
  })

  it('is usable only before it expires and before it is used', () => {
    const now = new Date('2026-10-12T12:00:00Z')
    expect(isUsableToken({ expiresAt: new Date('2026-10-12T12:00:01Z'), usedAt: null }, now)).toBe(true)
    expect(isUsableToken({ expiresAt: new Date('2026-10-12T11:59:59Z'), usedAt: null }, now)).toBe(false)
    expect(isUsableToken({ expiresAt: new Date('2026-10-12T13:00:00Z'), usedAt: new Date('2026-10-12T11:00:00Z') }, now)).toBe(false)
  })
})
