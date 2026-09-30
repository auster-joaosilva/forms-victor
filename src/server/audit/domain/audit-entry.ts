export const AUDIT_ACTIONS = [
  'access_denied', 'login', 'user_created', 'user_updated', 'admin_bootstrapped',
  'invitation_created', 'invitation_deleted', 'response_received', 'response_handled',
  'adhesion_received', 'adhesion_handled', 'event_created', 'event_updated', 'event_slug_changed',
  'registration_received', 'registration_handled', 'file_stored', 'spreadsheet_exported',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export interface AuditEntryInput {
  action: AuditAction
  actorId?: string | null
  actorUsername?: string | null
  reference?: string | null
  detail?: Record<string, unknown> | null
}

export interface AuditEntry extends AuditEntryInput {
  id: number
  occurredAt: Date
}
