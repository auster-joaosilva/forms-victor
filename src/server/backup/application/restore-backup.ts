import { isSameDatabase } from '../domain/database-url'
import { parseDumpKey } from '../domain/keys'
import type { BackupStore } from '../ports/backup-store'
import type { DatabaseDumper } from '../ports/database-dumper'

export interface RestoreInput {
  key: string
  targetUrl: string
  appUrl: string
  overwrite: boolean
}

export type RestoreResult = { ok: true } | { ok: false; reason: 'app-database' | 'invalid-key' | 'missing-dump' }

export const makeRestoreBackup =
  ({ dumper, store }: { dumper: DatabaseDumper; store: BackupStore }) =>
  async ({ key, targetUrl, appUrl, overwrite }: RestoreInput): Promise<RestoreResult> => {
    if (!overwrite && isSameDatabase(targetUrl, appUrl)) return { ok: false, reason: 'app-database' }
    if (!parseDumpKey(key)) return { ok: false, reason: 'invalid-key' }
    const stream = await store.get(key)
    if (!stream) return { ok: false, reason: 'missing-dump' }
    await dumper.restore(stream, targetUrl)
    return { ok: true }
  }
