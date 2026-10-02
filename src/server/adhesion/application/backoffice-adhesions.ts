import { toCsv } from '@/server/shared/domain/csv-format'
import { isAdhesionStatus, type AdhesionStatus, type Modality, type WithoutManifestationChoice } from '../domain/adhesion'
import { adhesionCsvFileName, adhesionCsvRows } from '../domain/csv'
import { termCopyOf, type TermCopy } from '../domain/term-copy'
import { adhesionWindow, type AdhesionWindow } from '../domain/window'
import type { AdhesionCounts, AdhesionFilter, AdhesionListItem, AdhesionRepository } from '../ports/adhesion-repository'
import type { AdhesionAuditRecorder } from '../ports/audit-recorder'
import type { Clock } from '../ports/clock'

export const PAGE_SIZE = 50
export const EXPORT_LIMIT = 5000

export type BackofficeActor = { id: string; username: string }

export interface AdhesionSummary {
  id: number
  protocol: string
  acceptedAt: string
  companyName: string
  cnpj: string
  representative: string
  role: string
  email: string
  modalidade: Modality
  semManifestacao: WithoutManifestationChoice | null
  querProposta: boolean
  status: AdhesionStatus
  handledBy: string | null
  handledAt: string | null
}

export interface AdhesionList {
  counts: AdhesionCounts
  items: AdhesionSummary[]
  total: number
  page: number
  pageCount: number
  window: AdhesionWindow
}

const summary = (row: AdhesionListItem): AdhesionSummary => ({
  id: row.id,
  protocol: row.protocol,
  acceptedAt: row.acceptedAt.toISOString(),
  companyName: row.empresa.nomeEmpresa,
  cnpj: row.empresa.cnpj,
  representative: row.empresa.representante,
  role: row.empresa.cargo,
  email: row.empresa.email,
  modalidade: row.modalidade,
  semManifestacao: row.semManifestacao,
  querProposta: row.querProposta,
  status: row.status,
  handledBy: row.handledBy,
  handledAt: row.handledAt?.toISOString() ?? null,
})

const cleanFilter = ({ status, modality, search }: AdhesionFilter): AdhesionFilter => ({ status, modality, search: search?.trim() || undefined })

export function makeAdhesionBackoffice({ adhesions, clock, recordAudit }: {
  adhesions: AdhesionRepository
  clock: Clock
  recordAudit: AdhesionAuditRecorder
}) {
  return {
    async list({ page = 1, ...filter }: AdhesionFilter): Promise<AdhesionList> {
      const [{ items, total }, counts] = await Promise.all([adhesions.list({ ...cleanFilter(filter), page }, PAGE_SIZE), adhesions.counts()])
      return { counts, items: items.map(summary), total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), window: adhesionWindow(clock.now()) }
    },

    async handle(actor: BackofficeActor, { id, status }: { id: number; status: string }): Promise<{ ok: true } | { ok: false; error: string }> {
      if (!isAdhesionStatus(status)) return { ok: false, error: 'situação inválida' }
      const current = await adhesions.findById(id)
      if (!current) return { ok: false, error: 'adesão não encontrada' }
      // No Padrão não há ato no Portal do Simples Nacional: marcar protocolada registraria algo que não existe.
      if (status === 'filed' && current.modalidade !== 'hibrido') return { ok: false, error: 'só a opção pelo híbrido é protocolada' }
      await adhesions.setStatus(id, status, actor.id, clock.now())
      await recordAudit({ action: 'adhesion_handled', actorId: actor.id, actorUsername: actor.username, reference: String(id), detail: { from: current.status, to: status } })
      return { ok: true }
    },

    async exportCsv(actor: BackofficeActor, filter: AdhesionFilter): Promise<{ fileName: string; body: string }> {
      const clean = cleanFilter(filter)
      const rows = await adhesions.listForExport(clean, EXPORT_LIMIT)
      await recordAudit({
        action: 'spreadsheet_exported', actorId: actor.id, actorUsername: actor.username, reference: String(rows.length),
        detail: { kind: 'adhesions', count: rows.length, status: clean.status ?? null, modality: clean.modality ?? null, search: clean.search ?? null },
      })
      return { fileName: adhesionCsvFileName(clock.now()), body: toCsv(adhesionCsvRows(rows)) }
    },

    async termCopy(id: number): Promise<TermCopy> {
      return termCopyOf(await adhesions.findById(id))
    },
  }
}
