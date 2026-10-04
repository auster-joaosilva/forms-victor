import { toCsv } from '@/server/shared/domain/csv-format'
import { registrationCsvFileName, registrationCsvRows } from '../domain/csv'
import {
  isEventStatus, isRegistrationStatus, isRegistrationWindow, isSessionFormat, parseContent,
  type EventSummary, type EventView,
} from '../domain/event'
import { checkSlug, normalizeSlug, slugFrom } from '../domain/slug'
import type { EventsAuditRecorder } from '../ports/audit-recorder'
import type { Clock } from '../ports/clock'
import type { EventRepository, SessionInput } from '../ports/event-repository'
import type { GalleryItem, ImageKind, ImageStore } from '../ports/image-store'
import type { RegistrationCounts, RegistrationFilter, RegistrationRepository, RegistrationRow } from '../ports/registration-repository'

export const EXPORT_LIMIT = 5000

export type BackofficeActor = { id: string; username: string }
export type Outcome = { ok: true } | { ok: false; error: string }

export interface EventDetail {
  event: EventView
  counts: RegistrationCounts
  registrations: RegistrationRow[]
}

export interface SessionDraft {
  id?: number
  date: string
  time: string
  format: string
  title?: string
  description?: string | null
  location?: string | null
  seats?: number | null
}

export interface EventChanges {
  id: number
  title?: string
  slug?: string
  content?: unknown
  status?: string
  registrations?: string
  sessions?: SessionDraft[]
}

const EVENT_IMAGE_KINDS: readonly string[] = ['event_cover', 'speaker_photo']
const isEventImageKind = (value: string): value is ImageKind => EVENT_IMAGE_KINDS.includes(value)

// As mesmas regras do gravarSessoes da main: formato desconhecido vira presencial, vaga só inteiro positivo.
// A descrição vai junto — no portal antigo o painel a apagava a cada salvamento.
const toSessionInput = (draft: SessionDraft): SessionInput => ({
  ...(draft.id ? { id: draft.id } : {}),
  date: draft.date,
  time: draft.time,
  format: isSessionFormat(draft.format) ? draft.format : 'in_person',
  title: draft.title ?? '',
  description: draft.description || null,
  location: draft.location || null,
  seats: typeof draft.seats === 'number' && Number.isInteger(draft.seats) && draft.seats > 0 ? draft.seats : null,
})

export function makeEventBackoffice({ events, registrations, images, clock, recordAudit }: {
  events: EventRepository
  registrations: RegistrationRepository
  images: ImageStore
  clock: Clock
  recordAudit: EventsAuditRecorder
}) {
  const audited = (actor: BackofficeActor) => ({ actorId: actor.id, actorUsername: actor.username })

  return {
    list(): Promise<EventSummary[]> {
      return events.listSummaries({ onlyPublished: false })
    },

    async get(id: number): Promise<EventDetail | null> {
      const event = await events.findById(id)
      if (!event) return null
      const [counts, rows] = await Promise.all([registrations.counts(id), registrations.listForEvent(id, {})])
      return { event, counts, registrations: rows }
    },

    async create(actor: BackofficeActor, { title }: { title: string }): Promise<{ ok: true; id: number; slug: string } | { ok: false; error: string }> {
      const clean = title.trim()
      if (!clean) return { ok: false, error: 'o evento precisa de um título' }
      const slug = slugFrom(clean, await events.slugs())
      const { id } = await events.create({ title: clean, slug, content: {}, actorId: actor.id })
      await recordAudit({ action: 'event_created', ...audited(actor), reference: slug, detail: { id, titulo: clean } })
      return { ok: true, id, slug }
    },

    async update(actor: BackofficeActor, changes: EventChanges): Promise<Outcome> {
      const current = await events.findById(changes.id)
      if (!current) return { ok: false, error: 'evento não encontrado' }
      const status = changes.status
      if (status !== undefined && !isEventStatus(status)) return { ok: false, error: 'situação inválida' }
      const window = changes.registrations
      if (window !== undefined && !isRegistrationWindow(window)) return { ok: false, error: 'estado de inscrições inválido' }
      let newSlug: string | undefined
      if (changes.slug !== undefined && normalizeSlug(changes.slug) !== current.slug) {
        const wanted = normalizeSlug(changes.slug)
        const others = await events.slugs()
        others.delete(current.slug)
        const refusal = checkSlug(wanted, others)
        if (refusal) return { ok: false, error: refusal }
        newSlug = wanted
      }
      await events.update(
        current.id,
        {
          ...(changes.title?.trim() ? { title: changes.title.trim() } : {}),
          ...(newSlug ? { slug: newSlug } : {}),
          ...(changes.content !== undefined ? { content: parseContent(changes.content) } : {}),
          ...(status ? { status } : {}),
          ...(window ? { registrations: window } : {}),
          ...(changes.sessions ? { sessions: changes.sessions.map(toSessionInput) } : {}),
        },
        actor.id,
      )
      // Trocar o endereço de um evento divulgado quebra os links já enviados: não se impede, mas fica na trilha com o endereço velho.
      if (newSlug) {
        await recordAudit({ action: 'event_slug_changed', ...audited(actor), reference: newSlug, detail: { de: current.slug, para: newSlug, situacao: current.status } })
      }
      await recordAudit({
        action: 'event_updated', ...audited(actor), reference: current.slug,
        detail: { situacao: status ?? current.status, inscricoes: window ?? current.registrations },
      })
      return { ok: true }
    },

    // Não é server function: o corpo passa do limite de 256 KiB; a rota de upload (Tarefa 10) chama este caso de uso.
    async uploadImage(
      actor: BackofficeActor, kind: string, bytes: Uint8Array, contentType: string, originalName: string | null,
    ): Promise<{ ok: true; fileId: string } | { ok: false; error: string }> {
      if (!isEventImageKind(kind)) return { ok: false, error: 'tipo de imagem inválido' }
      const saved = await images.save(kind, bytes, contentType, originalName, actor.id)
      if (!saved.ok) return saved
      await recordAudit({
        action: 'file_stored', ...audited(actor), reference: saved.fileId,
        detail: { kind, contentType, size: bytes.byteLength },
      })
      return saved
    },

    gallery(): Promise<GalleryItem[]> {
      return images.gallery()
    },

    async handleRegistration(actor: BackofficeActor, { id, status }: { id: number; status: string }): Promise<Outcome> {
      if (!isRegistrationStatus(status)) return { ok: false, error: 'situação inválida' }
      const current = await registrations.findById(id)
      if (!current) return { ok: false, error: 'inscrição não encontrada' }
      if ((await registrations.setStatus(id, status, actor.id, clock.now())) === 'duplicate_active') {
        return { ok: false, error: 'já existe uma inscrição ativa deste e-mail neste encontro' }
      }
      await recordAudit({ action: 'registration_handled', ...audited(actor), reference: String(id), detail: { from: current.status, to: status } })
      return { ok: true }
    },

    async exportCsv(actor: BackofficeActor, eventId: number, filter: RegistrationFilter): Promise<{ fileName: string; body: string } | null> {
      if (!(await events.findById(eventId))) return null
      const clean: RegistrationFilter = { ...filter, search: filter.search?.trim() || undefined }
      const rows = await registrations.listForExport(eventId, clean, EXPORT_LIMIT)
      await recordAudit({
        action: 'spreadsheet_exported', ...audited(actor), reference: String(rows.length),
        detail: { kind: 'registrations', count: rows.length, event: eventId },
      })
      return { fileName: registrationCsvFileName(clock.now()), body: toCsv(registrationCsvRows(rows)) }
    },
  }
}
