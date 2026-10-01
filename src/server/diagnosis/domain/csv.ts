import { brasiliaDateParts } from '../../shared/domain/dates'
import type { Question } from './question-types'
import { QUESTIONS } from './questions'
import { RESPONSE_STATUS_LABELS, type ResponseStatus } from './response-status'
import { columnText, optionText } from './review'
import { asRecord, asString, type StoredPayload } from './stored-payload'

export interface CsvResponse {
  protocol: string
  receivedAt: Date
  status: ResponseStatus
  handledBy: string | null
  handledAt: Date | null
  invitationToken: string | null
  payload: StoredPayload
}

const FIXED_HEADER = [
  'protocolo', 'recebido em', 'situacao', 'tratado por', 'tratado em',
  'origem', 'empresa', 'CNPJ', 'quem respondeu', 'e-mail', 'telefone',
  'versao', 'saida', 'posicao', 'certeza', 'urgencia', 'confianca',
  'pontos em aberto', 'campos em nao sei', 'gatilhos', 'quem respondeu no QSA',
]
const RAW_TYPES = new Set<Question['type']>(['text', 'email', 'phone', 'cnpj', 'textarea'])

const choiceText = (question: Question, value: unknown): string =>
  value === undefined || value === null || value === '' ? '' : optionText(question, value)

export function csvRows(responses: CsvResponse[]): string[][] {
  const simple = QUESTIONS.filter((question) => question.type !== 'matrix')
  const matrixColumns = QUESTIONS.filter((question) => question.type === 'matrix').flatMap((question) =>
    (question.rows ?? []).map((row) => ({ question, row })),
  )
  const header = [
    ...FIXED_HEADER,
    ...simple.map((question) => `${question.block}. ${question.prompt}`),
    ...matrixColumns.map(({ question, row }) => `${question.block}. ${question.prompt} — ${row.label}`),
  ]
  const body = responses.map(({ protocol, receivedAt, status, handledBy, handledAt, invitationToken, payload }) => {
    const { answers, engine, requesterInQsa, formVersion } = payload
    const raw = (key: string) => asString(answers[key])
    return [
      protocol, receivedAt.toISOString(), RESPONSE_STATUS_LABELS[status], handledBy ?? '', handledAt?.toISOString() ?? '',
      invitationToken ? `convite ${invitationToken}` : 'link aberto',
      raw('nomeEmpresa'), raw('cnpj'), raw('solicitante'), raw('email'), raw('telefone'),
      formVersion ?? '', engine.outcome, engine.position, engine.certainty, engine.urgency, engine.confidence,
      engine.openPoints.join(' | '), engine.gaps.join(' | '), engine.triggers.join(' | '),
      requesterInQsa === true ? 'sim' : requesterInQsa === false ? 'nao' : '',
      ...simple.map((question) => (RAW_TYPES.has(question.type) ? raw(question.key) : choiceText(question, answers[question.key]))),
      ...matrixColumns.map(({ question, row }) => {
        const value = asRecord(answers[question.key])[row.key]
        return typeof value === 'string' && value ? columnText(question, value) : ''
      }),
    ]
  })
  return [header, ...body]
}

// A leading =, +, -, @, tab or CR makes Excel read client-typed text as a formula.
const neutralised = (value: string): string => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value)

const cell = (raw: string): string => {
  const value = neutralised(raw)
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// Semicolon and BOM because the destination is Excel in Portuguese.
export const toCsv = (rows: string[][]): string => `\uFEFF${rows.map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`

export function csvFileName(today: Date): string {
  const { year, month, day } = brasiliaDateParts(today)
  return `respostas-simples-${year}-${month}-${day}.csv`
}
