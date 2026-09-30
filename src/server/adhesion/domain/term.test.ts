import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { TERMO } from '../../../../legacy/src/termo.js'
import { CURRENT_TERM, TERM_V4, computeTermHash } from './term'

describe('term V4', () => {
  it('is byte-identical to the legacy object', () => {
    expect(JSON.stringify(TERM_V4)).toBe(JSON.stringify(TERMO))
  })

  it('hashes to the same value stored with every existing adhesion', async () => {
    const legacyHash = createHash('sha256').update(JSON.stringify(TERMO), 'utf8').digest('hex')
    expect(await computeTermHash(TERM_V4)).toBe(legacyHash)
  })

  it('is the current version', () => {
    expect(CURRENT_TERM.versao).toBe('V4')
  })
})
