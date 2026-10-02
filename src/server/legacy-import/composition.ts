import { termVersions } from '@/server/adhesion/composition'
import { readLegacySnapshot } from './adapters/node-sqlite-legacy-source'
import { prismaImportTarget } from './adapters/prisma-import-target'
import { makeImportLegacy } from './application/import-legacy'
import type { LegacySource } from './ports/legacy-source'

const importerFor = (source: LegacySource) =>
  makeImportLegacy({ source, target: prismaImportTarget, newUserId: () => crypto.randomUUID(), knownTermVersions: new Set(termVersions) })

export const importLegacyFile = (path: string, options: { dryRun: boolean }) => importerFor(readLegacySnapshot(path))(options)

export type { ImportReport } from './application/import-legacy'
