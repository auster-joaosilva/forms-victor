import type { AuditEntry, AuditEntryInput } from '../domain/audit-entry'

export interface AuditLogRepository {
  append(entry: AuditEntryInput): Promise<void>
  latest(limit: number): Promise<AuditEntry[]>
}
