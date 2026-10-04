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
  // O mais novo de cada dia de Brasília: é o único que um dia pode manter.
  const newestOfDay = new Map<number, DumpEntry>()
  for (const dump of newestFirst) {
    const day = brasiliaDayNumber(dump.takenAt)
    if (!newestOfDay.has(day)) newestOfDay.set(day, dump)
  }
  const today = brasiliaDayNumber(now)
  const kept = new Set<string>()
  let daysKept = 0
  for (const [day, dump] of newestOfDay) {
    const isSunday = new Date(day * DAY_MS).getUTCDay() === 0
    const recentDay = daysKept < NEWEST_KEPT
    if (recentDay) daysKept += 1
    if (recentDay || (isSunday && today - day < SUNDAY_WEEKS_KEPT * 7)) kept.add(dump.key)
  }
  return newestFirst.filter((dump) => !kept.has(dump.key)).map((dump) => dump.key)
}
