import type { ObjectStorage } from '../ports/object-storage'
import type { StoredFileRepository } from '../ports/stored-file-repository'

export const makeReadFile =
  ({ storage, repository }: { storage: ObjectStorage; repository: StoredFileRepository }) =>
  async (id: string) => {
    const file = await repository.findById(id)
    if (!file) return null
    const body = await storage.get(file.key)
    return body ? { file, body } : null
  }
