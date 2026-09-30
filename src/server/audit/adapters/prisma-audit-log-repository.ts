import type { Prisma } from '@/server/shared/prisma/generated/client'
import { prisma } from '@/server/shared/prisma/client'
import type { AuditLogRepository } from '../ports/audit-log-repository'
import type { AuditAction } from '../domain/audit-entry'

export const prismaAuditLogRepository: AuditLogRepository = {
  async append(entry) {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId ?? null,
        actorUsername: entry.actorUsername ?? null,
        reference: entry.reference ?? null,
        detail: (entry.detail ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
  },
  async latest(limit) {
    const rows = await prisma.auditLog.findMany({ orderBy: { occurredAt: 'desc' }, take: limit })
    return rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt,
      action: row.action as AuditAction,
      actorId: row.actorId,
      actorUsername: row.actorUsername,
      reference: row.reference,
      detail: row.detail as Record<string, unknown> | null,
    }))
  },
}
