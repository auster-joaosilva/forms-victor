import { brasiliaDateParts } from '../../shared/domain/dates'
import { DEADLINES } from '../../shared/domain/deadlines'

export type AdhesionWindow = { state: 'open' | 'closed'; end: string }

// O corte é o dia de Brasília: às 21h do último dia um servidor em UTC já está no dia seguinte.
export function adhesionWindow(now: Date): AdhesionWindow {
  const { year, month, day } = brasiliaDateParts(now)
  const today = `${year}-${month}-${day}`
  return { state: today > DEADLINES.windowEnd ? 'closed' : 'open', end: DEADLINES.windowEnd }
}
