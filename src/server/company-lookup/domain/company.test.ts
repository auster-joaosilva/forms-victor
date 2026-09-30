import { describe, expect, it } from 'vitest'
import * as legacy from '../../../../legacy/src/consulta_cnpj.js'
import { cnaeDivision, isNameInQsa, monthsOfActivityInYear, normalizeCnae } from './company'

describe('company domain parity', () => {
  it.each([6422100, '0600001', 600001, null, 'abc'])('normalizes cnae %s', (value) => {
    expect(normalizeCnae(value)).toBe(legacy.normalizarCnae(value))
    expect(cnaeDivision(value)).toBe(legacy.divisaoCnae(value))
  })
  it('matches names against the partner list the same way', () => {
    const qsa = [{ nome_socio: 'MARIA DA SILVA SOUZA' }, { nome_socio: 'JOÃO PEREIRA' }]
    for (const name of ['Maria Souza', 'maria da silva', 'Joao Pereira', 'Ana', 'Carlos Lima', '']) {
      expect(isNameInQsa(name, qsa.map((p) => ({ name: p.nome_socio })))).toBe(legacy.nomeConstaNoQsa(name, qsa))
    }
  })
  it('counts months of activity', () => {
    expect(monthsOfActivityInYear('2026-03-15', 2026)).toBe(legacy.mesesDeAtividadeNoAno('2026-03-15', 2026))
  })
})
