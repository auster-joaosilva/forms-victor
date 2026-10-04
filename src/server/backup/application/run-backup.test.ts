import { describe, expect, it } from 'vitest'
import { dumpKey, type LegacyFileName } from '../domain/keys'
import { makeRunBackup } from './run-backup'
import { fakeDumper, fixedClock, memoryBackupStore, memoryLegacyFiles, memorySourceFiles } from './testing/fakes'

const NOW = '2026-10-04T06:00:00Z' // domingo, 03:00 em Brasília
const NEW_DUMP = 'postgres/forms_victor-2026-10-04T0300.dump'

// Os dumps dos `days` dias anteriores a NOW, no mesmo horário.
const previousDumps = (days: number): Record<string, string> =>
  Object.fromEntries(
    Array.from({ length: days }, (_, index) => [dumpKey('forms_victor', new Date(Date.parse(NOW) - (index + 1) * 86_400_000)), 'antigo']),
  )

function setup(
  options: {
    dumper?: ReturnType<typeof fakeDumper>
    objects?: Record<string, string>
    sources?: string[]
    legacy?: Partial<Record<LegacyFileName, string>>
  } = {},
) {
  const backup = memoryBackupStore(options.objects)
  const dumper = options.dumper ?? fakeDumper({ content: 'PGDMP-novo' })
  const sources = memorySourceFiles(options.sources ?? [], backup)
  const legacy = memoryLegacyFiles(options.legacy ?? {})
  const runBackup = makeRunBackup({
    dumper: dumper.dumper,
    store: backup.store,
    sourceFiles: sources.sourceFiles,
    legacyFiles: legacy.legacyFiles,
    clock: fixedClock(NOW),
    database: 'forms_victor',
  })
  return { backup, sources, legacy, runBackup }
}

describe('runBackup', () => {
  it('writes the dump, copies the files and returns the summary', async () => {
    const { runBackup, backup } = setup({ sources: ['event_cover/a.png', 'house_photo/b.jpg'] })
    expect(await runBackup({ legacy: false })).toEqual({ dumpKey: NEW_DUMP, bytes: 10, filesCopied: 2, legacyFiles: [], dumpsDeleted: [] })
    expect(backup.objects.get(NEW_DUMP)?.toString()).toBe('PGDMP-novo')
    expect([...backup.objects.keys()].sort()).toEqual(['files/event_cover/a.png', 'files/house_photo/b.jpg', NEW_DUMP])
  })

  it('copies only the files that are not in the backup yet', async () => {
    const { runBackup, sources } = setup({ objects: { 'files/event_cover/a.png': 'a' }, sources: ['event_cover/a.png', 'event_cover/b.png'] })
    expect((await runBackup({ legacy: false })).filesCopied).toBe(1)
    expect(sources.copies).toEqual([['event_cover/b.png', 'files/event_cover/b.png']])
    expect((await runBackup({ legacy: false })).filesCopied).toBe(0)
  })

  it('aborts on a failed dump: no file copied, no old dump deleted, no partial dump left', async () => {
    const old = previousDumps(10)
    const { runBackup, backup, sources } = setup({
      objects: old,
      sources: ['event_cover/a.png'],
      dumper: fakeDumper({ content: 'PGDMP-pela', error: new Error('pg_dump saiu com código 1: conexão recusada') }),
    })
    await expect(runBackup({ legacy: true })).rejects.toThrow('conexão recusada')
    expect([...backup.objects.keys()].sort()).toEqual(Object.keys(old).sort())
    expect(backup.deleted).toEqual([[NEW_DUMP]])
    expect(sources.copies).toEqual([])
  })

  it('applies the retention only to the dumps of this database and never to files or malformed keys', async () => {
    const others = {
      'postgres/forms_victor-lixo.dump': 'x',
      'postgres/forms_victor_restore-2026-09-01T0300.dump': 'x',
      'files/event_cover/a.png': 'a',
    }
    const { runBackup, backup } = setup({ objects: { ...previousDumps(9), ...others } })
    const summary = await runBackup({ legacy: false })
    expect(summary.dumpsDeleted).toEqual(['postgres/forms_victor-2026-09-26T0300.dump', 'postgres/forms_victor-2026-09-25T0300.dump'])
    for (const key of Object.keys(others)) expect(backup.objects.has(key)).toBe(true)
    expect(backup.objects.has('postgres/forms_victor-2026-09-27T0300.dump')).toBe(true)
  })

  it('saves the legacy files that exist, without the -wal', async () => {
    const { runBackup, backup, legacy } = setup({ legacy: { 'portal.db': 'banco', 'portal.db-shm': 'shm' } })
    const summary = await runBackup({ legacy: true })
    expect(summary.legacyFiles).toEqual(['legacy/2026-10-04T0300/portal.db', 'legacy/2026-10-04T0300/portal.db-shm'])
    expect(legacy.opened).toEqual(['portal.db', 'portal.db-wal', 'portal.db-shm'])
    expect(backup.objects.get('legacy/2026-10-04T0300/portal.db')?.toString()).toBe('banco')
  })

  it('does not open the legacy files without --legacy', async () => {
    const { runBackup, legacy } = setup({ legacy: { 'portal.db': 'banco' } })
    expect((await runBackup({ legacy: false })).legacyFiles).toEqual([])
    expect(legacy.opened).toEqual([])
  })
})
