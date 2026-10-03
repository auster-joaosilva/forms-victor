import type { EventSessionView, EventView, FileRef } from '@/server/events/domain/event'
import { remainingSeats, sessionBadge } from '@/server/events/domain/seats'

export function badgeClass(remaining: number | null): '' | 'esgotado' | 'restam' {
  if (remaining === null) return ''
  if (remaining === 0) return 'esgotado'
  return remaining <= 5 ? 'restam' : ''
}

export function sessionState(session: EventSessionView) {
  const remaining = remainingSeats(session.seats, session.taken)
  return { remaining, badge: sessionBadge(remaining), badgeClass: badgeClass(remaining) }
}

export const openSessions = (event: EventView) =>
  event.sessions.filter((session) => {
    const { remaining } = sessionState(session)
    return remaining === null || remaining > 0
  })

export const fileUrl = (ref: FileRef | null | undefined) => (ref ? `/files/${ref.fileId}` : null)
