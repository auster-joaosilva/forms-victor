import { brasiliaDateParts } from '@/server/shared/domain/dates'
import { DEADLINES } from '@/server/shared/domain/deadlines'
import type { EventSummary, EventView } from '../domain/event'
import { homeEventCard, type HomeEventCard } from '../domain/home'
import type { Clock } from '../ports/clock'
import type { EventRepository } from '../ports/event-repository'

export interface HomeData {
  events: HomeEventCard
  adhesionWindow: 'open' | 'closed'
}

const brasiliaDay = (now: Date) => {
  const { year, month, day } = brasiliaDateParts(now)
  return `${year}-${month}-${day}`
}

export function makePublicEvents({ events, clock }: { events: Pick<EventRepository, 'listSummaries' | 'findBySlug'>; clock: Clock }) {
  return {
    list(): Promise<EventSummary[]> {
      return events.listSummaries({ onlyPublished: true })
    },

    // Rascunho não é público: só quem tem acesso aos eventos no backoffice confere antes de divulgar. Encerrado continua no ar.
    async page(slug: string, viewer: { canViewDrafts: boolean }): Promise<EventView | null> {
      const event = await events.findBySlug(slug)
      if (!event) return null
      if (event.status === 'draft' && !viewer.canViewDrafts) return null
      return event
    },

    // A janela segue a regra da adesão (adhesion/domain/window.ts), que outro módulo não pode importar: o mesmo corte pelo dia de Brasília.
    async home(): Promise<HomeData> {
      const today = brasiliaDay(clock.now())
      const published = await events.listSummaries({ onlyPublished: true })
      return { events: homeEventCard(published, today), adhesionWindow: today > DEADLINES.windowEnd ? 'closed' : 'open' }
    },
  }
}
