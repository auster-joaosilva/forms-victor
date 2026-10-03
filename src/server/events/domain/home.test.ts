import { describe, expect, it } from 'vitest'
import type { EventSummary } from './event'
import { homeEventCard } from './home'

const summary = (id: number, firstDate: string | null, overrides: Partial<EventSummary> = {}): EventSummary => ({
  id, slug: `evento-${id}`, title: `Evento ${id}`, status: 'published', registrations: 'open',
  firstDate, sessionCount: 1, registered: 0, chamada: null, ...overrides,
})

describe('homeEventCard (correção V2b)', () => {
  it('sem evento publicado', () => {
    expect(homeEventCard([], '2026-10-03')).toEqual({ kind: 'none' })
  })

  it('mostra o próximo evento, não o de data mais distante', () => {
    const published = [summary(3, '2026-12-01'), summary(2, '2026-10-21'), summary(1, '2026-09-10')]
    expect(homeEventCard(published, '2026-10-03')).toEqual({
      kind: 'event', title: 'Evento 2', slug: 'evento-2', date: '2026-10-21', openCount: 3,
    })
  })

  it('o evento de hoje ainda é o próximo', () => {
    expect(homeEventCard([summary(4, '2026-10-03'), summary(5, '2026-10-30')], '2026-10-03'))
      .toMatchObject({ kind: 'event', slug: 'evento-4' })
  })

  it('sem evento futuro, mostra o mais recente, como a main', () => {
    expect(homeEventCard([summary(1, '2026-09-10'), summary(2, '2026-09-25')], '2026-10-03'))
      .toMatchObject({ kind: 'event', slug: 'evento-2', date: '2026-09-25' })
  })

  it('evento sem data fica atrás dos datados', () => {
    expect(homeEventCard([summary(1, null), summary(2, '2026-09-25')], '2026-10-03'))
      .toMatchObject({ kind: 'event', slug: 'evento-2' })
    expect(homeEventCard([summary(1, null)], '2026-10-03')).toMatchObject({ kind: 'event', slug: 'evento-1', date: null })
  })

  it('ignora o que não está publicado', () => {
    expect(homeEventCard([summary(1, '2026-10-21', { status: 'draft' })], '2026-10-03')).toEqual({ kind: 'none' })
  })
})
