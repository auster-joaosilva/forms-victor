import { hasImageSignature } from '@/server/shared/domain/image-signature'
import { cnpjDigitsOf, isDate, lookup, parseJson } from './mapping'
import type { LegacyAgendaEvent, LegacyAgendaSession, LegacyRegistration } from './legacy-rows'

export const EVENT_STATUS_MAP: Record<string, 'draft' | 'published' | 'closed'> = { rascunho: 'draft', publicado: 'published', encerrado: 'closed' }
export const REGISTRATION_WINDOW_MAP: Record<string, 'open' | 'closed'> = { abertas: 'open', encerradas: 'closed' }
export const SESSION_FORMAT_MAP: Record<string, 'in_person' | 'online'> = { presencial: 'in_person', online: 'online' }
export const REGISTRATION_STATUS_MAP: Record<string, 'registered' | 'confirmed' | 'present' | 'absent' | 'cancelled'> = {
  inscrita: 'registered', confirmada: 'confirmed', presente: 'present', ausente: 'absent', cancelada: 'cancelled',
}

type ImageKind = 'event_cover' | 'speaker_photo'
export interface LegacyImage { key: string; kind: ImageKind; contentType: 'image/jpeg' | 'image/png' | 'image/webp'; bytes: Uint8Array }
export type ImageRef = { kind: 'upload'; image: LegacyImage } | { kind: 'house'; name: string } | { kind: 'none' } | { kind: 'invalid'; reason: string }

// O mesmo teto do módulo de arquivos: acima disso o storeFile recusaria, e a recusa tem de aparecer já na simulação.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/
// O mesmo molde da rota /imagens do portal antigo: sem ponto nem barra, nada de ../
const HOUSE_PATH = /^\/imagens\/([a-z0-9_-]+\.(?:jpg|png|svg|webp))$/

const isImageType = (value: string): value is LegacyImage['contentType'] => value === 'image/jpeg' || value === 'image/png' || value === 'image/webp'

// O atob lança com base64 de tamanho inválido; uma imagem estragada no portal antigo não pode derrubar a simulação.
function decodeBase64(text: string): string | null {
  try {
    return atob(text)
  } catch {
    return null
  }
}

export function imageRefOf(value: unknown, key: string, kind: ImageKind): ImageRef {
  if (value === undefined || value === null || value === '') return { kind: 'none' }
  if (typeof value !== 'string') return { kind: 'invalid', reason: 'imagem em formato desconhecido' }
  const house = HOUSE_PATH.exec(value)
  if (house?.[1]) return { kind: 'house', name: house[1] }
  const data = DATA_URL.exec(value)
  if (!data?.[1] || !data[2] || !isImageType(data[1])) return { kind: 'invalid', reason: 'imagem em formato desconhecido' }
  const binary = decodeBase64(data[2])
  if (binary === null) return { kind: 'invalid', reason: 'imagem em formato desconhecido' }
  if (binary.length > MAX_IMAGE_BYTES) return { kind: 'invalid', reason: 'imagem acima de 5 MiB' }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  if (!hasImageSignature(data[1], bytes)) return { kind: 'invalid', reason: 'imagem em formato desconhecido' }
  return { kind: 'upload', image: { key, kind, contentType: data[1], bytes } }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {})
const textOf = (value: unknown) => (typeof value === 'string' ? value : undefined)
const textList = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined)

export function legacyImagesOf(row: LegacyAgendaEvent): { cover: ImageRef; photo: ImageRef } {
  const content = record(parseJson(row.conteudo))
  return {
    cover: imageRefOf(content.capa, `legacy-agenda-${row.id}-capa`, 'event_cover'),
    photo: imageRefOf(record(content.palestrante).foto, `legacy-agenda-${row.id}-palestrante`, 'speaker_photo'),
  }
}

// Só as chaves que a página nova conhece; as imagens viram referência ao arquivo, nunca base64.
export function legacyContent(conteudo: string, files: { cover: string | null; photo: string | null }): Record<string, unknown> {
  const content = record(parseJson(conteudo))
  const out: Record<string, unknown> = {}
  for (const key of ['chamada', 'local', 'intro', 'aposEncerrar', 'tema', 'rotulo'] as const) {
    const value = textOf(content[key])
    if (value !== undefined) out[key] = value
  }
  for (const key of ['temas', 'avisos'] as const) {
    const value = textList(content[key])
    if (value) out[key] = value
  }
  if (Array.isArray(content.destaques)) {
    out.destaques = content.destaques.map(record).map((item) => ({ titulo: textOf(item.titulo) ?? '', texto: textOf(item.texto) ?? '' })).filter((item) => item.titulo)
  }
  out.capa = files.cover ? { fileId: files.cover } : null
  if (content.palestrante !== undefined) {
    const speaker = record(content.palestrante)
    out.palestrante = {
      ...(textOf(speaker.nome) !== undefined ? { nome: textOf(speaker.nome) } : {}),
      ...(textOf(speaker.cargo) !== undefined ? { cargo: textOf(speaker.cargo) } : {}),
      ...(textOf(speaker.bio) !== undefined ? { bio: textOf(speaker.bio) } : {}),
      foto: files.photo ? { fileId: files.photo } : null,
    }
  }
  return out
}

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && isDate(`${value}T00:00:00.000Z`)

export function eventConflicts(row: LegacyAgendaEvent): string[] {
  const conflicts: string[] = []
  if (!lookup(EVENT_STATUS_MAP, row.situacao)) conflicts.push(`situação ${row.situacao} sem equivalente`)
  if (!lookup(REGISTRATION_WINDOW_MAP, row.inscricoes)) conflicts.push(`inscrições ${row.inscricoes} sem equivalente`)
  if (!isDate(row.criado_em)) conflicts.push(`criado em ${row.criado_em} não é uma data`)
  if (row.alterado_em && !isDate(row.alterado_em)) conflicts.push(`alterado em ${row.alterado_em} não é uma data`)
  return conflicts
}

export function sessionConflicts(row: LegacyAgendaSession): string[] {
  const conflicts: string[] = []
  if (!lookup(SESSION_FORMAT_MAP, row.formato)) conflicts.push(`formato ${row.formato} sem equivalente`)
  if (!isDay(row.data)) conflicts.push(`data ${row.data} não é uma data`)
  return conflicts
}

export function registrationConflicts(row: LegacyRegistration): string[] {
  const conflicts: string[] = []
  if (!lookup(REGISTRATION_STATUS_MAP, row.situacao)) conflicts.push(`situação ${row.situacao} sem equivalente`)
  if (!isDate(row.criado_em)) conflicts.push(`inscrita em ${row.criado_em} não é uma data`)
  if (row.tratado_em && !isDate(row.tratado_em)) conflicts.push(`tratada em ${row.tratado_em} não é uma data`)
  return conflicts
}

// O índice parcial do banco novo recusaria a segunda linha; melhor recusar a importação inteira antes de gravar.
export function activeDuplicates(rows: LegacyRegistration[]): string[] {
  const seen = new Map<string, number>()
  const found: string[] = []
  for (const row of [...rows].sort((a, b) => a.id - b.id)) {
    if (row.situacao === 'cancelada') continue
    const email = row.email.trim().toLowerCase()
    const key = `${row.sessao_id}|${email}`
    const first = seen.get(key)
    if (first === undefined) seen.set(key, row.id)
    else found.push(`inscrições ${first} e ${row.id}: o mesmo e-mail ${email} duas vezes no encontro ${row.sessao_id}`)
  }
  return found
}

export interface ImportedEvent {
  id: number
  slug: string
  title: string
  status: 'draft' | 'published' | 'closed'
  registrations: 'open' | 'closed'
  content: Record<string, unknown>
  createdAt: Date
  createdById: string | null
  updatedAt: Date | null
  updatedById: string | null
}

export interface ImportedSession {
  id: number
  eventId: number
  order: number
  date: Date
  time: string
  format: 'in_person' | 'online'
  title: string
  description: string | null
  location: string | null
  seats: number | null
}

export interface ImportedRegistration {
  id: number
  protocol: string
  eventId: number
  sessionId: number
  responseId: number | null
  createdAt: Date
  name: string
  email: string
  phone: string | null
  company: string | null
  cnpj: string | null
  cnpjDigits: string | null
  jobTitle: string | null
  privacyConsent: boolean
  originIp: string | null
  userAgent: string | null
  payload: unknown
  status: 'registered' | 'confirmed' | 'present' | 'absent' | 'cancelled'
  internalNote: string | null
  handledById: string | null
  handledAt: Date | null
}

const userOf = (userIds: Map<string, string>, name: string | null) => (name ? (userIds.get(name) ?? null) : null)

export function mapEvent(row: LegacyAgendaEvent, context: { content: Record<string, unknown>; userIds: Map<string, string> }): ImportedEvent | null {
  const status = lookup(EVENT_STATUS_MAP, row.situacao)
  const registrations = lookup(REGISTRATION_WINDOW_MAP, row.inscricoes)
  if (!status || !registrations || eventConflicts(row).length) return null
  return {
    id: row.id,
    slug: row.apelido,
    title: row.titulo,
    status,
    registrations,
    content: context.content,
    createdAt: new Date(row.criado_em),
    createdById: userOf(context.userIds, row.criado_por),
    updatedAt: row.alterado_em ? new Date(row.alterado_em) : null,
    updatedById: userOf(context.userIds, row.alterado_por),
  }
}

export function mapSession(row: LegacyAgendaSession): ImportedSession | null {
  const format = lookup(SESSION_FORMAT_MAP, row.formato)
  if (!format || sessionConflicts(row).length) return null
  return {
    id: row.id,
    eventId: row.evento_id,
    order: row.ordem,
    date: new Date(`${row.data}T00:00:00.000Z`),
    time: row.hora,
    format,
    title: row.titulo,
    description: row.descricao,
    location: row.local,
    seats: row.vagas !== null && Number.isInteger(row.vagas) && row.vagas > 0 ? row.vagas : null,
  }
}

export function mapRegistration(
  row: LegacyRegistration,
  context: { protocol: string; responseIds: Set<number>; userIds: Map<string, string> },
): ImportedRegistration | null {
  const status = lookup(REGISTRATION_STATUS_MAP, row.situacao)
  if (!status || registrationConflicts(row).length) return null
  return {
    id: row.id,
    protocol: context.protocol,
    eventId: row.evento_id,
    sessionId: row.sessao_id,
    responseId: row.resposta_id !== null && context.responseIds.has(row.resposta_id) ? row.resposta_id : null,
    createdAt: new Date(row.criado_em),
    name: row.nome,
    email: row.email,
    phone: row.telefone || null,
    company: row.empresa || null,
    cnpj: row.cnpj || null,
    cnpjDigits: cnpjDigitsOf(row.cnpj),
    jobTitle: row.cargo || null,
    privacyConsent: row.aceite_lgpd === 1,
    originIp: row.origem,
    userAgent: row.agente,
    payload: parseJson(row.pacote) ?? {},
    status,
    internalNote: row.nota_interna,
    handledById: userOf(context.userIds, row.tratado_por),
    handledAt: row.tratado_em ? new Date(row.tratado_em) : null,
  }
}
