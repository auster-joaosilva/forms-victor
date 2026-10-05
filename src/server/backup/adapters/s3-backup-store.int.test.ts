import { createHash, randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { beforeAll, describe, expect, it } from 'vitest'
import { getEnv } from '@/server/shared/env'
import { createS3Client, ensureS3Bucket } from '@/server/shared/s3'
import { readAll } from '../application/testing/fakes'
import { createS3BackupStore } from './s3-backup-store'
import { createS3SourceFiles } from './s3-source-files'

const env = getEnv()
const BACKUP_BUCKET = 'forms-victor-test-backups'
const MIB = 1024 * 1024
const client = createS3Client({ endpoint: env.S3_ENDPOINT, useSsl: false, accessKey: env.S3_ACCESS_KEY, secretKey: env.S3_SECRET_KEY })
const run = `run-${randomUUID()}/`

function mebibytes(count: number): Readable {
  return Readable.from(
    (function* () {
      for (let index = 0; index < count; index++) yield Buffer.alloc(MIB, index % 256)
    })(),
  )
}

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const text = (value: string) => Readable.from([Buffer.from(value)])

beforeAll(async () => {
  await ensureS3Bucket(client, BACKUP_BUCKET)
  await ensureS3Bucket(client, env.S3_BUCKET)
})

describe('createS3BackupStore', () => {
  const store = createS3BackupStore({ client, bucket: BACKUP_BUCKET, partSize: 5 * MIB, pageSize: 2 })

  it('uploads a stream larger than one part and reads it back as a stream', async () => {
    const key = `${run}postgres/big.dump`
    expect(await store.put(key, mebibytes(11))).toEqual({ bytes: 11 * MIB })
    const back = await store.get(key)
    if (!back) throw new Error('o dump não voltou')
    expect(back).toBeInstanceOf(Readable)
    expect(sha256(await readAll(back))).toBe(sha256(await readAll(mebibytes(11))))
  })

  it('returns null for a missing key', async () => {
    expect(await store.get(`${run}postgres/nao-existe.dump`)).toBeNull()
  })

  it('lists every key under a prefix across pages', async () => {
    const keys = [1, 2, 3, 4, 5].map((n) => `${run}list/${n}.dump`)
    for (const key of keys) await store.put(key, text('x'))
    expect((await store.list(`${run}list/`)).sort()).toEqual(keys)
  })

  it('deletes keys in one batch and ignores an empty list', async () => {
    const keys = ['a', 'b', 'c'].map((n) => `${run}delete/${n}.dump`)
    for (const key of keys) await store.put(key, text(key))
    await store.delete([])
    await store.delete(keys.slice(0, 2))
    expect(await store.list(`${run}delete/`)).toEqual([keys[2]])
  })
})

describe('createS3SourceFiles', () => {
  const store = createS3BackupStore({ client, bucket: BACKUP_BUCKET })
  const sourceFiles = createS3SourceFiles({ client, sourceBucket: env.S3_BUCKET, backupBucket: BACKUP_BUCKET })

  it('lists the app bucket and copies on the server side, even with a space in the key', async () => {
    const sourceKey = `${run}house_photo/foto da casa.jpg`
    await client.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: sourceKey, Body: new Uint8Array([1, 2, 3]), ContentType: 'image/jpeg' }))
    expect(await sourceFiles.list()).toContain(sourceKey)
    await sourceFiles.copyTo(sourceKey, `${run}files/${sourceKey}`)
    const copy = await store.get(`${run}files/${sourceKey}`)
    if (!copy) throw new Error('a cópia não chegou')
    expect(new Uint8Array(await readAll(copy))).toEqual(new Uint8Array([1, 2, 3]))
  })
})
