import { describe, expect, it } from 'vitest'
import { brasiliaDateParts, formatBrasiliaDateTime, isoDateToBr, TIME_ZONE } from './dates'

describe('dates in Brasília', () => {
  it('uses the São Paulo time zone', () => {
    expect(TIME_ZONE).toBe('America/Sao_Paulo')
  })

  it('keeps the Brasília day when UTC has already turned', () => {
    expect(brasiliaDateParts(new Date('2026-10-31T02:59:59Z'))).toEqual({ year: '2026', month: '10', day: '30' })
    expect(brasiliaDateParts(new Date('2026-10-31T03:00:00Z'))).toEqual({ year: '2026', month: '10', day: '31' })
  })

  it('formats date and time as the old receipt did, but always in Brasília', () => {
    expect(formatBrasiliaDateTime(new Date('2026-10-31T02:59:59Z'))).toBe('30/10/2026, 23:59:59')
  })

  it('turns an ISO day into DD/MM/AAAA', () => {
    expect(isoDateToBr('2026-10-30')).toBe('30/10/2026')
    expect(isoDateToBr('2026-12-20')).toBe('20/12/2026')
  })
})
