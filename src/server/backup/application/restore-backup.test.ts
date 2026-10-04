import { describe, expect, it } from 'vitest'
import { makeRestoreBackup } from './restore-backup'
import { fakeDumper, memoryBackupStore } from './testing/fakes'

const APP = 'postgresql://app:secret@postgres:5432/forms_victor'
const KEY = 'postgres/forms_victor-2026-10-04T0300.dump'

function setup() {
  const backup = memoryBackupStore({ [KEY]: 'PGDMP-dump' })
  const dumper = fakeDumper()
  const restoreBackup = makeRestoreBackup({ dumper: dumper.dumper, store: backup.store })
  return { dumper, restoreBackup }
}

describe('restoreBackup', () => {
  it('refuses the app database, even with other credentials and without the port', async () => {
    const { restoreBackup, dumper } = setup()
    const targetUrl = 'postgresql://outro:x@postgres/forms_victor?sslmode=disable'
    expect(await restoreBackup({ key: KEY, targetUrl, appUrl: APP, overwrite: false })).toEqual({ ok: false, reason: 'app-database' })
    expect(dumper.restores).toEqual([])
  })

  it('restores over the app database only with overwrite', async () => {
    const { restoreBackup, dumper } = setup()
    expect(await restoreBackup({ key: KEY, targetUrl: APP, appUrl: APP, overwrite: true })).toEqual({ ok: true })
    expect(dumper.restores).toEqual([{ targetUrl: APP, body: 'PGDMP-dump' }])
  })

  it('streams the dump into another database of the same server', async () => {
    const { restoreBackup, dumper } = setup()
    const targetUrl = 'postgresql://app:secret@postgres:5432/forms_victor_restore'
    expect(await restoreBackup({ key: KEY, targetUrl, appUrl: APP, overwrite: false })).toEqual({ ok: true })
    expect(dumper.restores).toEqual([{ targetUrl, body: 'PGDMP-dump' }])
  })

  it('refuses a key out of format and reports a missing dump', async () => {
    const { restoreBackup, dumper } = setup()
    const targetUrl = 'postgresql://app:secret@postgres:5432/forms_victor_restore'
    expect(await restoreBackup({ key: 'files/x.png', targetUrl, appUrl: APP, overwrite: false })).toEqual({ ok: false, reason: 'invalid-key' })
    expect(await restoreBackup({ key: 'postgres/forms_victor-2026-10-03T0300.dump', targetUrl, appUrl: APP, overwrite: false }))
      .toEqual({ ok: false, reason: 'missing-dump' })
    expect(dumper.restores).toEqual([])
  })
})
