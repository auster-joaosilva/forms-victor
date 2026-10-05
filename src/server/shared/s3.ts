import { CreateBucketCommand, HeadBucketCommand, S3Client, paginateListObjectsV2 } from '@aws-sdk/client-s3'

export interface S3Connection {
  endpoint: string
  useSsl: boolean
  accessKey: string
  secretKey: string
}

export function createS3Client(connection: S3Connection): S3Client {
  return new S3Client({
    endpoint: `${connection.useSsl ? 'https' : 'http'}://${connection.endpoint}`,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: connection.accessKey, secretAccessKey: connection.secretKey },
  })
}

export async function ensureS3Bucket(client: S3Client, bucket: string): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }))
  }
}

export async function listS3Keys(client: S3Client, bucket: string, prefix: string, pageSize = 1000): Promise<string[]> {
  const keys: string[] = []
  for await (const page of paginateListObjectsV2({ client, pageSize }, { Bucket: bucket, Prefix: prefix })) {
    for (const item of page.Contents ?? []) if (item.Key) keys.push(item.Key)
  }
  return keys
}
