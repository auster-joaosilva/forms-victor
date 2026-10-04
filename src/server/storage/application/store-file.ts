import { checkFile, objectKeyFor, type AllowedContentType, type FileKind } from '../domain/file-policy'
import type { ObjectStorage } from '../ports/object-storage'
import type { StoredFileRecord, StoredFileRepository } from '../ports/stored-file-repository'

interface Dependencies {
  storage: ObjectStorage
  repository: StoredFileRepository
  bucket: string
  newId: () => string
}

export interface StoreFileInput {
  kind: FileKind
  contentType: string
  bytes: Uint8Array
  originalName?: string | null
  createdById?: string | null
}

export const makeStoreFile =
  ({ storage, repository, bucket, newId }: Dependencies) =>
  async (input: StoreFileInput): Promise<StoredFileRecord> => {
    const violation = checkFile(input.contentType, input.bytes)
    if (violation) throw new Error(violation)
    const id = newId()
    const key = objectKeyFor(input.kind, id, input.contentType as AllowedContentType)
    const digest = await crypto.subtle.digest('SHA-256', input.bytes as BufferSource)
    const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
    await storage.put(key, input.bytes, input.contentType)
    return repository.create({
      id,
      key,
      bucket,
      contentType: input.contentType,
      size: input.bytes.byteLength,
      sha256,
      kind: input.kind,
      originalName: input.originalName ?? null,
      createdById: input.createdById ?? null,
    })
  }
