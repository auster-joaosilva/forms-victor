import { describe, expect, it } from 'vitest'
import { makeGetHealth } from './get-health'

describe('getHealth', () => {
  it('is ok when the applied migration is the expected one', async () => {
    const health = await makeGetHealth({ applied: async () => '20261001_init', expected: async () => '20261001_init' })()
    expect(health).toMatchObject({ ok: true, appliedMigration: '20261001_init', expectedMigration: '20261001_init' })
  })
  it('is not ok when they differ or the database is down', async () => {
    expect((await makeGetHealth({ applied: async () => 'a', expected: async () => 'b' })()).ok).toBe(false)
    const down = await makeGetHealth({ applied: async () => { throw new Error('down') }, expected: async () => 'b' })()
    expect(down).toMatchObject({ ok: false, appliedMigration: null })
  })
  it('is not ok instead of throwing when the expected migration cannot be read', async () => {
    const missing = await makeGetHealth({ applied: async () => 'a', expected: async () => { throw new Error('ENOENT') } })()
    expect(missing).toMatchObject({ ok: false, appliedMigration: 'a', expectedMigration: null })
  })
})
