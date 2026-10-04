import { brasiliaDateParts } from '@/server/shared/domain/dates'

export const NEWEST_KEPT = 7
export const SUNDAY_WEEKS_KEPT = 4

export interface DumpEntry {
  key: string
  takenAt: Date
}

const DAY_MS = 86_400_000

function brasiliaDayNumber(date: Date): number {
  const { year, month, day } = brasiliaDateParts(date)
  return Date.UTC(Number(year), Number(month) - 1, Number(day)) / DAY_MS
}

export function dumpsToDelete(dumps: DumpEntry[], now: Date): string[] {
  const newestFirst = dumps
    .filter((dump) => !Number.isNaN(dump.takenAt.getTime()))
    .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())
  const kept = new Set(newestFirst.slice(0, NEWEST_KEPT).map((dump) => dump.key))
  const today = brasiliaDayNumber(now)
  const sundays = new Set<number>()
  for (const dump of newestFirst) {
    const day = brasiliaDayNumber(dump.takenAt)
    const isSunday = new Date(day * DAY_MS).getUTCDay() === 0
    if (!isSunday || today - day >= SUNDAY_WEEKS_KEPT * 7 || sundays.has(day)) continue
    sundays.add(day)
    kept.add(dump.key)
  }
  return newestFirst.filter((dump) => !kept.has(dump.key)).map((dump) => dump.key)
}
