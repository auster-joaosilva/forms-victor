import { open } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { LegacyFiles } from '../ports/legacy-files'

export function createLegacyFiles(legacyDbPath: string): LegacyFiles {
  const directory = dirname(legacyDbPath)
  return {
    async open(name) {
      try {
        const handle = await open(join(directory, name), 'r')
        return handle.createReadStream()
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }
    },
  }
}
