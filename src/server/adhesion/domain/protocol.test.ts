import { describe, expect, it } from 'vitest'
import { ADHESION_PROTOCOL_ALPHABET, ADHESION_PROTOCOL_PATTERN, formatAdhesionProtocol } from './protocol'

describe('adhesion protocol', () => {
  it('uses ADS, the Brasília date with four-digit year and the suffix', () => {
    expect(formatAdhesionProtocol(new Date('2026-10-15T15:00:00Z'), 'AB2C9')).toBe('ADS-20261015-AB2C9')
  })

  it('takes the date of Brasília on the last minute of the window', () => {
    // 30/10 23:59:59 em Brasília; em UTC já é 31/10
    const protocol = formatAdhesionProtocol(new Date('2026-10-31T02:59:59Z'), 'XYZ23')
    expect(protocol).toBe('ADS-20261030-XYZ23')
    expect(protocol).toMatch(ADHESION_PROTOCOL_PATTERN)
  })

  it('has an alphabet without the look-alike characters', () => {
    expect(ADHESION_PROTOCOL_ALPHABET).toHaveLength(32)
    expect(ADHESION_PROTOCOL_ALPHABET).not.toMatch(/[IO01]/)
  })
})
