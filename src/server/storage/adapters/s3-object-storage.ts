import { GetObjectCommand, NoSuchKey, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { createS3Client, ensureS3Bucket, type S3Connection } from '@/server/shared/s3'
import type { ObjectStorage } from '../ports/object-storage'

interface S3Settings extends S3Connection {
  bucket: string
}

export function createS3ObjectStorage(settings: S3Settings): ObjectStorage {
  let client: S3Client | undefined
  const s3 = () => (client ??= createS3Client(settings))

  return {
    ensureBucket: () => ensureS3Bucket(s3(), settings.bucket),
    async put(key, body, contentType) {
      await s3().send(new PutObjectCommand({ Bucket: settings.bucket, Key: key, Body: body, ContentType: contentType }))
    },
    async get(key) {
      try {
        const result = await s3().send(new GetObjectCommand({ Bucket: settings.bucket, Key: key }))
        return result.Body ? new Uint8Array(await result.Body.transformToByteArray()) : null
      } catch (error) {
        if (error instanceof NoSuchKey) return null
        throw error
      }
    },
  }
}
