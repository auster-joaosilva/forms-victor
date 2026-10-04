import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { findStoredFile, storeFile } from '@/server/storage/composition'
import { resetDatabase } from '../../../../tests/integration/db'
import { buildLegacyDatabase } from '../../../../tests/integration/legacy-portal'
import { makeImportLegacy } from '../application/import-legacy'
import { makeManageMigration } from '../application/manage-migration'
import { legacyDatabase } from './node-sqlite-legacy-source'
import { prismaImportTarget } from './prisma-import-target'
import { prismaTestDataEraser } from './prisma-test-data-eraser'
import { makeStorageLegacyImageStore } from './storage-legacy-image-store'

const path = join(tmpdir(), `portal-${randomUUID()}.db`)
const admin = { id: 'victor-novo', username: 'victor', role: 'admin' as const }

const images = makeStorageLegacyImageStore({ storeFile, findStoredFile })
const migration = makeManageMigration({
  legacy: legacyDatabase(path),
  runImport: (source, options) =>
    makeImportLegacy({ source, target: prismaImportTarget, newUserId: () => randomUUID(), knownTermVersions: new Set(['V4', 'V5']), images })(options),
  eraser: prismaTestDataEraser,
  allowReset: true,
})

const testAdhesion = (protocol: string) => ({
  protocol, acceptedAt: new Date(), companyName: 'x', cnpj: 'x', cnpjDigits: 'x', representative: 'x', cpf: 'x',
  representativeRole: 'x', email: 'x', modality: 'standard' as const, termVersion: 'V5', termHash: 'x', payload: {},
})

describe('migration from the backoffice', () => {
  beforeEach(async () => {
    await resetDatabase()
    rmSync(path, { force: true })
    await prisma.user.create({ data: { id: 'victor-novo', name: 'Victor', email: 'victor@users.invalid', username: 'victor', role: 'admin' } })
  })
  afterAll(() => rmSync(path, { force: true }))

  it('says the database is missing until the file is there', async () => {
    expect(await migration.legacyStatus(admin)).toEqual({ available: false, path, resetAllowed: true })
    buildLegacyDatabase(path)
    expect(await migration.legacyStatus(admin)).toMatchObject({ available: true })
  })

  it('refuses to import over the hml test data, then imports once they are erased, on behalf of the actor', async () => {
    buildLegacyDatabase(path)
    const response = await prisma.response.create({ data: { protocol: 'DS-TESTE', payload: {} } })
    await prisma.diagnosisDraft.create({ data: { payload: {}, expiresAt: new Date(Date.now() + 60_000), responseId: response.id } })
    await prisma.diagnosisDraft.create({ data: { payload: {}, expiresAt: new Date(Date.now() + 60_000) } })
    await prisma.adhesion.create({ data: { ...testAdhesion('ADS-TESTE'), responseId: response.id } })

    const refused = await migration.importNow(admin)
    expect(refused).toMatchObject({ dryRun: true, conflicts: ['resposta 1: o id já existe no banco novo com o protocolo DS-TESTE', 'adesão 1: o id já existe no banco novo com o protocolo ADS-TESTE'] })
    expect(await prisma.user.count()).toBe(1)

    expect(await migration.resetTestData(admin, 'APAGAR')).toEqual({ drafts: 2, registrations: 0, adhesions: 1, responses: 1 })
    expect([await prisma.diagnosisDraft.count(), await prisma.adhesion.count(), await prisma.response.count()]).toEqual([0, 0, 0])
    expect(await prisma.auditLog.findFirst({ where: { action: 'test_data_reset' } })).toMatchObject({
      actorId: 'victor-novo', actorUsername: 'victor', detail: { drafts: 2, registrations: 0, adhesions: 1, responses: 1 },
    })

    expect(await migration.importNow(admin)).toMatchObject({ dryRun: false, conflicts: [], responses: { imported: 4 }, adhesions: { imported: 3 } })
    expect(await prisma.auditLog.findFirst({ where: { action: 'legacy_imported', actorId: 'victor-novo' } })).toMatchObject({ actorUsername: 'victor' })
    expect(await migration.importNow(admin)).toMatchObject({ dryRun: false, responses: { imported: 0, skipped: 4 }, adhesions: { imported: 0, skipped: 3 } })
  })
})
