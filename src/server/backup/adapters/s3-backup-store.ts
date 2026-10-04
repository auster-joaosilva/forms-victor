import { DeleteObjectsCommand, GetObjectCommand, NoSuchKey, type S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { Readable, Transform } from 'node:stream'
import { listS3Keys } from '@/server/shared/s3'
import type { BackupStore } from '../ports/backup-store'

const DELETE_BATCH = 1000

interface Settings {
  client: S3Client
  bucket: string
  partSize?: number
  pageSize?: number
}

export function createS3BackupStore({ client, bucket, partSize = 8 * 1024 * 1024, pageSize }: Settings): BackupStore {
  return {
    async put(key, stream) {
      let bytes = 0
      const counted = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length
          callback(null, chunk)
        },
      })
      stream.once('error', (error) => counted.destroy(error))
      // O tamanho do dump não é conhecido: partes fixas, duas no ar, e a memória fica em poucas partes qualquer que seja o banco.
      const upload = new Upload({
        client,
        partSize,
        queueSize: 2,
        params: { Bucket: bucket, Key: key, Body: stream.pipe(counted), ContentType: 'application/octet-stream' },
      })
      await upload.done()
      return { bytes }
    },
    async get(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
        if (!(result.Body instanceof Readable)) throw new Error(`o objeto ${key} existe, mas a resposta do S3 não veio como stream`)
        return result.Body
      } catch (error) {
        if (error instanceof NoSuchKey) return null
        throw error
      }
    },
    list: (prefix) => listS3Keys(client, bucket, prefix, pageSize),
    async delete(keys) {
      for (let start = 0; start < keys.length; start += DELETE_BATCH) {
        const batch = keys.slice(start, start + DELETE_BATCH)
        const result = await client.send(
          new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } }),
        )
        if (result.Errors?.length) throw new Error(`não foi possível apagar do backup: ${result.Errors.map((e) => e.Key).join(', ')}`)
      }
    },
  }
}
