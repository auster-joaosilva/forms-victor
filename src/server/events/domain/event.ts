import { isoDateToBr } from '../../shared/domain/dates'

export const EVENT_STATUSES = ['draft', 'published', 'closed'] as const
export const REGISTRATION_WINDOWS = ['open', 'closed'] as const
export const SESSION_FORMATS = ['in_person', 'online'] as const
export const REGISTRATION_STATUSES = ['registered', 'confirmed', 'present', 'absent', 'cancelled'] as const

export type EventStatus = (typeof EVENT_STATUSES)[number]
export type RegistrationWindow = (typeof REGISTRATION_WINDOWS)[number]
export type SessionFormat = (typeof SESSION_FORMATS)[number]
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number]

const oneOf = <T extends string>(values: readonly T[]) => (value: unknown): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value)

export const isEventStatus = oneOf(EVENT_STATUSES)
export const isRegistrationWindow = oneOf(REGISTRATION_WINDOWS)
export const isSessionFormat = oneOf(SESSION_FORMATS)
export const isRegistrationStatus = oneOf(REGISTRATION_STATUSES)

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = { draft: 'Rascunho', published: 'Publicado', closed: 'Encerrado' }
export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  registered: 'Inscrita', confirmed: 'Confirmada', present: 'Presente', absent: 'Ausente', cancelled: 'Cancelada',
}
export const SESSION_FORMAT_LABELS: Record<SessionFormat, string> = { in_person: 'Presencial', online: 'Online' }

// A planilha da main imprimia o valor cru da coluna; quem já usa a planilha filtra por essas palavras.
export const REGISTRATION_STATUS_LEGACY: Record<RegistrationStatus, string> = {
  registered: 'inscrita', confirmed: 'confirmada', present: 'presente', absent: 'ausente', cancelled: 'cancelada',
}
export const SESSION_FORMAT_LEGACY: Record<SessionFormat, string> = { in_person: 'presencial', online: 'online' }

export const THEMES = ['marca', 'solido', 'foto', 'aurora', 'onda'] as const
export type Theme = (typeof THEMES)[number]
const isTheme = oneOf(THEMES)

export interface FileRef { fileId: string }

export interface EventContent {
  chamada?: string
  local?: string
  intro?: string
  destaques?: { titulo: string; texto: string }[]
  temas?: string[]
  avisos?: string[]
  aposEncerrar?: string
  tema?: Theme
  rotulo?: string
  capa?: FileRef | null
  palestrante?: { nome?: string; cargo?: string; bio?: string; foto?: FileRef | null }
}

export interface EventSessionView {
  id: number
  order: number
  date: string
  time: string
  format: SessionFormat
  title: string
  description: string | null
  location: string | null
  seats: number | null
  taken: number
}

export interface EventView {
  id: number
  slug: string
  title: string
  status: EventStatus
  registrations: RegistrationWindow
  content: EventContent
  sessions: EventSessionView[]
}

export interface EventSummary {
  id: number
  slug: string
  title: string
  status: EventStatus
  registrations: RegistrationWindow
  firstDate: string | null
  sessionCount: number
  registered: number
  chamada: string | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)
const texts = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined

const fileRef = (value: unknown): FileRef | null =>
  isRecord(value) && typeof value.fileId === 'string' && UUID.test(value.fileId) ? { fileId: value.fileId } : null

// O content vem do banco (Json) e de formulário: tudo o que não tem o tipo esperado fica de fora, e imagem só entra como referência.
export function parseContent(json: unknown): EventContent {
  if (!isRecord(json)) return {}
  const content: EventContent = {}
  for (const key of ['chamada', 'local', 'intro', 'aposEncerrar', 'rotulo'] as const) {
    const value = text(json[key])
    if (value !== undefined) content[key] = value
  }
  if (isTheme(json.tema)) content.tema = json.tema
  if (Array.isArray(json.destaques)) {
    content.destaques = json.destaques.flatMap((item) =>
      isRecord(item) && typeof item.titulo === 'string' && typeof item.texto === 'string' ? [{ titulo: item.titulo, texto: item.texto }] : [])
  }
  const temas = texts(json.temas)
  if (temas) content.temas = temas
  const avisos = texts(json.avisos)
  if (avisos) content.avisos = avisos
  if ('capa' in json) content.capa = fileRef(json.capa)
  if (isRecord(json.palestrante)) {
    const { nome, cargo, bio, foto } = json.palestrante
    content.palestrante = {
      ...(text(nome) !== undefined ? { nome: text(nome) } : {}),
      ...(text(cargo) !== undefined ? { cargo: text(cargo) } : {}),
      ...(text(bio) !== undefined ? { bio: text(bio) } : {}),
      foto: fileRef(foto),
    }
  }
  return content
}

// Vazio vale "marca" na página e no painel (a main pré-selecionava "aurora" no painel; spec V2c). Foto sem capa também cai para marca.
export function themeOf(content: EventContent): Theme {
  const theme = content.tema ?? 'marca'
  return theme === 'foto' && !content.capa ? 'marca' : theme
}

const sessionHead = (session: EventSessionView) =>
  `${SESSION_FORMAT_LABELS[session.format]}${session.title ? `: ${session.title}` : ''}`

export function sessionLabel(session: EventSessionView): string {
  return `${isoDateToBr(session.date)}, ${session.time} — ${sessionHead(session)}`
}

export function sessionOptionLabel(session: EventSessionView, badge: string | null): string {
  return `${isoDateToBr(session.date)} ${session.time} — ${sessionHead(session)}${badge ? ` (${badge.toLowerCase()})` : ''}`
}
