import { openLegacySource } from './adapters/node-sqlite-legacy-source'
import { prismaImportTarget } from './adapters/prisma-import-target'
import { makeImportLegacy } from './application/import-legacy'

export function legacyImporter(path: string) {
  const source = openLegacySource(path)
  return { run: makeImportLegacy({ source, target: prismaImportTarget, newUserId: () => crypto.randomUUID() }), close: () => source.close() }
}

export type { ImportReport } from './application/import-legacy'
