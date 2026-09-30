import type { FileKind } from '../domain/file-policy'

export interface StoredFileRecord {
  id: string
  key: string
  contentType: string
  size: number
  sha256: string
  kind: FileKind
  originalName: string | null
}

export interface StoredFileRepository {
  create(record: StoredFileRecord & { bucket: string; createdById: string | null }): Promise<StoredFileRecord>
  findById(id: string): Promise<StoredFileRecord | null>
  findByOriginalName(kind: FileKind, originalName: string): Promise<StoredFileRecord | null>
}
