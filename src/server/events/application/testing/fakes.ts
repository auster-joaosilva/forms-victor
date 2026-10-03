import type { EventSessionView, EventSummary, EventView, RegistrationStatus } from '../../domain/event'
import type { EventsAuditRecorder } from '../../ports/audit-recorder'
import type { EventRepository, SessionInput } from '../../ports/event-repository'
import type { GalleryItem, ImageStore } from '../../ports/image-store'
import type { ProtocolGenerator } from '../../ports/protocol-generator'
import type { RateLimiter } from '../../ports/rate-limiter'
import type { NewRegistration, RegistrationCounts, RegistrationRepository, RegistrationRow } from '../../ports/registration-repository'
import type { ResponseLookup } from '../../ports/response-lookup'

export function fakeClock(start: string) {
  let current = new Date(start)
  return { now: () => current, set: (iso: string) => void (current = new Date(iso)) }
}

export function eventView(overrides: Partial<EventView> = {}): EventView {
  const session: EventSessionView = {
    id: 10, order: 0, date: '2026-10-20', time: '19:30', format: 'in_person', title: 'Encontro 1',
    description: null, location: 'Auditório da Auster', seats: 30, taken: 0,
  }
  return {
    id: 1, slug: 'conexao-tributaria', title: 'Conexão Tributária', status: 'published', registrations: 'open',
    content: { chamada: 'O que muda na sua empresa.' }, sessions: [session], ...overrides,
  }
}

const summaryOf = (event: EventView, registered: number): EventSummary => ({
  id: event.id, slug: event.slug, title: event.title, status: event.status, registrations: event.registrations,
  firstDate: event.sessions.map((session) => session.date).sort()[0] ?? null,
  sessionCount: event.sessions.length, registered, chamada: event.content.chamada ?? null,
})

export function memoryEvents(seed: EventView[] = []) {
  const events = new Map(seed.map((event) => [event.id, structuredClone(event)] as const))
  const updates: { id: number; changes: unknown; actorId: string }[] = []
  let sequence = Math.max(0, ...seed.map((event) => event.id))
  let sessionSequence = Math.max(0, ...seed.flatMap((event) => event.sessions.map((session) => session.id)))
  const takenOf = (event: EventView) => event.sessions.reduce((sum, session) => sum + session.taken, 0)
  const toSessions = (inputs: SessionInput[], previous: EventSessionView[]): EventSessionView[] =>
    inputs.map((input, order) => ({
      id: input.id ?? ++sessionSequence, order, date: input.date, time: input.time, format: input.format, title: input.title,
      description: input.description, location: input.location, seats: input.seats,
      taken: previous.find((session) => session.id === input.id)?.taken ?? 0,
    }))
  const repository: EventRepository = {
    listSummaries: async ({ onlyPublished }) =>
      [...events.values()]
        .filter((event) => !onlyPublished || event.status === 'published')
        .map((event) => summaryOf(event, takenOf(event)))
        .sort((a, b) => (b.firstDate ?? '').localeCompare(a.firstDate ?? '') || b.id - a.id),
    findBySlug: async (slug) => structuredClone([...events.values()].find((event) => event.slug === slug) ?? null),
    findById: async (id) => structuredClone(events.get(id) ?? null),
    slugs: async () => new Set([...events.values()].map((event) => event.slug)),
    create: async ({ title, slug, content }) => {
      const id = ++sequence
      events.set(id, { id, slug, title, status: 'draft', registrations: 'open', content, sessions: [] })
      return { id }
    },
    update: async (id, changes, actorId) => {
      updates.push({ id, changes, actorId })
      const current = events.get(id)
      if (!current) return
      events.set(id, {
        ...current,
        title: changes.title ?? current.title,
        slug: changes.slug ?? current.slug,
        content: changes.content ?? current.content,
        status: changes.status ?? current.status,
        registrations: changes.registrations ?? current.registrations,
        sessions: changes.sessions ? toSessions(changes.sessions, current.sessions) : current.sessions,
      })
    },
  }
  return { repository, events, updates }
}

export type StoredRegistration = NewRegistration & { id: number; createdAt: Date; status: RegistrationStatus; handledById: string | null; handledAt: Date | null }

export function memoryRegistrations(events: Map<number, EventView>) {
  const rows = new Map<number, StoredRegistration>()
  let sequence = 0
  const active = (row: StoredRegistration) => row.status !== 'cancelled'
  const toRow = (row: StoredRegistration): RegistrationRow => {
    const session = events.get(row.eventId)?.sessions.find((candidate) => candidate.id === row.sessionId)
    return {
      id: row.id, protocol: row.protocol, createdAt: row.createdAt, name: row.name, email: row.email,
      phone: row.phone, company: row.company, cnpj: row.cnpj, jobTitle: row.jobTitle,
      status: row.status, sessionId: row.sessionId, sessionTitle: session?.title ?? '', sessionDate: session?.date ?? '',
      sessionTime: session?.time ?? '', sessionFormat: session?.format ?? 'in_person', responseId: row.responseId,
    }
  }
  const repository: RegistrationRepository = {
    register: async (input) => {
      const repeated = [...rows.values()].find(
        (row) => active(row) && row.sessionId === input.sessionId && row.email.toLowerCase() === input.email.toLowerCase(),
      )
      if (repeated) return { kind: 'repeated', id: repeated.id, protocol: repeated.protocol }
      const session = events.get(input.eventId)?.sessions.find((candidate) => candidate.id === input.sessionId)
      const taken = [...rows.values()].filter((row) => active(row) && row.sessionId === input.sessionId).length
      if (session?.seats !== null && session?.seats !== undefined && taken >= session.seats) return { kind: 'full' }
      if ([...rows.values()].some((row) => row.protocol === input.protocol)) return { kind: 'protocol_taken' }
      const id = ++sequence
      rows.set(id, { ...input, id, createdAt: new Date(), status: 'registered', handledById: null, handledAt: null })
      if (session) session.taken = taken + 1
      return { kind: 'created', id, protocol: input.protocol }
    },
    listForEvent: async (eventId, filter) =>
      [...rows.values()]
        .filter((row) => row.eventId === eventId && (!filter.sessionId || row.sessionId === filter.sessionId) && (!filter.status || row.status === filter.status))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
        .map(toRow),
    counts: async (eventId) => {
      const counts: RegistrationCounts = { total: 0, registered: 0, confirmed: 0, present: 0, absent: 0, cancelled: 0 }
      for (const row of rows.values()) {
        if (row.eventId !== eventId) continue
        counts[row.status]++
        if (active(row)) counts.total++
      }
      return counts
    },
    listForExport: async (eventId, filter, limit) => {
      const event = events.get(eventId)
      return (await repository.listForEvent(eventId, filter)).slice(0, limit).map((row) => ({
        protocol: row.protocol, createdAt: row.createdAt, status: row.status, eventTitle: event?.title ?? '',
        sessionTitle: row.sessionTitle, sessionDate: row.sessionDate, sessionTime: row.sessionTime, sessionFormat: row.sessionFormat,
        name: row.name, email: row.email, phone: row.phone, company: row.company, cnpj: row.cnpj, jobTitle: row.jobTitle,
        responseId: row.responseId, originIp: rows.get(row.id)?.originIp ?? null, handledBy: rows.get(row.id)?.handledById ?? null, internalNote: null,
      }))
    },
    findById: async (id) => {
      const row = rows.get(id)
      return row ? { id: row.id, status: row.status, eventId: row.eventId } : null
    },
    setStatus: async (id, status, actorId, at) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, status, handledById: actorId, handledAt: at })
    },
  }
  return { repository, rows }
}

export function memoryResponseLookup(byDigits: Record<string, number> = {}): ResponseLookup {
  return { latestByCnpjDigits: async (digits) => byDigits[digits] ?? null }
}

/** Devolve os protocolos na ordem; depois do último, repete o último. */
export function sequenceProtocols(protocols: string[]): ProtocolGenerator {
  let index = 0
  return { next: () => protocols[Math.min(index++, protocols.length - 1)] ?? 'INS-20261003-AAAAA' }
}

export function allowAll() {
  const calls: { route: string; origin: string | null }[] = []
  const limiter: RateLimiter & { calls: typeof calls } = {
    calls,
    check: async (route, origin) => {
      calls.push({ route, origin })
      return { allowed: true }
    },
  }
  return limiter
}

export function blockAll(retryAfterSeconds: number): RateLimiter {
  return { check: async () => ({ allowed: false, retryAfterSeconds }) }
}

export function fakeImageStore(gallery: GalleryItem[] = []) {
  const saved: { kind: string; bytes: Uint8Array; contentType: string; originalName: string | null; actorId: string | null }[] = []
  let failure: string | null = null
  const store: ImageStore = {
    save: async (kind, bytes, contentType, originalName, actorId) => {
      if (failure) return { ok: false, error: failure }
      saved.push({ kind, bytes, contentType, originalName, actorId })
      return { ok: true, fileId: `00000000-0000-4000-8000-${String(saved.length).padStart(12, '0')}` }
    },
    houseByName: async (name) => {
      const found = gallery.find((item) => item.kind === 'house_photo' && item.name === name)
      return found ? { fileId: found.fileId } : null
    },
    gallery: async () => gallery,
  }
  return { store, saved, fail: (error: string) => void (failure = error) }
}

export function auditSpy() {
  const entries: Parameters<EventsAuditRecorder>[0][] = []
  let failNext = false
  const record: EventsAuditRecorder = async (entry) => {
    if (failNext) {
      failNext = false
      throw new Error('audit indisponível')
    }
    entries.push(entry)
  }
  return { record, entries, failNext: () => void (failNext = true) }
}
