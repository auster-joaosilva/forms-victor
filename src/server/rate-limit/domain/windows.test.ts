import { describe, expect, it } from 'vitest'
import { windowStart, secondsUntilWindowEnds } from './windows'

describe('fixed windows', () => {
  const now = new Date('2026-10-01T12:34:56.789Z')
  it('floors to the minute and to the hour', () => {
    expect(windowStart(now, 60).toISOString()).toBe('2026-10-01T12:34:00.000Z')
    expect(windowStart(now, 3600).toISOString()).toBe('2026-10-01T12:00:00.000Z')
  })
  it('counts the seconds left, at least 1', () => {
    expect(secondsUntilWindowEnds(now, 60)).toBe(4)
    expect(secondsUntilWindowEnds(new Date('2026-10-01T12:34:59.999Z'), 60)).toBe(1)
  })
})
