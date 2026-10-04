import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { readAll } from '../application/testing/fakes'
import { createLegacyFiles } from './legacy-files'

const directory = mkdtempSync(join(tmpdir(), 'legacy-files-'))
writeFileSync(join(directory, 'portal.db'), 'banco')
writeFileSync(join(directory, 'portal.db-shm'), 'shm')
afterAll(() => rmSync(directory, { recursive: true, force: true }))

describe('createLegacyFiles', () => {
  const files = createLegacyFiles(join(directory, 'portal.db'))

  it('opens the files next to LEGACY_DB_PATH as streams', async () => {
    const db = await files.open('portal.db')
    if (!db) throw new Error('o portal.db não abriu')
    expect((await readAll(db)).toString()).toBe('banco')
  })

  it('returns null for a file that is not there', async () => {
    expect(await files.open('portal.db-wal')).toBeNull()
  })
})
