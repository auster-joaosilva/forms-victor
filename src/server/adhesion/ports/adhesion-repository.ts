import type { AdhesionRecord, AdhesionStatus, Modality, NormalizedSubmission } from '../domain/adhesion'
import type { CsvAdhesion } from '../domain/csv'

export interface NewAdhesion {
  protocol: string
  receiptToken: string
  acceptedAt: Date
  submission: NormalizedSubmission
  cnpjDigits: string
  responseId: number | null
  invitationToken: string | null
  termVersion: string
  termHash: string
  originIp: string | null
  originSource: string | null
  forwardedChain: string | null
  userAgent: string | null
  payload: Record<string, unknown>
}

export interface AdhesionFilter {
  status?: AdhesionStatus
  modality?: Modality
  search?: string
  page?: number
}

export interface AdhesionListItem extends AdhesionRecord {
  status: AdhesionStatus
  handledBy: string | null
  handledAt: Date | null
}

export interface AdhesionCounts {
  total: number
  standard: number
  hybrid: number
  received: number
  filed: number
  cancelled: number
  toFile: number
}

export interface AdhesionRepository {
  create(input: NewAdhesion): Promise<{ id: number } | 'protocol_taken'>
  findByReceiptToken(token: string): Promise<AdhesionRecord | null>
  findById(id: number): Promise<(AdhesionRecord & { status: AdhesionStatus }) | null>
  list(filter: AdhesionFilter, pageSize: number): Promise<{ items: AdhesionListItem[]; total: number }>
  counts(): Promise<AdhesionCounts>
  listForExport(filter: AdhesionFilter, limit: number): Promise<CsvAdhesion[]>
  setStatus(id: number, status: AdhesionStatus, actorId: string, at: Date): Promise<void>
}
