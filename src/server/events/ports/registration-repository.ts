import type { CsvRegistration } from '../domain/csv'
import type { RegistrationStatus, SessionFormat } from '../domain/event'

export interface NewRegistration {
  eventId: number
  sessionId: number
  protocol: string
  name: string
  email: string
  phone: string | null
  company: string | null
  cnpj: string | null
  cnpjDigits: string | null
  jobTitle: string | null
  responseId: number | null
  originIp: string | null
  userAgent: string | null
  payload: Record<string, unknown>
}

export type RegisterResult =
  | { kind: 'created'; id: number; protocol: string }
  | { kind: 'repeated'; id: number; protocol: string }
  | { kind: 'full' }
  | { kind: 'protocol_taken' }

export interface RegistrationFilter { sessionId?: number; status?: RegistrationStatus; search?: string }

export interface RegistrationRow {
  id: number
  protocol: string
  createdAt: Date
  name: string
  email: string
  phone: string | null
  company: string | null
  cnpj: string | null
  jobTitle: string | null
  responseId: number | null
  status: RegistrationStatus
  sessionId: number
  sessionTitle: string
  sessionDate: string
  sessionTime: string
  sessionFormat: SessionFormat
}

export interface RegistrationCounts {
  total: number
  registered: number
  confirmed: number
  present: number
  absent: number
  cancelled: number
}

export interface RegistrationRepository {
  register(input: NewRegistration): Promise<RegisterResult>
  listForEvent(eventId: number, filter: RegistrationFilter): Promise<RegistrationRow[]>
  counts(eventId: number): Promise<RegistrationCounts>
  listForExport(eventId: number, filter: RegistrationFilter, limit: number): Promise<CsvRegistration[]>
  findById(id: number): Promise<{ id: number; eventId: number; status: RegistrationStatus } | null>
  // duplicate_active: a mesma pessoa já tem outra inscrição ativa no encontro, e o índice parcial recusa a segunda.
  setStatus(id: number, status: RegistrationStatus, actorId: string, at: Date): Promise<'updated' | 'duplicate_active'>
}
