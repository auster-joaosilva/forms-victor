import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { ObjectStorage } from '../ports/object-storage'

interface S3Settings {
  endpoint: string
  useSsl: boolean
  bucket: string
  accessKey: string
  secretKey: string
}

export function createS3ObjectStorage(settings: S3Settings): ObjectStorage {
  let client: S3Client | undefined
  const s3 = () =>
    (client ??= new S3Client({
      endpoint: `${settings.useSsl ? 'https' : 'http'}://${settings.endpoint}`,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: settings.accessKey, secretAccessKey: settings.secretKey },
    }))

  return {
    async ensureBucket() {
      try {
        await s3().send(new HeadBucketCommand({ Bucket: settings.bucket }))
      } catch {
        await s3().send(new CreateBucketCommand({ Bucket: settings.bucket }))
      }
    },
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
