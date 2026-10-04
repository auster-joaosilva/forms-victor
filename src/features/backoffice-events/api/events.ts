import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eventBackoffice } from '@/server/events/composition'
import { EVENT_STATUSES, REGISTRATION_WINDOWS, SESSION_FORMATS, THEMES } from '@/server/events/domain/event'
import { requireCapability } from '@/server/shared/http/session-middleware'

export type { EventDetail, GalleryItem, RegistrationCounts, RegistrationRow } from '@/server/events/composition'
export type { EventSummary, EventView } from '@/server/events/domain/event'

const actorOf = (user: { id: string; username: string }) => ({ id: user.id, username: user.username })
const text = (max: number) => z.string().max(max)
const idInput = z.object({ id: z.number().int().positive() })
const fileRef = z.object({ fileId: z.string().uuid() }).nullable()

export const contentInput = z.object({
  chamada: text(2000).optional(),
  local: text(300).optional(),
  intro: text(4000).optional(),
  destaques: z.array(z.object({ titulo: text(200), texto: text(1000) })).max(20).optional(),
  temas: z.array(text(300)).max(40).optional(),
  avisos: z.array(text(500)).max(40).optional(),
  aposEncerrar: text(1000).optional(),
  tema: z.enum(THEMES).optional(),
  rotulo: text(200).optional(),
  capa: fileRef.optional(),
  palestrante: z.object({ nome: text(200).optional(), cargo: text(200).optional(), bio: text(4000).optional(), foto: fileRef.optional() }).optional(),
})

export const sessionInput = z.object({
  id: z.number().int().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: text(20).min(1),
  format: z.enum(SESSION_FORMATS),
  title: text(200),
  description: text(2000).nullable(),
  location: text(300).nullable(),
  seats: z.number().int().positive().max(100_000).nullable(),
})

export const listEventsFn = createServerFn({ method: 'GET' })
  .middleware([requireCapability('view_events')])
  .handler(() => eventBackoffice.list())

export const getEventFn = createServerFn({ method: 'GET' })
  .middleware([requireCapability('view_events')])
  .inputValidator(idInput)
  .handler(({ data }) => eventBackoffice.get(data.id))

export const createEventFn = createServerFn({ method: 'POST' })
  .middleware([requireCapability('manage_events')])
  .inputValidator(z.object({ title: text(200) }))
  .handler(({ data, context }) => eventBackoffice.create(actorOf(context.session.user), data))

export const updateEventFn = createServerFn({ method: 'POST' })
  .middleware([requireCapability('manage_events')])
  .inputValidator(
    idInput.extend({
      title: text(200).optional(),
      slug: text(60).optional(),
      content: contentInput.optional(),
      status: z.enum(EVENT_STATUSES).optional(),
      registrations: z.enum(REGISTRATION_WINDOWS).optional(),
      sessions: z.array(sessionInput).max(50).optional(),
    }),
  )
  .handler(({ data, context }) => eventBackoffice.update(actorOf(context.session.user), data))

export const eventGalleryFn = createServerFn({ method: 'GET' })
  .middleware([requireCapability('manage_events')])
  .handler(() => eventBackoffice.gallery())

export const handleRegistrationFn = createServerFn({ method: 'POST' })
  .middleware([requireCapability('handle_registrations')])
  .inputValidator(idInput.extend({ status: z.string().max(20) }))
  .handler(({ data, context }) => eventBackoffice.handleRegistration(actorOf(context.session.user), data))
