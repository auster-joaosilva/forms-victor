import type { S3Client } from '@aws-sdk/client-s3'
import { describe, expect, it } from 'vitest'
import { createS3BackupStore } from './s3-backup-store'

describe('createS3BackupStore.get', () => {
  it('throws instead of returning null when the object exists but has no readable body', async () => {
    const client = { send: async () => ({ Body: undefined }) } as unknown as S3Client
    const store = createS3BackupStore({ client, bucket: 'b' })
    await expect(store.get('postgres/x.dump')).rejects.toThrow(/stream/)
  })
})
