import { describe, expect, it } from 'vitest'
import { sampleEvent } from '../testing/fixtures'
import { eventMeta, listMeta } from './event-meta'

const BASE = 'https://reforma-tributaria.austercontabil.com.br'

describe('event meta', () => {
  it('gives the event page the preview tags the old server wrote', () => {
    const meta = eventMeta(sampleEvent(), BASE)
    expect(meta).toContainEqual({ title: 'Conexão Tributária — Auster Inteligência Contábil' })
    expect(meta).toContainEqual({ name: 'description', content: 'O que muda no Simples, explicado em duas horas.' })
    expect(meta).toContainEqual({ property: 'og:title', content: 'Conexão Tributária — Auster Inteligência Contábil' })
    expect(meta).toContainEqual({ property: 'og:url', content: `${BASE}/events/conexao-tributaria` })
    expect(meta).toContainEqual({ name: 'twitter:card', content: 'summary' })
  })

  it('leaves robots to the global X-Robots-Tag header', () => {
    expect(eventMeta(sampleEvent(), BASE).some((tag) => 'name' in tag && tag.name === 'robots')).toBe(false)
  })

  it('falls back to "Inscrição gratuita." without a call', () => {
    const meta = eventMeta(sampleEvent({ content: {} }), BASE)
    expect(meta).toContainEqual({ name: 'description', content: 'Inscrição gratuita.' })
  })

  it('describes the list', () => {
    const meta = listMeta(BASE)
    expect(meta).toContainEqual({ title: 'Eventos — Auster Inteligência Contábil' })
    expect(meta).toContainEqual({ name: 'description', content: 'Encontros da Auster sobre a Reforma Tributária. Inscrição gratuita.' })
    expect(meta).toContainEqual({ property: 'og:url', content: `${BASE}/events` })
  })

  it('drops og:url when there is no public address', () => {
    expect(listMeta('').some((tag) => 'property' in tag && tag.property === 'og:url')).toBe(false)
  })
})
