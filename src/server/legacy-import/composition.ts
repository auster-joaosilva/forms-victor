import { termVersions } from '@/server/adhesion/composition'
import { recordAudit } from '@/server/audit/composition'
import { getEnv } from '@/server/shared/env'
import { legacyDatabase, readLegacySnapshot } from './adapters/node-sqlite-legacy-source'
import { prismaImportTarget } from './adapters/prisma-import-target'
import { prismaTestDataEraser } from './adapters/prisma-test-data-eraser'
import { makeImportLegacy } from './application/import-legacy'
import { makeManageMigration } from './application/manage-migration'
import type { LegacySource } from './ports/legacy-source'

const importerFor = (source: LegacySource) =>
  makeImportLegacy({ source, target: prismaImportTarget, newUserId: () => crypto.randomUUID(), knownTermVersions: new Set(termVersions) })

export const importLegacyFile = (path: string, options: { dryRun: boolean }) => importerFor(readLegacySnapshot(path))(options)

const env = getEnv()
const manageMigration = makeManageMigration({
  legacy: legacyDatabase(env.LEGACY_DB_PATH),
  runImport: (source, options) => importerFor(source)(options),
  eraser: prismaTestDataEraser,
  recordAudit,
  allowReset: env.ALLOW_TEST_DATA_RESET,
})

export const legacyStatus = manageMigration.legacyStatus
export const simulateMigration = manageMigration.simulate
export const importMigration = manageMigration.importNow
export const resetTestData = manageMigration.resetTestData
export { MigrationError, RESET_CONFIRMATION } from './domain/migration'
export type { ImportReport, TableReport } from './application/import-legacy'
export type { ErasedTestData } from './ports/test-data-eraser'
