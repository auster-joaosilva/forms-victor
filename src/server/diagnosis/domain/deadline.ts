import type { Confidence, ConfidenceLevel } from './confidence'
import type { Outcome } from './outcomes'
import type { Answers } from './question-types'
import { DEADLINES } from './thresholds'

export interface UrgencyAndDeadline {
  level: ConfidenceLevel
  windowOpen: boolean
  businessDaysToEnd: number
  calendarDaysToEnd: number
  filingDeadline: string
  withinLeadTime: boolean
}

const LEVELS: ConfidenceLevel[] = ['BAIXA', 'MÉDIA', 'ALTA']

const isBusinessDay = (date: Date): boolean => date.getDay() !== 0 && date.getDay() !== 6

// Business days from `from` (exclusive) to `until` (inclusive), on the local calendar.
function businessDaysBetween(from: Date, until: Date): number {
  let count = 0
  const day = new Date(from)
  while (true) {
    day.setDate(day.getDate() + 1)
    if (day > until) break
    if (isBusinessDay(day)) count++
  }
  return count
}

function subtractBusinessDays(date: Date, days: number): Date {
  const day = new Date(date)
  let remaining = days
  while (remaining > 0) {
    day.setDate(day.getDate() - 1)
    if (isBusinessDay(day)) remaining--
  }
  return day
}

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const spelledOut = (date: Date): string => `${date.getDate()} de ${MONTHS[date.getMonth()]}`

// Difference between dates, not instants: at 10h on 30/09 the window ends today, not tomorrow.
const dateOnly = (date: Date): number => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())

export function assessUrgencyAndDeadline(
  outcome: Outcome,
  answers: Answers,
  confidence: Confidence,
  today: Date,
): UrgencyAndDeadline {
  let level: ConfidenceLevel = ['C', 'D', 'E'].includes(outcome.code)
    ? 'ALTA'
    : outcome.code === 'B'
      ? 'MÉDIA'
      : 'BAIXA'
  if (answers.pressaoCredito === 'perdemos_negocio') level = 'ALTA'
  if (confidence.level === 'BAIXA') level = LEVELS[Math.min(LEVELS.indexOf(level) + 1, 2)] ?? level

  const end = new Date(DEADLINES.windowEnd + 'T23:59:59')
  const windowOpen = today <= end
  const businessDaysToEnd = windowOpen ? businessDaysBetween(today, end) : 0
  const calendarDaysToEnd = windowOpen ? Math.round((dateOnly(end) - dateOnly(today)) / 86400000) : 0

  // [DIVERGE-D4] A date to file by (window end minus operational lead), not a countdown.
  const limit = subtractBusinessDays(new Date(DEADLINES.windowEnd + 'T12:00:00'), DEADLINES.filingSlackDays)
  const withinLeadTime = today <= limit

  return {
    level,
    windowOpen,
    businessDaysToEnd,
    calendarDaysToEnd,
    filingDeadline: spelledOut(limit),
    withinLeadTime,
  }
}
