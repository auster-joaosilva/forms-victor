import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { publicBaseUrl, publicEvents } from '@/server/events/composition'
import { brasiliaDateParts } from '@/server/shared/domain/dates'
import { getSessionUser } from '@/server/shared/http/session'
import type { EventPageBootstrap, EventsListBootstrap } from '../types/events'
import { loadEventPageInput } from './schemas'

// O hoje da contagem regressiva é o dia de Brasília no servidor, não o relógio de quem visita.
function todayInBrasilia(): string {
  const { year, month, day } = brasiliaDateParts(new Date())
  return `${year}-${month}-${day}`
}

export const loadEventsList = createServerFn({ method: 'GET' }).handler(
  async (): Promise<EventsListBootstrap> => ({ events: await publicEvents.list(), today: todayInBrasilia(), publicUrl: publicBaseUrl }),
)

// Rascunho só abre para quem tem sessão no backoffice com view_events; para os outros é 404.
export const loadEventPage = createServerFn({ method: 'GET' })
  .inputValidator(loadEventPageInput)
  .handler(async ({ data }): Promise<EventPageBootstrap | null> => {
    const user = await getSessionUser(getRequest().headers)
    const event = await publicEvents.page(data.slug, { canViewDrafts: user?.capabilities.includes('view_events') ?? false })
    return event ? { event, today: todayInBrasilia(), publicUrl: publicBaseUrl } : null
  })
