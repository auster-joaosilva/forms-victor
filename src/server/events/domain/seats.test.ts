import { describe, expect, it } from 'vitest'
import { remainingSeats, sessionBadge } from './seats'

describe('remainingSeats', () => {
  it('sem limite devolve null', () => {
    expect(remainingSeats(null, 12)).toBeNull()
  })

  it('desconta as inscrições e nunca fica negativo', () => {
    expect(remainingSeats(40, 3)).toBe(37)
    expect(remainingSeats(2, 5)).toBe(0)
  })
})

describe('sessionBadge (estadoDaSessao da main)', () => {
  it('não mostra selo sem limite', () => {
    expect(sessionBadge(null)).toBeNull()
  })

  it('segue os textos da main', () => {
    expect(sessionBadge(0)).toBe('Sem vagas')
    expect(sessionBadge(1)).toBe('Última vaga')
    expect(sessionBadge(2)).toBe('Últimas 2 vagas')
    expect(sessionBadge(5)).toBe('Últimas 5 vagas')
    expect(sessionBadge(6)).toBe('6 vagas')
  })
})
