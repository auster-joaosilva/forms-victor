import { describe, expect, it } from 'vitest'
import { CURRENT_TERM, TERMS, TERM_V4, TERM_V5, computeTermHash, termFor } from './term'

// O hash é a prova: as adesões gravadas guardam estes valores. Mudar uma vírgula do texto muda o hash.
const TERM_V4_HASH = '94667b1747b65c3e177416ee98e63a79b10599c1a5240b3a0836c094c0788441'
const TERM_V5_HASH = '27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004'

describe('term versions', () => {
  it('keeps V4 hashing to the value stored with every existing adhesion', async () => {
    expect(await computeTermHash(TERM_V4)).toBe(TERM_V4_HASH)
  })

  it('hashes V5 exactly as the old portal does', async () => {
    expect(await computeTermHash(TERM_V5)).toBe(TERM_V5_HASH)
  })

  it('registers exactly V4 and V5, keyed by the stored version', () => {
    expect(Object.keys(TERMS)).toEqual(['V4', 'V5'])
    expect(TERMS.V4.versao).toBe('V4')
    expect(TERMS.V5.versao).toBe('V5')
  })

  it('offers V5 as the current version', () => {
    expect(CURRENT_TERM).toBe(TERM_V5)
    expect(CURRENT_TERM.versao).toBe('V5')
  })

  it('finds a term by stored version and returns null for an unknown one', () => {
    expect(termFor('V4')).toBe(TERM_V4)
    expect(termFor('V5')).toBe(TERM_V5)
    expect(termFor('V3')).toBeNull()
    expect(termFor('')).toBeNull()
    expect(termFor('toString')).toBeNull()
  })

  it('carries the CGSN 194 deadlines in V5 and leaves V4 with the old ones', () => {
    expect(TERM_V5.prazos.itens[0][1]).toContain('30/10/2026')
    expect(TERM_V5.semManifestacao.enunciado).toContain('10/12/2026')
    expect(TERM_V4.prazos.itens[0][1]).toContain('30/09/2026')
    expect(TERM_V4.semManifestacao.enunciado).toContain('20/11/2026')
  })
})
