import type { AuditEntryInput } from '../domain/audit-entry'
import type { AuditLogRepository } from '../ports/audit-log-repository'

export const makeRecordAudit = (repository: AuditLogRepository) => async (entry: AuditEntryInput) => {
  const detail = entry.detail
    ? Object.fromEntries(Object.entries(entry.detail).filter(([, value]) => value !== undefined))
    : null
  await repository.append({
    action: entry.action,
    actorId: entry.actorId ?? null,
    actorUsername: entry.actorUsername ?? null,
    reference: entry.reference ?? null,
    detail,
  })
}

export const makeListAudit = (repository: AuditLogRepository) => (limit = 200) =>
  repository.latest(Math.min(Math.max(limit, 1), 500))
