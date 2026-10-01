import { brasiliaDateParts } from './dates'

export const PROTOCOL_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const PROTOCOL_PATTERN = /^DS-\d{6}-[A-Z0-9]{4}$/

export function formatProtocol(now: Date, suffix: string): string {
  const { year, month, day } = brasiliaDateParts(now)
  return `DS-${year.slice(2)}${month}${day}-${suffix}`
}
