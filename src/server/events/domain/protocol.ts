import { brasiliaDateParts } from '../../shared/domain/dates'

// Sem I, O, 0 e 1: o protocolo é lido em voz alta e copiado à mão.
export const REGISTRATION_PROTOCOL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const REGISTRATION_PROTOCOL_PATTERN = /^INS-\d{8}-[A-Z0-9]{5}$/

export function formatRegistrationProtocol(now: Date, suffix: string): string {
  const { year, month, day } = brasiliaDateParts(now)
  return `INS-${year}${month}${day}-${suffix}`
}
