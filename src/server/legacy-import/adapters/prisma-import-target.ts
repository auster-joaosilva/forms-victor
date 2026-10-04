import type { Prisma } from '@/server/shared/prisma/generated/client'
import { prisma } from '@/server/shared/prisma/client'
import type { ImportTarget } from '../ports/import-target'

const LONG_TRANSACTION = { timeout: 300_000, maxWait: 10_000 }
const json = (value: unknown) => value as Prisma.InputJsonValue

export const prismaImportTarget: ImportTarget = {
  existingUsernames: async () =>
    new Map((await prisma.user.findMany({ select: { id: true, username: true } })).flatMap((user) => (user.username ? [[user.username, user.id] as const] : []))),
  existingInvitationTokens: async () => new Set((await prisma.invitation.findMany({ select: { token: true } })).map((row) => row.token)),
  existingResponses: async () => new Map((await prisma.response.findMany({ select: { id: true, protocol: true } })).map((row) => [row.id, row.protocol] as const)),
  existingProtocols: async () => new Map((await prisma.response.findMany({ select: { id: true, protocol: true } })).map((row) => [row.protocol, row.id] as const)),
  existingAdhesions: async () => new Map((await prisma.adhesion.findMany({ select: { id: true, protocol: true } })).map((row) => [row.id, row.protocol] as const)),
  existingAdhesionProtocols: async () => new Map((await prisma.adhesion.findMany({ select: { id: true, protocol: true } })).map((row) => [row.protocol, row.id] as const)),
  existingEvents: async () => new Map((await prisma.event.findMany({ select: { id: true, slug: true } })).map((row) => [row.id, row.slug] as const)),
  existingEventSlugs: async () => new Map((await prisma.event.findMany({ select: { id: true, slug: true } })).map((row) => [row.slug, row.id] as const)),
  existingSessions: async () => new Map((await prisma.eventSession.findMany({ select: { id: true, eventId: true } })).map((row) => [row.id, row.eventId] as const)),
  existingRegistrations: async () => new Map((await prisma.registration.findMany({ select: { id: true, protocol: true } })).map((row) => [row.id, row.protocol] as const)),
  existingRegistrationProtocols: async () =>
    new Map((await prisma.registration.findMany({ select: { id: true, protocol: true } })).map((row) => [row.protocol, row.id] as const)),
  importedEventIds: async () => {
    const rows = await prisma.$queryRaw<{ id: number }[]>`SELECT (detail->>'legacyEventId')::int AS id FROM audit_logs WHERE detail->>'legacyEventId' IS NOT NULL`
    return new Set(rows.map((row) => row.id))
  },
  insertUsers: async (rows) =>
    prisma.$transaction(async (tx) => {
      if (rows.length) await tx.user.createMany({ data: rows.map((row) => ({ ...row, displayUsername: row.username })) })
    }, LONG_TRANSACTION),
  insertInvitations: async (rows) =>
    prisma.$transaction(async (tx) => {
      if (rows.length) await tx.invitation.createMany({ data: rows })
    }, LONG_TRANSACTION),
  insertResponses: async (rows) =>
    prisma.$transaction(async (tx) => {
      if (rows.length) await tx.response.createMany({ data: rows.map((row) => ({ ...row, payload: json(row.payload) })) })
      // Ids were copied by hand: without this the next submission would collide with a migrated id.
      await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('responses', 'id'), COALESCE((SELECT MAX(id) FROM responses), 0) + 1, false)`
    }, LONG_TRANSACTION),
  insertAdhesions: async (rows) =>
    prisma.$transaction(async (tx) => {
      if (rows.length) await tx.adhesion.createMany({ data: rows.map((row) => ({ ...row, payload: json(row.payload) })) })
      // Same reason as the responses: copied ids would collide with the next adhesion.
      await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('adhesions', 'id'), COALESCE((SELECT MAX(id) FROM adhesions), 0) + 1, false)`
    }, LONG_TRANSACTION),
  insertEventsAndSessions: async (events, sessions) =>
    prisma.$transaction(async (tx) => {
      if (events.length) await tx.event.createMany({ data: events.map((row) => ({ ...row, content: json(row.content) })) })
      if (sessions.length) await tx.eventSession.createMany({ data: sessions })
      // Same reason as the responses: a copied id would collide with the next event or session created in the backoffice.
      await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('events', 'id'), COALESCE((SELECT MAX(id) FROM events), 0) + 1, false)`
      await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('event_sessions', 'id'), COALESCE((SELECT MAX(id) FROM event_sessions), 0) + 1, false)`
    }, LONG_TRANSACTION),
  insertRegistrations: async (rows) =>
    prisma.$transaction(async (tx) => {
      if (rows.length) await tx.registration.createMany({ data: rows.map((row) => ({ ...row, payload: json(row.payload) })) })
      await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('registrations', 'id'), COALESCE((SELECT MAX(id) FROM registrations), 0) + 1, false)`
    }, LONG_TRANSACTION),
  insertAuditEntries: async (rows) =>
    prisma.$transaction(async (tx) => {
      if (rows.length) await tx.auditLog.createMany({ data: rows.map((row) => ({ ...row, detail: json(row.detail) })) })
    }, LONG_TRANSACTION),
  recordImport: async (detail, actor) =>
    void (await prisma.auditLog.create({ data: { action: 'legacy_imported', actorId: actor?.id ?? null, actorUsername: actor?.username ?? 'migracao', detail } })),
}
