import { prismaAuditLogRepository } from './adapters/prisma-audit-log-repository'
import { makeListAudit, makeRecordAudit } from './application/record-audit'

export const recordAudit = makeRecordAudit(prismaAuditLogRepository)
export const listAudit = makeListAudit(prismaAuditLogRepository)
export type { AuditAction, AuditEntry, AuditEntryInput } from './domain/audit-entry'
