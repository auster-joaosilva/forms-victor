import type { HomeEventCard } from '@/server/events/domain/home'

export interface HomeBootstrap {
  events: HomeEventCard
  adhesionWindow: 'open' | 'closed'
  publicUrl: string
}
