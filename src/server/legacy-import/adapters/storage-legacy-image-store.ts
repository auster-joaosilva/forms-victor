import type { LegacyImage } from '../domain/event-mapping'
import type { LegacyImageStore } from '../ports/legacy-image-store'

type StoredFile = { id: string }
type Deps = {
  storeFile(input: { kind: LegacyImage['kind']; contentType: string; bytes: Uint8Array; originalName: string; createdById: null }): Promise<StoredFile>
  findStoredFile(kind: 'house_photo' | LegacyImage['kind'], originalName: string): Promise<StoredFile | null>
}

// A chave determinística (legacy-agenda-<id>-capa) vai no nome original: rodar a migração de novo acha o arquivo e não sobe outro.
export const makeStorageLegacyImageStore = ({ storeFile, findStoredFile }: Deps): LegacyImageStore => ({
  find: async (kind, key) => (await findStoredFile(kind, key))?.id ?? null,
  store: async (image) => (await storeFile({ kind: image.kind, contentType: image.contentType, bytes: image.bytes, originalName: image.key, createdById: null })).id,
  houseFileId: async (name) => (await findStoredFile('house_photo', name))?.id ?? null,
})
