export type AdhesionAuditRecorder = (entry: {
  action: 'adhesion_received' | 'adhesion_handled' | 'spreadsheet_exported'
  actorId?: string | null
  actorUsername?: string | null
  reference: string
  detail: Record<string, unknown>
}) => Promise<void>
