import { describe, expect, it } from 'vitest'
import { checkSlug, normalizeSlug, slugFrom } from './slug'

describe('slugFrom (apelidoDe da main)', () => {
  it('tira acento, baixa a caixa e troca o resto por hífen', () => {
    expect(slugFrom('Conexão Tributária', new Set())).toBe('conexao-tributaria')
    expect(slugFrom('  Reforma: IBS & CBS — 2027!  ', new Set())).toBe('reforma-ibs-cbs-2027')
  })

  it('corta em 50 caracteres e cai para "evento" quando não sobra nada', () => {
    expect(slugFrom('a'.repeat(80), new Set())).toBe('a'.repeat(50))
    expect(slugFrom('!!!', new Set())).toBe('evento')
  })

  it('acrescenta -2, -3 quando o endereço já existe', () => {
    expect(slugFrom('Conexão Tributária', new Set(['conexao-tributaria']))).toBe('conexao-tributaria-2')
    expect(slugFrom('Conexão Tributária', new Set(['conexao-tributaria', 'conexao-tributaria-2']))).toBe('conexao-tributaria-3')
  })
})

describe('checkSlug (conferirApelido da main)', () => {
  it('aceita o endereço válido e livre', () => {
    expect(checkSlug('conexao-tributaria', new Set())).toBeNull()
  })

  it('recusa em branco', () => {
    expect(checkSlug('   ', new Set())).toBe('o endereço não pode ficar em branco')
  })

  it('recusa acento, espaço, hífen duplo ou nas pontas', () => {
    const message = 'o endereço aceita só letras sem acento, números e hífen entre palavras'
    for (const raw of ['conexão', 'conexao tributaria', 'conexao--tributaria', '-conexao', 'conexao-', 'conexao_tributaria']) {
      expect(checkSlug(raw, new Set())).toBe(message)
    }
  })

  it('aceita maiúscula, que vira minúscula, como a main', () => {
    expect(checkSlug('Conexao-Tributaria', new Set())).toBeNull()
    expect(normalizeSlug('  Conexao-Tributaria ')).toBe('conexao-tributaria')
  })

  it('exige de 3 a 50 caracteres', () => {
    const message = 'o endereço tem de ter de 3 a 50 caracteres'
    expect(checkSlug('ab', new Set())).toBe(message)
    expect(checkSlug('a'.repeat(51), new Set())).toBe(message)
    expect(checkSlug('a'.repeat(50), new Set())).toBeNull()
  })

  it('recusa endereço de outro evento', () => {
    expect(checkSlug('conexao-tributaria', new Set(['conexao-tributaria']))).toBe('já existe um evento em /eventos/conexao-tributaria')
  })
})
