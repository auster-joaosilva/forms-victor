import { describe, expect, it } from 'vitest'
import { USERNAME_RULE } from '@/server/shared/auth/auth'
import { planEmailFill } from './fill-user-emails'

describe('planEmailFill', () => {
  it('derives the pattern email and flags what does not follow it', () => {
    const plan = planEmailFill(['sara.vinhais', 'victor.medeiros', 'admin', 'e2e-operator'], { 'victor.medeiros': 'victor@austercontabil.com.br' })
    expect(plan.derivable).toEqual([
      { username: 'sara.vinhais', email: 'sara.vinhais@austercontabil.com.br' },
      { username: 'victor.medeiros', email: 'victor@austercontabil.com.br' },
    ])
    expect(plan.notDerivable).toEqual(['admin', 'e2e-operator'])
  })

  it('flags a collision between two derived emails', () => {
    // Nota: duas usernames derivam o e-mail pela própria username inteira (ver teste acima), então só colidem
    // de fato quando o override de ambas aponta para o mesmo endereço (ex.: erro de digitação do operador).
    const plan = planEmailFill(['ana.lima', 'ana.costa'], {
      'ana.lima': 'ana@austercontabil.com.br',
      'ana.costa': 'ana@austercontabil.com.br',
    })
    expect(plan.collisions).toEqual(['ana@austercontabil.com.br'])
  })
})

it('USERNAME_RULE accepts every plain dotted username', () => {
  expect(USERNAME_RULE.test('sara.vinhais')).toBe(true)
})
