export const AUDIT_ACTIONS = [
  'access_denied', 'login', 'user_created', 'user_updated', 'admin_bootstrapped',
  'invitation_created', 'invitation_deleted', 'response_received', 'response_updated', 'response_handled',
  'adhesion_received', 'adhesion_handled', 'event_created', 'event_updated', 'event_slug_changed',
  'registration_received', 'registration_handled', 'file_stored', 'spreadsheet_exported', 'legacy_imported',
  'test_data_reset',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  access_denied: 'acesso negado',
  login: 'entrada',
  user_created: 'usuário criado',
  user_updated: 'usuário alterado',
  admin_bootstrapped: 'administrador de implantação',
  invitation_created: 'convite criado',
  invitation_deleted: 'convite apagado',
  response_received: 'resposta recebida',
  response_updated: 'resposta alterada pelo cliente',
  response_handled: 'resposta tratada',
  adhesion_received: 'adesão recebida',
  adhesion_handled: 'adesão tratada',
  event_created: 'evento criado',
  event_updated: 'evento alterado',
  event_slug_changed: 'endereço do evento trocado',
  registration_received: 'inscrição recebida',
  registration_handled: 'inscrição tratada',
  file_stored: 'arquivo guardado',
  spreadsheet_exported: 'planilha exportada',
  legacy_imported: 'migração do portal antigo',
  test_data_reset: 'dados de teste apagados',
}

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
