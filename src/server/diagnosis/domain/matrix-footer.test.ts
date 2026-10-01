import { describe, expect, it } from 'vitest'
import { matrixFooter } from './matrix-footer'

describe('matrixFooter', () => {
  it('warns outside 80 to 120 percent', () => {
    expect(matrixFooter({ receitaPorCliente: { pessoa_fisica: 'acima_80', simples_mei: 'ate_20' } }, 'receitaPorCliente'))
      .toEqual({ warning: false, text: 'Soma aproximada: 100%' })
    expect(matrixFooter({ receitaPorCliente: { pessoa_fisica: 'de_20_40' } }, 'receitaPorCliente'))
      .toEqual({ warning: true, text: 'Soma aproximada: 30% — revise, o total deveria ficar perto de 100%.' })
  })

  it('counts "não sei" as a gap, not as zero', () => {
    expect(matrixFooter({ receitaPorCliente: { pessoa_fisica: 'de_20_40', exterior: 'nao_sei' } }, 'receitaPorCliente'))
      .toEqual({ warning: false, text: 'Soma das linhas respondidas: 30% — uma linha ficou em "não sei".' })
    expect(matrixFooter({ receitaPorCliente: { a: 'nao_sei', b: 'nao_sei' } }, 'receitaPorCliente').text)
      .toBe('Soma das linhas respondidas: 0% — 2 linhas ficaram em "não sei".')
  })
})
