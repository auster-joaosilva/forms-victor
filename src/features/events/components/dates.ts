const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export interface DateParts {
  short: string
  weekday: string
  day: string
  month: string
  year: string
}

const split = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number)
  return year && month && day && month <= 12 ? { year, month, day } : null
}

// Data de sessão é dia civil, não instante: new Date('2026-10-20') cai em UTC e, no Brasil, volta um dia.
export function dateParts(iso: string): DateParts {
  const parts = split(iso)
  if (!parts) return { short: iso, weekday: '', day: '', month: '', year: '' }
  const day = String(parts.day).padStart(2, '0')
  const month = String(parts.month).padStart(2, '0')
  return {
    short: `${day}/${month}/${parts.year}`,
    weekday: WEEKDAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()] ?? '',
    day,
    month: MONTHS[parts.month - 1] ?? '',
    year: String(parts.year),
  }
}

// O hoje vem do servidor (dia de Brasília), não do relógio de quem visita.
export function daysUntil(iso: string, today: string): number | null {
  const target = split(iso)
  const now = split(today)
  if (!target || !now) return null
  return Math.round((Date.UTC(target.year, target.month - 1, target.day) - Date.UTC(now.year, now.month - 1, now.day)) / 86_400_000)
}

export type Countdown = { kind: 'today' } | { kind: 'tomorrow' } | { kind: 'days'; days: number }

export function countdown(days: number | null): Countdown | null {
  if (days === null || days < 0) return null
  if (days === 0) return { kind: 'today' }
  if (days === 1) return { kind: 'tomorrow' }
  return { kind: 'days', days }
}
