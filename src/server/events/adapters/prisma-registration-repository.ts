import type { Prisma } from '@/server/shared/prisma/generated/client'
import { prisma } from '@/server/shared/prisma/client'
import type { CsvRegistration } from '../domain/csv'
import type { RegistrationCounts, RegistrationFilter, RegistrationRepository, RegistrationRow } from '../ports/registration-repository'

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'

const isoDate = (date: Date): string => date.toISOString().slice(0, 10)

async function activeFor(client: Prisma.TransactionClient | typeof prisma, sessionId: number, email: string) {
  const [row] = await client.$queryRaw<{ id: number; protocol: string }[]>`
    SELECT id, protocol FROM registrations
    WHERE session_id = ${sessionId} AND lower(email) = lower(${email}) AND status <> 'cancelled'
    ORDER BY id LIMIT 1`
  return row ?? null
}

const where = (eventId: number, filter: RegistrationFilter): Prisma.RegistrationWhereInput => ({
  eventId,
  ...(filter.sessionId ? { sessionId: filter.sessionId } : {}),
  ...(filter.status ? { status: filter.status } : {}),
  ...(filter.search ? {
    OR: ['name', 'email', 'company', 'cnpj', 'protocol'].map((field) => ({ [field]: { contains: filter.search, mode: 'insensitive' } })),
  } : {}),
})

const sessionSelect = { title: true, date: true, time: true, format: true } as const

export const prismaRegistrationRepository: RegistrationRepository = {
  async register(input) {
    try {
      return await prisma.$transaction(async (tx) => {
        // A trava na linha da sessão põe em fila quem disputa a mesma sessão: a contagem abaixo já vê a inscrição de quem passou antes.
        const [session] = await tx.$queryRaw<{ seats: number | null }[]>`
          SELECT seats FROM event_sessions WHERE id = ${input.sessionId} AND event_id = ${input.eventId} FOR UPDATE`
        if (!session) throw new Error(`sessão ${input.sessionId} não pertence ao evento ${input.eventId}`)
        // A repetição vem ANTES da vaga: quem já está inscrito numa sessão lotada não pode ouvir "sem vaga".
        const repeated = await activeFor(tx, input.sessionId, input.email)
        if (repeated) return { kind: 'repeated' as const, id: repeated.id, protocol: repeated.protocol }
        if (session.seats !== null) {
          const taken = await tx.registration.count({ where: { sessionId: input.sessionId, status: { not: 'cancelled' } } })
          if (taken >= session.seats) return { kind: 'full' as const }
        }
        const row = await tx.registration.create({
          data: {
            protocol: input.protocol,
            eventId: input.eventId,
            sessionId: input.sessionId,
            responseId: input.responseId,
            name: input.name,
            email: input.email,
            phone: input.phone,
            company: input.company,
            cnpj: input.cnpj,
            cnpjDigits: input.cnpjDigits,
            jobTitle: input.jobTitle,
            privacyConsent: true,
            originIp: input.originIp,
            userAgent: input.userAgent,
            payload: input.payload as Prisma.InputJsonValue,
          },
          select: { id: true, protocol: true },
        })
        return { kind: 'created' as const, id: row.id, protocol: row.protocol }
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      // Dois índices únicos: o parcial (sessão + e-mail ativo) e o do protocolo. Quem ganhou a corrida já está gravado.
      const repeated = await activeFor(prisma, input.sessionId, input.email)
      if (repeated) return { kind: 'repeated', id: repeated.id, protocol: repeated.protocol }
      return { kind: 'protocol_taken' }
    }
  },

  async listForEvent(eventId, filter) {
    const rows = await prisma.registration.findMany({
      where: where(eventId, filter),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 1000,
      include: { session: { select: sessionSelect } },
    })
    return rows.map((row): RegistrationRow => ({
      id: row.id,
      protocol: row.protocol,
      createdAt: row.createdAt,
      name: row.name,
      email: row.email,
      phone: row.phone,
      company: row.company,
      cnpj: row.cnpj,
      jobTitle: row.jobTitle,
      responseId: row.responseId,
      status: row.status,
      sessionId: row.sessionId,
      sessionTitle: row.session.title,
      sessionDate: isoDate(row.session.date),
      sessionTime: row.session.time,
      sessionFormat: row.session.format,
    }))
  },

  async counts(eventId) {
    const groups = await prisma.registration.groupBy({ by: ['status'], where: { eventId }, _count: { _all: true } })
    const counts: RegistrationCounts = { total: 0, registered: 0, confirmed: 0, present: 0, absent: 0, cancelled: 0 }
    for (const group of groups) {
      counts[group.status] = group._count._all
      if (group.status !== 'cancelled') counts.total += group._count._all
    }
    return counts
  },

  async listForExport(eventId, filter, limit) {
    const rows = await prisma.registration.findMany({
      where: where(eventId, filter),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: { session: { select: sessionSelect }, event: { select: { title: true } }, handledBy: { select: { username: true } } },
    })
    return rows.map((row): CsvRegistration => ({
      protocol: row.protocol,
      createdAt: row.createdAt,
      status: row.status,
      eventTitle: row.event.title,
      sessionTitle: row.session.title,
      sessionDate: isoDate(row.session.date),
      sessionTime: row.session.time,
      sessionFormat: row.session.format,
      name: row.name,
      email: row.email,
      phone: row.phone,
      company: row.company,
      cnpj: row.cnpj,
      jobTitle: row.jobTitle,
      responseId: row.responseId,
      originIp: row.originIp,
      handledBy: row.handledBy?.username ?? null,
      internalNote: row.internalNote,
    }))
  },

  async findById(id) {
    return prisma.registration.findUnique({ where: { id }, select: { id: true, eventId: true, status: true } })
  },

  async setStatus(id, status, actorId, at) {
    await prisma.registration.update({ where: { id }, data: { status, handledById: actorId, handledAt: at } })
  },
}
