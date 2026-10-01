import { normalizeCnpj } from '@/server/shared/domain/validation'
import type { LegacyEvent, LegacyInvitation, LegacyResponse, LegacyUser } from './legacy-rows'

export type ImportedAuditAction =
  | 'access_denied' | 'invitation_created' | 'invitation_deleted' | 'response_received' | 'response_handled'
  | 'adhesion_received' | 'adhesion_handled' | 'event_created' | 'event_updated' | 'event_slug_changed'
  | 'registration_received' | 'registration_handled' | 'user_created' | 'user_updated' | 'spreadsheet_exported' | 'legacy_imported'

export type ImportedStatus = 'new' | 'in_review' | 'validated' | 'discarded'

export interface ImportedUser {
  id: string
  username: string
  name: string
  email: string
  role: 'admin' | 'team'
  banned: boolean
  banReason: string | null
  createdAt: Date
  lastLoginAt: Date | null
}

export interface ImportedInvitation {
  token: string
  companyName: string | null
  cnpj: string | null
  email: string | null
  note: string | null
  createdAt: Date
  createdById: string | null
  openCount: number
  lastOpenedAt: Date | null
}

export interface ImportedResponse {
  id: number
  protocol: string
  invitationToken: string | null
  receivedAt: Date
  companyName: string | null
  cnpj: string | null
  cnpjDigits: string | null
  requester: string | null
  email: string | null
  phone: string | null
  formVersion: string | null
  outcome: string | null
  position: string | null
  certainty: string | null
  urgency: string | null
  confidence: string | null
  requesterInQsa: boolean | null
  payload: unknown
  status: ImportedStatus
  internalNote: string | null
  handledById: string | null
  handledAt: Date | null
}

export interface ImportedAuditEntry {
  occurredAt: Date
  actorId: string | null
  actorUsername: string | null
  action: ImportedAuditAction
  reference: string | null
  detail: Record<string, unknown>
}

export const AUDIT_ACTION_MAP: Record<string, { action: ImportedAuditAction; extra?: Record<string, unknown> }> = {
  acesso_negado: { action: 'access_denied' },
  convite_criado: { action: 'invitation_created' },
  convite_apagado: { action: 'invitation_deleted' },
  resposta_recebida: { action: 'response_received' },
  resposta_tratada: { action: 'response_handled' },
  adesao_recebida: { action: 'adhesion_received' },
  adesao_tratada: { action: 'adhesion_handled' },
  evento_criado: { action: 'event_created' },
  evento_alterado: { action: 'event_updated' },
  evento_endereco_trocado: { action: 'event_slug_changed' },
  inscricao_recebida: { action: 'registration_received' },
  inscricao_tratada: { action: 'registration_handled' },
  usuario_criado: { action: 'user_created' },
  usuario_alterado: { action: 'user_updated' },
  planilha_exportada: { action: 'spreadsheet_exported', extra: { kind: 'responses' } },
  planilha_adesoes_exportada: { action: 'spreadsheet_exported', extra: { kind: 'adhesions' } },
  planilha_inscricoes_exportada: { action: 'spreadsheet_exported', extra: { kind: 'registrations' } },
}

export const STATUS_MAP: Record<string, ImportedStatus> = { nova: 'new', em_analise: 'in_review', validada: 'validated', descartada: 'discarded' }

const date = (value: string | null): Date | null => (value ? new Date(value) : null)

export function translateAuditAction(legacy: string): { action: ImportedAuditAction; extra: Record<string, unknown>; known: boolean } {
  const found = AUDIT_ACTION_MAP[legacy]
  return found ? { action: found.action, extra: found.extra ?? {}, known: true } : { action: 'legacy_imported', extra: { legacyAction: legacy }, known: false }
}

export function assignProtocols(rows: { id: number; protocolo: string }[]): Map<number, string> {
  const assigned = new Map<number, string>()
  const used = new Set<string>()
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    const base = row.protocolo.trim()
    let protocol = !base || base === '(sem protocolo)' ? `SEM-${row.id}` : base
    for (let suffix = 2; used.has(protocol); suffix++) protocol = `${base}-${suffix}`
    used.add(protocol)
    assigned.set(row.id, protocol)
  }
  return assigned
}

export const requesterInQsaFrom = (value: string | null): boolean | null => (value === 'sim' ? true : value === 'nao' ? false : null)

export const cnpjDigitsOf = (cnpj: string | null): string | null => normalizeCnpj(cnpj ?? '') || null

function parseJson(text: string | null): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

export const mapUser = (row: LegacyUser, id: string): ImportedUser => ({
  id,
  username: row.usuario,
  name: row.nome || row.usuario,
  email: `${row.usuario}@users.invalid`,
  role: row.papel === 'admin' ? 'admin' : 'team',
  banned: row.ativo === 0,
  banReason: row.ativo === 0 ? 'desativado' : null,
  createdAt: new Date(row.criado_em),
  lastLoginAt: date(row.acesso_em),
})

export const mapInvitation = (row: LegacyInvitation, userIds: Map<string, string>): ImportedInvitation => ({
  token: row.token,
  companyName: row.nome_empresa,
  cnpj: row.cnpj,
  email: row.email,
  note: row.observacao,
  createdAt: new Date(row.criado_em),
  createdById: row.criado_por ? (userIds.get(row.criado_por) ?? null) : null,
  openCount: row.aberturas,
  lastOpenedAt: date(row.aberto_em),
})

export function mapResponse(row: LegacyResponse, context: { protocol: string; invitationTokens: Set<string>; userIds: Map<string, string> }): ImportedResponse {
  return {
    id: row.id,
    protocol: context.protocol,
    invitationToken: row.token_convite && context.invitationTokens.has(row.token_convite) ? row.token_convite : null,
    receivedAt: new Date(row.recebido_em),
    companyName: row.nome_empresa,
    cnpj: row.cnpj,
    cnpjDigits: cnpjDigitsOf(row.cnpj),
    requester: row.solicitante,
    email: row.email,
    phone: row.telefone,
    formVersion: row.versao,
    outcome: row.saida,
    position: row.posicao,
    certainty: row.certeza,
    urgency: row.urgencia,
    confidence: row.confianca,
    requesterInQsa: requesterInQsaFrom(row.solicitante_no_qsa),
    payload: parseJson(row.pacote) ?? {},
    status: STATUS_MAP[row.situacao] ?? 'new',
    internalNote: row.nota_interna,
    handledById: row.tratado_por ? (context.userIds.get(row.tratado_por) ?? null) : null,
    handledAt: date(row.tratado_em),
  }
}

export function mapAuditEvent(row: LegacyEvent, userIds: Map<string, string>): ImportedAuditEntry {
  const { action, extra } = translateAuditAction(row.o_que)
  const parsed = parseJson(row.detalhe)
  const detail = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : parsed === null ? {} : { value: parsed }
  return {
    occurredAt: new Date(row.quando),
    actorId: row.quem ? (userIds.get(row.quem) ?? null) : null,
    actorUsername: row.quem,
    action,
    reference: row.referencia,
    detail: { ...detail, ...extra, legacyEventId: row.id },
  }
}
