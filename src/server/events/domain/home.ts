import type { EventSummary } from './event'

export type HomeEventCard =
  | { kind: 'none' }
  | { kind: 'event'; title: string; slug: string; date: string | null; openCount: number }

// A main mostrava o evento de data MAIS DISTANTE (lista[0] em ordem decrescente). Aqui é o próximo; sem próximo, o mais recente (spec V2b).
// openCount é o tamanho da lista publicada, que a main usava em "Há N encontros abertos.".
export function homeEventCard(published: EventSummary[], today: string): HomeEventCard {
  const listed = published.filter((event) => event.status === 'published')
  const dated = listed.filter((event) => event.firstDate !== null)
  const upcoming = dated.filter((event) => (event.firstDate ?? '') >= today)
    .sort((a, b) => (a.firstDate ?? '').localeCompare(b.firstDate ?? '') || a.id - b.id)
  const latest = [...dated].sort((a, b) => (b.firstDate ?? '').localeCompare(a.firstDate ?? '') || b.id - a.id)
  const chosen = upcoming[0] ?? latest[0] ?? listed[0]
  if (!chosen) return { kind: 'none' }
  return { kind: 'event', title: chosen.title, slug: chosen.slug, date: chosen.firstDate, openCount: listed.length }
}
