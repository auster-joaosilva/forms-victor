import type { EventContent, EventStatus, EventSummary, EventView, RegistrationWindow, SessionFormat } from '../domain/event'

export interface SessionInput {
  id?: number
  date: string
  time: string
  format: SessionFormat
  title: string
  description: string | null
  location: string | null
  seats: number | null
}

export interface NewEvent { title: string; slug: string; content: EventContent; actorId: string }

export interface EventChanges {
  title?: string
  slug?: string
  content?: EventContent
  status?: EventStatus
  registrations?: RegistrationWindow
  sessions?: SessionInput[]
}

export interface EventRepository {
  listSummaries(filter: { onlyPublished: boolean }): Promise<EventSummary[]>
  findBySlug(slug: string): Promise<EventView | null>
  findById(id: number): Promise<EventView | null>
  slugs(): Promise<Set<string>>
  create(input: NewEvent): Promise<{ id: number }>
  update(id: number, changes: EventChanges, actorId: string): Promise<void>
}
