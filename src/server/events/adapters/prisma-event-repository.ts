import type { Prisma } from '@/server/shared/prisma/generated/client'
import { prisma } from '@/server/shared/prisma/client'
import { parseContent, type EventSessionView, type EventSummary, type EventView } from '../domain/event'
import type { EventRepository, SessionInput } from '../ports/event-repository'

const isoDate = (date: Date): string => date.toISOString().slice(0, 10)
const dbDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

const sessionInclude = {
  sessions: {
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    include: { _count: { select: { registrations: { where: { status: { not: 'cancelled' } } } } } },
  },
} satisfies Prisma.EventInclude

type EventRow = Prisma.EventGetPayload<{ include: typeof sessionInclude }>

const toView = (row: EventRow): EventView => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  status: row.status,
  registrations: row.registrations,
  content: parseContent(row.content),
  sessions: row.sessions.map((session): EventSessionView => ({
    id: session.id,
    order: session.order,
    date: isoDate(session.date),
    time: session.time,
    format: session.format,
    title: session.title,
    description: session.description,
    location: session.location,
    seats: session.seats,
    taken: session._count.registrations,
  })),
})

const sessionData = (session: SessionInput, order: number) => ({
  order,
  date: dbDate(session.date),
  time: session.time,
  format: session.format,
  title: session.title,
  description: session.description,
  location: session.location,
  seats: Number.isInteger(session.seats) && (session.seats ?? 0) > 0 ? session.seats : null,
})

export const prismaEventRepository: EventRepository = {
  async listSummaries({ onlyPublished }) {
    const rows = await prisma.event.findMany({
      where: onlyPublished ? { status: 'published' } : {},
      include: {
        sessions: { select: { date: true } },
        _count: { select: { entries: { where: { status: { not: 'cancelled' } } } } },
      },
    })
    const summaries = rows.map((row): EventSummary => {
      const dates = row.sessions.map((session) => isoDate(session.date)).sort()
      const content = parseContent(row.content)
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.status,
        registrations: row.registrations,
        firstDate: dates[0] ?? null,
        sessionCount: row.sessions.length,
        registered: row._count.entries,
        chamada: content.chamada ?? null,
      }
    })
    // Ordem da main (primeira_data DESC, id DESC). No SQLite o NULL é o menor e vai para o fim em DESC; no Postgres viria primeiro.
    return summaries.sort((a, b) =>
      a.firstDate === b.firstDate ? b.id - a.id : a.firstDate === null ? 1 : b.firstDate === null ? -1 : b.firstDate.localeCompare(a.firstDate))
  },

  async findBySlug(slug) {
    const row = await prisma.event.findUnique({ where: { slug }, include: sessionInclude })
    return row ? toView(row) : null
  },

  async findById(id) {
    const row = await prisma.event.findUnique({ where: { id }, include: sessionInclude })
    return row ? toView(row) : null
  },

  async slugs() {
    return new Set((await prisma.event.findMany({ select: { slug: true } })).map((row) => row.slug))
  },

  async create({ title, slug, content, actorId }) {
    const row = await prisma.event.create({
      data: { title, slug, content: content as Prisma.InputJsonValue, createdById: actorId },
      select: { id: true },
    })
    return { id: row.id }
  },

  async update(id, changes, actorId) {
    await prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id },
        data: {
          ...(changes.title !== undefined ? { title: changes.title } : {}),
          ...(changes.slug !== undefined ? { slug: changes.slug } : {}),
          ...(changes.content !== undefined ? { content: changes.content as Prisma.InputJsonValue } : {}),
          ...(changes.status !== undefined ? { status: changes.status } : {}),
          ...(changes.registrations !== undefined ? { registrations: changes.registrations } : {}),
          updatedAt: new Date(),
          updatedById: actorId,
        },
      })
      if (!changes.sessions) return
      // gravarSessoes da main: a ordem é a posição na lista; sessão com qualquer inscrição (até cancelada) nunca é apagada.
      const existing = await tx.eventSession.findMany({
        where: { eventId: id },
        select: { id: true, _count: { select: { registrations: true } } },
      })
      const own = new Set(existing.map((session) => session.id))
      const kept = new Set<number>()
      for (const [order, session] of changes.sessions.entries()) {
        if (session.id && own.has(session.id)) {
          await tx.eventSession.update({ where: { id: session.id }, data: sessionData(session, order) })
          kept.add(session.id)
        } else {
          const created = await tx.eventSession.create({ data: { eventId: id, ...sessionData(session, order) }, select: { id: true } })
          kept.add(created.id)
        }
      }
      const removable = existing.filter((session) => !kept.has(session.id) && session._count.registrations === 0).map((session) => session.id)
      if (removable.length) await tx.eventSession.deleteMany({ where: { id: { in: removable } } })
    })
  },
}
