import type { AdhesionRecord, AdhesionStatus } from '../../domain/adhesion'
import type { CsvAdhesion } from '../../domain/csv'
import type { AdhesionAuditRecorder } from '../../ports/audit-recorder'
import type { AdhesionCounts, AdhesionFilter, AdhesionListItem, AdhesionRepository, NewAdhesion } from '../../ports/adhesion-repository'
import type { AdhesionInvitationGateway } from '../../ports/invitation-gateway'
import type { ProtocolGenerator } from '../../ports/protocol-generator'
import type { ReceiptTokenGenerator } from '../../ports/receipt-token-generator'
import type { ResponseLookup } from '../../ports/response-lookup'

export function fakeClock(start: string) {
  let current = new Date(start)
  return { now: () => current, set: (iso: string) => void (current = new Date(iso)) }
}

export type StoredAdhesion = NewAdhesion & {
  id: number
  status: AdhesionStatus
  handledById: string | null
  handledAt: Date | null
  internalNote: string | null
}

const toRecord = (row: StoredAdhesion): AdhesionRecord => ({
  id: row.id,
  protocol: row.protocol,
  acceptedAt: row.acceptedAt,
  empresa: row.submission.empresa,
  modalidade: row.submission.modalidade,
  semManifestacao: row.submission.semManifestacao,
  querProposta: row.submission.querProposta,
  termVersion: row.termVersion,
  termHash: row.termHash,
  originIp: row.originIp,
})

export function memoryAdhesions({ usernames = {} }: { usernames?: Record<string, string> } = {}) {
  const rows = new Map<number, StoredAdhesion>()
  let sequence = 0
  const sorted = () => [...rows.values()].sort((a, b) => b.acceptedAt.getTime() - a.acceptedAt.getTime() || b.id - a.id)
  const matches = (row: StoredAdhesion, filter: AdhesionFilter) => {
    const search = filter.search?.trim().toLowerCase()
    const { empresa } = row.submission
    return (
      (!filter.status || row.status === filter.status) &&
      (!filter.modality || row.submission.modalidade === filter.modality) &&
      (!search || [empresa.nomeEmpresa, empresa.cnpj, row.protocol, empresa.representante].some((value) => value.toLowerCase().includes(search)))
    )
  }
  const toListItem = (row: StoredAdhesion): AdhesionListItem => ({
    ...toRecord(row),
    status: row.status,
    handledBy: row.handledById ? (usernames[row.handledById] ?? null) : null,
    handledAt: row.handledAt,
  })
  const toCsv = (row: StoredAdhesion): CsvAdhesion => ({
    protocol: row.protocol,
    acceptedAt: row.acceptedAt,
    status: row.status,
    modalidade: row.submission.modalidade,
    semManifestacao: row.submission.semManifestacao,
    empresa: row.submission.empresa,
    querProposta: row.submission.querProposta,
    responseId: row.responseId,
    invitationToken: row.invitationToken,
    termVersion: row.termVersion,
    termHash: row.termHash,
    originIp: row.originIp,
    originSource: row.originSource,
    forwardedChain: row.forwardedChain,
    userAgent: row.userAgent,
    handledBy: row.handledById ? (usernames[row.handledById] ?? null) : null,
    handledAt: row.handledAt,
    internalNote: row.internalNote,
  })
  const repository: AdhesionRepository = {
    create: async (input) => {
      if ([...rows.values()].some((row) => row.protocol === input.protocol)) return 'protocol_taken'
      const id = ++sequence
      rows.set(id, { ...input, id, status: 'received', handledById: null, handledAt: null, internalNote: null })
      return { id }
    },
    findByReceiptToken: async (token) => {
      const row = [...rows.values()].find((candidate) => candidate.receiptToken === token)
      return row ? toRecord(row) : null
    },
    findById: async (id) => {
      const row = rows.get(id)
      return row ? { ...toRecord(row), status: row.status } : null
    },
    list: async (filter, pageSize) => {
      const found = sorted().filter((row) => matches(row, filter))
      const skip = ((filter.page ?? 1) - 1) * pageSize
      return { items: found.slice(skip, skip + pageSize).map(toListItem), total: found.length }
    },
    counts: async () => {
      const counts: AdhesionCounts = { total: 0, standard: 0, hybrid: 0, received: 0, filed: 0, cancelled: 0, toFile: 0 }
      for (const row of rows.values()) {
        counts.total++
        counts[row.submission.modalidade === 'hibrido' ? 'hybrid' : 'standard']++
        counts[row.status]++
        if (row.submission.modalidade === 'hibrido' && row.status === 'received') counts.toFile++
      }
      return counts
    },
    listForExport: async (filter, limit) => sorted().filter((row) => matches(row, filter)).slice(0, limit).map(toCsv),
    setStatus: async (id, status, actorId, at) => {
      const row = rows.get(id)
      if (row) rows.set(id, { ...row, status, handledById: actorId, handledAt: at })
    },
  }
  return { rows, repository }
}

export function memoryResponseLookup(byDigits: Record<string, number> = {}): ResponseLookup {
  return { latestByCnpjDigits: async (digits) => byDigits[digits] ?? null }
}

export function memoryInvitations(seed: { token: string; companyName: string | null; cnpj: string | null; email: string | null }[] = []) {
  const opens = new Map<string, { count: number; at: Date | null }>()
  const gateway: AdhesionInvitationGateway = {
    find: async (token) => seed.find((invitation) => invitation.token === token) ?? null,
    markOpened: async (token, at) => {
      opens.set(token, { count: (opens.get(token)?.count ?? 0) + 1, at })
    },
  }
  return { gateway, opens }
}

/** Devolve os protocolos na ordem; depois do último, repete o último. */
export function sequenceProtocols(protocols: string[]): ProtocolGenerator {
  let index = 0
  return { next: () => protocols[Math.min(index++, protocols.length - 1)] ?? 'ADS-20261001-AAAAA' }
}

export function counterReceiptTokens(): ReceiptTokenGenerator {
  let count = 0
  return { next: () => (++count).toString(16).padStart(64, '0') }
}

export function auditSpy() {
  const entries: Parameters<AdhesionAuditRecorder>[0][] = []
  const record: AdhesionAuditRecorder = async (entry) => void entries.push(entry)
  return { entries, record }
}
