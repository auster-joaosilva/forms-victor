import { describe, expect, it } from 'vitest'
import { longDate } from './long-date'

describe('longDate', () => {
  it('writes the civil day without shifting the time zone', () => {
    expect(longDate('2026-10-20')).toBe('20 de outubro')
    expect(longDate('2026-01-01')).toBe('1 de janeiro')
  })

  it('returns empty for anything that is not a date', () => {
    expect(longDate('')).toBe('')
    expect(longDate('2026-13')).toBe('')
  })
})
