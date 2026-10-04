import { describe, expect, it } from 'vitest'
import { eventView, fakeClock, memoryEvents } from './testing/fakes'
import { makePublicEvents } from './public-events'

function setup(start = '2026-10-03T15:00:00Z') {
  const draft = eventView({ id: 2, slug: 'rascunho-de-outubro', title: 'Rascunho', status: 'draft' })
  const closed = eventView({ id: 3, slug: 'ja-passou', title: 'Já passou', status: 'closed' })
  const published = eventView({ id: 1 })
  const { repository } = memoryEvents([published, draft, closed])
  const clock = fakeClock(start)
  return { publicEvents: makePublicEvents({ events: repository, clock }), clock }
}

describe('makePublicEvents', () => {
  it('lists only published events', async () => {
    const { publicEvents } = setup()
    expect((await publicEvents.list()).map((event) => event.slug)).toEqual(['conexao-tributaria'])
  })

  it('hides a draft from visitors and shows it to the back office (Review Focus #3)', async () => {
    const { publicEvents } = setup()
    expect(await publicEvents.page('rascunho-de-outubro', { canViewDrafts: false })).toBeNull()
    expect((await publicEvents.page('rascunho-de-outubro', { canViewDrafts: true }))?.title).toBe('Rascunho')
  })

  it('keeps a closed event reachable by its address', async () => {
    const { publicEvents } = setup()
    expect((await publicEvents.page('ja-passou', { canViewDrafts: false }))?.status).toBe('closed')
  })

  it('answers null for an unknown address', async () => {
    const { publicEvents } = setup()
    expect(await publicEvents.page('nao-existe', { canViewDrafts: true })).toBeNull()
  })

  it('builds the home with the next event and the adhesion window by the Brasília day', async () => {
    const { publicEvents, clock } = setup('2026-10-30T23:00:00Z')
    expect(await publicEvents.home()).toEqual({
      events: { kind: 'event', title: 'Conexão Tributária', slug: 'conexao-tributaria', date: '2026-10-20', openCount: 1 },
      adhesionWindow: 'open',
    })
    clock.set('2026-10-31T03:00:00Z')
    expect((await publicEvents.home()).adhesionWindow).toBe('closed')
  })
})
