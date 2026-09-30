import { describe, expect, it } from 'vitest'
import { getEnv } from '@/server/shared/env'
import { createS3ObjectStorage } from './s3-object-storage'

const env = getEnv()

describe('createS3ObjectStorage', () => {
  const storage = createS3ObjectStorage({
    endpoint: env.S3_ENDPOINT,
    useSsl: false,
    bucket: env.S3_BUCKET,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
  })

  it('creates the bucket, writes and reads back', async () => {
    await storage.ensureBucket()
    await storage.put('probe/one.png', new Uint8Array([9, 8, 7]), 'image/png')
    expect(await storage.get('probe/one.png')).toEqual(new Uint8Array([9, 8, 7]))
    expect(await storage.get('probe/missing.png')).toBeNull()
  })
})
