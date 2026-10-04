import { getEnv } from '@/server/shared/env'
import { createS3Client, ensureS3Bucket } from '@/server/shared/s3'
import { createLegacyFiles } from './adapters/legacy-files'
import { createPgDumper } from './adapters/pg-dump'
import { createS3BackupStore } from './adapters/s3-backup-store'
import { createS3SourceFiles } from './adapters/s3-source-files'
import { systemClock } from './adapters/system-clock'
import { makeRestoreBackup, type RestoreResult } from './application/restore-backup'
import { makeRunBackup, type BackupSummary } from './application/run-backup'
import { databaseNameOf } from './domain/database-url'

const env = getEnv()
const client = createS3Client({ endpoint: env.S3_ENDPOINT, useSsl: env.S3_USE_SSL, accessKey: env.S3_ACCESS_KEY, secretKey: env.S3_SECRET_KEY })
const store = createS3BackupStore({ client, bucket: env.BACKUP_BUCKET })
const dumper = createPgDumper({ databaseUrl: env.DATABASE_URL })

const run = makeRunBackup({
  dumper,
  store,
  sourceFiles: createS3SourceFiles({ client, sourceBucket: env.S3_BUCKET, backupBucket: env.BACKUP_BUCKET }),
  legacyFiles: createLegacyFiles(env.LEGACY_DB_PATH),
  clock: systemClock,
  database: databaseNameOf(env.DATABASE_URL),
})
const restore = makeRestoreBackup({ dumper, store })

export async function runBackup(input: { legacy: boolean }): Promise<BackupSummary> {
  await ensureS3Bucket(client, env.BACKUP_BUCKET)
  return run(input)
}

export const restoreBackup = (input: { key: string; targetUrl: string; overwrite: boolean }): Promise<RestoreResult> =>
  restore({ ...input, appUrl: env.DATABASE_URL })

export type { BackupSummary } from './application/run-backup'
export type { RestoreResult } from './application/restore-backup'
