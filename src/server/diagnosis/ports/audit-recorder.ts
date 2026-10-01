export type DiagnosisAuditRecorder = (entry: {
  action: 'response_received' | 'response_updated' | 'response_handled' | 'spreadsheet_exported'
  actorId?: string | null
  actorUsername?: string | null
  reference: string
  detail: Record<string, unknown>
}) => Promise<void>
