import { getEnv } from '@/server/shared/env'
import { createS3ObjectStorage } from './adapters/s3-object-storage'
import { prismaStoredFileRepository } from './adapters/prisma-stored-file-repository'
import { makeStoreFile } from './application/store-file'
import { makeReadFile } from './application/read-file'

const env = getEnv()
const storage = createS3ObjectStorage({
  endpoint: env.S3_ENDPOINT,
  useSsl: env.S3_USE_SSL,
  bucket: env.S3_BUCKET,
  accessKey: env.S3_ACCESS_KEY,
  secretKey: env.S3_SECRET_KEY,
})

export const ensureBucket = () => storage.ensureBucket()
export const storeFile = makeStoreFile({ storage, repository: prismaStoredFileRepository, bucket: env.S3_BUCKET, newId: () => crypto.randomUUID() })
export const readFile = makeReadFile({ storage, repository: prismaStoredFileRepository })
export const findHousePhoto = (originalName: string) => prismaStoredFileRepository.findByOriginalName('house_photo', originalName)
export type { StoredFileRecord } from './ports/stored-file-repository'
