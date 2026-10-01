import { describe, expect, it } from 'vitest'
import { PROTOCOL_PATTERN, formatProtocol } from './protocol'

describe('protocol', () => {
  it('uses the Brasília date, not the UTC one', () => {
    expect(formatProtocol(new Date('2026-10-01T02:30:00Z'), 'AB12')).toBe('DS-260930-AB12')
    expect(formatProtocol(new Date('2026-10-01T03:00:00Z'), 'AB12')).toBe('DS-261001-AB12')
    expect(PROTOCOL_PATTERN.test('DS-261001-AB12')).toBe(true)
  })
})
