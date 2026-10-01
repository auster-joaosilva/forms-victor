import { brasiliaDateParts } from '../../shared/domain/dates'

// Sem I, O, 0 e 1: o protocolo é lido em voz alta e copiado à mão.
export const ADHESION_PROTOCOL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ADHESION_PROTOCOL_PATTERN = /^ADS-\d{8}-[A-Z0-9]{5}$/

export function formatAdhesionProtocol(now: Date, suffix: string): string {
  const { year, month, day } = brasiliaDateParts(now)
  return `ADS-${year}${month}${day}-${suffix}`
}
