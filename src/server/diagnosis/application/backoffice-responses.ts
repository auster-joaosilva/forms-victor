import { csvFileName, csvRows, toCsv } from '../domain/csv'
import { RESPONSE_STATUSES, type ResponseStatus } from '../domain/response-status'
import { answerBlocks, readStoredPayload, type AnswerBlocks, type EngineSnapshot } from '../domain/stored-payload'
import type { DiagnosisAuditRecorder } from '../ports/audit-recorder'
import type { Clock } from '../ports/clock'
import type { ResponseBackofficeRepository, ResponseFilter, ResponseRecord } from '../ports/response-repository'

export const PAGE_SIZE = 50
export const EXPORT_LIMIT = 5000

export type BackofficeActor = { id: string; username: string }

export interface ResponseSummary {
  id: number
  protocol: string
  companyName: string | null
  cnpj: string | null
  requester: string | null
  email: string | null
  position: string | null
  outcome: string | null
  certainty: string | null
  urgency: string | null
  confidence: string | null
  receivedAt: string
  formVersion: string | null
  viaInvitation: boolean
  status: ResponseStatus
}

export interface ResponseList {
  counts: Record<'total' | ResponseStatus, number>
  items: ResponseSummary[]
  total: number
  page: number
  pageCount: number
}

export interface ResponseDetail extends ResponseSummary {
  invitationToken: string | null
  phone: string | null
  updatedAt: string | null
  engine: EngineSnapshot
  requesterInQsa: boolean | null
  answers: AnswerBlocks
  internalNote: string
  handledBy: string | null
  handledAt: string | null
  changedAfterHandling: boolean
}

const summary = (row: ResponseRecord): ResponseSummary => ({
  id: row.id,
  protocol: row.protocol,
  companyName: row.companyName,
  cnpj: row.cnpj,
  requester: row.requester,
  email: row.email,
  position: row.position,
  outcome: row.outcome,
  certainty: row.certainty,
  urgency: row.urgency,
  confidence: row.confidence,
  receivedAt: row.receivedAt.toISOString(),
  formVersion: row.formVersion,
  viaInvitation: row.invitationToken !== null,
  status: row.status,
})

const cleanFilter = ({ status, search }: ResponseFilter): ResponseFilter => ({ status, search: search?.trim() || undefined })

export function makeResponseBackoffice({ responses, clock, recordAudit }: {
  responses: ResponseBackofficeRepository
  clock: Clock
  recordAudit: DiagnosisAuditRecorder
}) {
  return {
    async listResponses({ page = 1, ...filter }: ResponseFilter & { page?: number }): Promise<ResponseList> {
      const [{ items, total }, byStatus] = await Promise.all([
        responses.list(cleanFilter(filter), { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
        responses.countByStatus(),
      ])
      const counts = { total: RESPONSE_STATUSES.reduce((sum, key) => sum + byStatus[key], 0), ...byStatus }
      return { counts, items: items.map(summary), total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
    },

    async getResponse(id: number): Promise<ResponseDetail | null> {
      const row = await responses.findById(id)
      if (!row) return null
      const payload = readStoredPayload(row.payload)
      return {
        ...summary(row),
        invitationToken: row.invitationToken,
        phone: row.phone,
        updatedAt: row.updatedAt?.toISOString() ?? null,
        engine: payload.engine,
        requesterInQsa: row.requesterInQsa ?? payload.requesterInQsa,
        answers: answerBlocks(payload.answers),
        internalNote: row.internalNote ?? '',
        handledBy: row.handledByUsername,
        handledAt: row.handledAt?.toISOString() ?? null,
        changedAfterHandling: Boolean(row.updatedAt && row.handledAt && row.updatedAt > row.handledAt),
      }
    },

    async handleResponse(actor: BackofficeActor, { id, status, note }: { id: number; status: ResponseStatus | null; note: string }) {
      const current = await responses.findById(id)
      if (!current) return { ok: false as const, message: 'Resposta não encontrada.' }
      if (status) await responses.setStatus(id, { status, note, handledById: actor.id, handledAt: clock.now() })
      else await responses.setNote(id, note)
      await recordAudit({ action: 'response_handled', actorId: actor.id, actorUsername: actor.username, reference: String(id), detail: { from: current.status, to: status ?? current.status, noteOnly: status === null } })
      return { ok: true as const }
    },

    async exportResponses(actor: BackofficeActor, filter: ResponseFilter) {
      const { status, search } = cleanFilter(filter)
      const rows = await responses.listForExport({ status, search }, EXPORT_LIMIT)
      const body = toCsv(csvRows(rows.map((row) => ({
        protocol: row.protocol,
        receivedAt: row.receivedAt,
        status: row.status,
        handledBy: row.handledByUsername,
        handledAt: row.handledAt,
        invitationToken: row.invitationToken,
        payload: readStoredPayload(row.payload),
      }))))
      await recordAudit({ action: 'spreadsheet_exported', actorId: actor.id, actorUsername: actor.username, reference: String(rows.length), detail: { kind: 'responses', count: rows.length, status: status ?? null, search: search ?? null } })
      return { fileName: csvFileName(clock.now()), body, count: rows.length }
    },
  }
}
