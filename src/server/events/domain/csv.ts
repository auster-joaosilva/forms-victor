import { brasiliaDateParts, formatBrasiliaDateTime } from '../../shared/domain/dates'
import { REGISTRATION_STATUS_LEGACY, SESSION_FORMAT_LEGACY, type RegistrationStatus, type SessionFormat } from './event'

export interface CsvRegistration {
  protocol: string
  createdAt: Date
  status: RegistrationStatus
  eventTitle: string
  sessionTitle: string
  sessionDate: string
  sessionTime: string
  sessionFormat: SessionFormat
  name: string
  email: string
  phone: string | null
  company: string | null
  cnpj: string | null
  jobTitle: string | null
  responseId: number | null
  originIp: string | null
  handledBy: string | null
  internalNote: string | null
}

// Cabeçalhos de planilhaDeInscricoes da origin/main.
export const REGISTRATION_CSV_HEADER: readonly string[] = ['protocolo', 'inscrito em (Brasilia)', 'situacao', 'evento', 'encontro',
  'data do encontro', 'hora', 'formato', 'nome', 'e-mail', 'telefone', 'empresa', 'CNPJ',
  'cargo', 'diagnostico vinculado', 'origem do acesso', 'tratado por', 'nota interna']

export function registrationCsvRows(rows: CsvRegistration[]): string[][] {
  const body = rows.map((row) => [
    row.protocol,
    formatBrasiliaDateTime(row.createdAt),
    REGISTRATION_STATUS_LEGACY[row.status],
    row.eventTitle,
    row.sessionTitle,
    row.sessionDate,
    row.sessionTime,
    SESSION_FORMAT_LEGACY[row.sessionFormat],
    row.name,
    row.email,
    row.phone ?? '',
    row.company ?? '',
    row.cnpj ?? '',
    row.jobTitle ?? '',
    row.responseId ? `resposta ${row.responseId}` : '',
    row.originIp ?? '',
    row.handledBy ?? '',
    row.internalNote ?? '',
  ])
  return [[...REGISTRATION_CSV_HEADER], ...body]
}

export function registrationCsvFileName(today: Date): string {
  const { year, month, day } = brasiliaDateParts(today)
  return `inscritos-${year}-${month}-${day}.csv`
}
