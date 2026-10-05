import { termVersions } from '@/server/adhesion/composition'
import { findStoredFile, storeFile } from '@/server/storage/composition'
import { readLegacySnapshot } from './adapters/node-sqlite-legacy-source'
import { prismaImportTarget } from './adapters/prisma-import-target'
import { makeStorageLegacyImageStore } from './adapters/storage-legacy-image-store'
import { makeImportLegacy } from './application/import-legacy'

const images = makeStorageLegacyImageStore({ storeFile, findStoredFile })

export const importLegacyFile = (path: string, options: { dryRun: boolean }) =>
  makeImportLegacy({
    source: readLegacySnapshot(path),
    target: prismaImportTarget,
    newUserId: () => crypto.randomUUID(),
    knownTermVersions: new Set(termVersions),
    images,
  })(options)

export type { ImportReport, TableReport } from './application/import-legacy'
