import { TIME_ZONE } from '@/server/shared/domain/dates'

export const LEGACY_FILE_NAMES = ['portal.db', 'portal.db-wal', 'portal.db-shm'] as const
export type LegacyFileName = (typeof LEGACY_FILE_NAMES)[number]

export const FILES_PREFIX = 'files/'

const stampFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function brasiliaStamp(date: Date): string {
  const parts = stampFormat.formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}${part('minute')}`
}

export const dumpPrefix = (database: string): string => `postgres/${database}-`

export const dumpKey = (database: string, takenAt: Date): string => `${dumpPrefix(database)}${brasiliaStamp(takenAt)}.dump`

const DUMP_KEY = /^postgres\/(.+)-(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})\.dump$/

export function parseDumpKey(key: string): { database: string; takenAt: Date } | null {
  const match = DUMP_KEY.exec(key)
  if (!match) return null
  const [, database = '', date, hour, minute] = match
  // Brasília não tem horário de verão desde 2019: o fuso fixo desfaz o brasiliaStamp. A volta pela dumpKey
  // recusa o que o Date aceita e rola para outro dia (30/02, 24h).
  const takenAt = new Date(`${date}T${hour}:${minute}:00-03:00`)
  if (Number.isNaN(takenAt.getTime()) || dumpKey(database, takenAt) !== key) return null
  return { database, takenAt }
}

export const fileKey = (sourceKey: string): string => `${FILES_PREFIX}${sourceKey}`

export const legacyKey = (takenAt: Date, name: string): string => `legacy/${brasiliaStamp(takenAt)}/${name}`
