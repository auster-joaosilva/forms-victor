import { FILES_PREFIX, LEGACY_FILE_NAMES, dumpKey, dumpPrefix, fileKey, legacyKey, parseDumpKey } from '../domain/keys'
import { dumpsToDelete, type DumpEntry } from '../domain/retention'
import type { BackupStore } from '../ports/backup-store'
import type { Clock } from '../ports/clock'
import type { DatabaseDumper } from '../ports/database-dumper'
import type { LegacyFiles } from '../ports/legacy-files'
import type { SourceFiles } from '../ports/source-files'

export interface BackupSummary {
  dumpKey: string
  bytes: number
  filesCopied: number
  legacyFiles: string[]
  dumpsDeleted: string[]
}

interface Dependencies {
  dumper: DatabaseDumper
  store: BackupStore
  sourceFiles: SourceFiles
  legacyFiles: LegacyFiles
  clock: Clock
  database: string
}

async function writeDump(
  { dumper, store, database }: Dependencies,
  takenAt: Date,
): Promise<{ key: string; bytes: number }> {
  const key = dumpKey(database, takenAt)
  // Uma falha no mesmo minuto apagaria, no catch abaixo, o dump bom que já está com esta chave.
  if ((await store.list(key)).includes(key)) throw new Error(`já existe um dump com a chave ${key}`)
  const dump = dumper.dump()
  // Sem o destroy, um upload que falha deixa o pg_dump preso escrevendo num pipe cheio, e o done nunca chega.
  const upload = store.put(key, dump.stream).catch((error: unknown) => {
    dump.stream.destroy()
    throw error
  })
  const [uploaded, finished] = await Promise.allSettled([upload, dump.done])
  if (uploaded.status === 'fulfilled' && finished.status === 'fulfilled') return { key, bytes: uploaded.value.bytes }
  // Um pg_dump que morre no meio fecha o stream, e o upload termina com um dump pela metade: ele não fica no bucket.
  const reason: unknown = finished.status === 'rejected' ? finished.reason : (uploaded as PromiseRejectedResult).reason
  const deleted = await store.delete([key]).then(
    () => true,
    () => false,
  )
  if (deleted) throw reason
  const message = reason instanceof Error ? reason.message : String(reason)
  throw new Error(`${message} (dump parcial não apagado: ${key})`, { cause: reason })
}

async function copyNewFiles({ store, sourceFiles }: Dependencies): Promise<number> {
  const copied = new Set(await store.list(FILES_PREFIX))
  const missing = (await sourceFiles.list()).filter((key) => !copied.has(fileKey(key)))
  for (const key of missing) await sourceFiles.copyTo(key, fileKey(key))
  return missing.length
}

async function saveLegacyFiles({ store, legacyFiles }: Dependencies, takenAt: Date): Promise<string[]> {
  const saved: string[] = []
  for (const name of LEGACY_FILE_NAMES) {
    const stream = await legacyFiles.open(name)
    if (!stream) continue
    const key = legacyKey(takenAt, name)
    await store.put(key, stream)
    saved.push(key)
  }
  return saved
}

async function applyRetention({ store, database }: Dependencies, now: Date): Promise<string[]> {
  const dumps = (await store.list(dumpPrefix(database))).flatMap((key): DumpEntry[] => {
    const parsed = parseDumpKey(key)
    return parsed && parsed.database === database ? [{ key, takenAt: parsed.takenAt }] : []
  })
  const doomed = dumpsToDelete(dumps, now)
  if (doomed.length) await store.delete(doomed)
  return doomed
}

export const makeRunBackup =
  (deps: Dependencies) =>
  async ({ legacy }: { legacy: boolean }): Promise<BackupSummary> => {
    const takenAt = deps.clock.now()
    const dump = await writeDump(deps, takenAt)
    const filesCopied = await copyNewFiles(deps)
    const legacyFiles = legacy ? await saveLegacyFiles(deps, takenAt) : []
    const dumpsDeleted = await applyRetention(deps, takenAt)
    return { dumpKey: dump.key, bytes: dump.bytes, filesCopied, legacyFiles, dumpsDeleted }
  }
