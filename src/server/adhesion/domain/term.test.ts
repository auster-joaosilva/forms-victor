import { describe, expect, it } from 'vitest'
import { CURRENT_TERM, TERM_V4, computeTermHash } from './term'

const TERM_V4_HASH = '94667b1747b65c3e177416ee98e63a79b10599c1a5240b3a0836c094c0788441'

describe('term V4', () => {
  it('hashes to the value stored with every existing adhesion', async () => {
    expect(await computeTermHash(TERM_V4)).toBe(TERM_V4_HASH)
  })

  it('is the current version', () => {
    expect(CURRENT_TERM.versao).toBe('V4')
  })
})
