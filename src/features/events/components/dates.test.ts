import { describe, expect, it } from 'vitest'
import { countdown, dateParts, daysUntil } from './dates'

describe('dateParts', () => {
  it('splits the civil day by hand, without the UTC shift that moves Brazil back one day', () => {
    expect(dateParts('2026-10-20')).toEqual({ short: '20/10/2026', weekday: 'terça-feira', day: '20', month: 'out', year: '2026' })
    expect(dateParts('2026-11-01').weekday).toBe('domingo')
  })

  it('keeps whatever came when it is not a date', () => {
    expect(dateParts('a definir')).toEqual({ short: 'a definir', weekday: '', day: '', month: '', year: '' })
  })
})

describe('daysUntil and countdown', () => {
  it('counts whole days from the Brasília day the server sent', () => {
    expect(daysUntil('2026-10-20', '2026-10-18')).toBe(2)
    expect(daysUntil('2026-10-20', '2026-10-20')).toBe(0)
    expect(daysUntil('2026-10-20', '2026-10-21')).toBe(-1)
    expect(daysUntil('x', '2026-10-21')).toBeNull()
  })

  it('says it the way the old page did, and nothing for a past meeting', () => {
    expect(countdown(0)).toEqual({ kind: 'today' })
    expect(countdown(1)).toEqual({ kind: 'tomorrow' })
    expect(countdown(9)).toEqual({ kind: 'days', days: 9 })
    expect(countdown(-3)).toBeNull()
    expect(countdown(null)).toBeNull()
  })
})
