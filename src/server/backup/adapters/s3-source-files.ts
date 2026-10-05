import { CopyObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { listS3Keys } from '@/server/shared/s3'
import type { SourceFiles } from '../ports/source-files'

const encodeKey = (key: string) => key.split('/').map(encodeURIComponent).join('/')

export function createS3SourceFiles({ client, sourceBucket, backupBucket }: { client: S3Client; sourceBucket: string; backupBucket: string }): SourceFiles {
  return {
    list: () => listS3Keys(client, sourceBucket, ''),
    async copyTo(sourceKey, backupKey) {
      await client.send(new CopyObjectCommand({ Bucket: backupBucket, Key: backupKey, CopySource: `${sourceBucket}/${encodeKey(sourceKey)}` }))
    },
  }
}
