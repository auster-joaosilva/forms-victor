import { describe, expect, it } from 'vitest'
import type { ObjectStorage } from '../ports/object-storage'
import type { StoredFileRecord, StoredFileRepository } from '../ports/stored-file-repository'
import { makeStoreFile } from './store-file'
import { makeReadFile } from './read-file'

function fakes() {
  const objects = new Map<string, Uint8Array>()
  const records = new Map<string, StoredFileRecord>()
  const storage: ObjectStorage = {
    ensureBucket: async () => {},
    put: async (key, body) => void objects.set(key, body),
    get: async (key) => objects.get(key) ?? null,
  }
  const repository: StoredFileRepository = {
    create: async (record) => (records.set(record.id, record), record),
    findById: async (id) => records.get(id) ?? null,
    findByOriginalName: async () => null,
  }
  return { objects, storage, repository }
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])

describe('storeFile', () => {
  it('stores bytes under a kind-scoped key with a sha256', async () => {
    const { objects, storage, repository } = fakes()
    const storeFile = makeStoreFile({ storage, repository, bucket: 'b', newId: () => 'id-1' })
    const record = await storeFile({ kind: 'event_cover', contentType: 'image/png', bytes: PNG })
    expect(record.key).toBe('event_cover/id-1.png')
    expect(record.sha256).toBe('cdf3cefe7ec6253d1cb4828ab654da6beb8a4727daac0c49dbf26bedf5887f79')
    expect(objects.get('event_cover/id-1.png')).toEqual(PNG)
    const read = await makeReadFile({ storage, repository })('id-1')
    expect(read?.body).toEqual(PNG)
  })

  it('refuses a disallowed type before touching storage', async () => {
    const { objects, storage, repository } = fakes()
    const storeFile = makeStoreFile({ storage, repository, bucket: 'b', newId: () => 'x' })
    await expect(
      storeFile({ kind: 'event_cover', contentType: 'image/svg+xml', bytes: new Uint8Array([1]) }),
    ).rejects.toThrow('content_type_not_allowed')
    expect(objects.size).toBe(0)
  })

  it('refuses bytes that are not the declared image, before touching storage', async () => {
    const { objects, storage, repository } = fakes()
    const storeFile = makeStoreFile({ storage, repository, bucket: 'b', newId: () => 'x' })
    await expect(storeFile({ kind: 'event_cover', contentType: 'image/jpeg', bytes: new TextEncoder().encode('<html>') })).rejects.toThrow('content_type_not_allowed')
    expect(objects.size).toBe(0)
  })
})
