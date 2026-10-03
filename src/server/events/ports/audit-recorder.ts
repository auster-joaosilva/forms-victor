export type EventsAuditRecorder = (entry: {
  action: 'event_created' | 'event_updated' | 'event_slug_changed' | 'registration_received' | 'registration_handled' | 'file_stored'
    | 'spreadsheet_exported'
  actorId?: string | null
  actorUsername?: string | null
  reference: string
  detail: Record<string, unknown>
}) => Promise<void>
