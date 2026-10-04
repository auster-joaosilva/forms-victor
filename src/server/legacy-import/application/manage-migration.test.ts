import { describe, expect, it } from 'vitest'
import type { LegacySource } from '../ports/legacy-source'
import type { ImportReport } from './import-legacy'
import { makeManageMigration } from './manage-migration'

const admin = { id: 'v1', username: 'victor', role: 'admin' as const }
const operator = { id: 'o1', username: 'otavio', role: 'operator' as const }
const table = { found: 1, imported: 1, skipped: 0 }
const report = (dryRun: boolean, conflicts: string[] = []): ImportReport => ({
  dryRun, users: table, invitations: table, responses: table, adhesions: table, events: table, sessions: table, registrations: table, images: table, audit: table, conflicts, notes: [],
})
const emptySource: LegacySource = {
  users: async () => [], invitations: async () => [], responses: async () => [], adhesions: async () => [], events: async () => [],
  agenda: async () => [], agendaSessions: async () => [], registrations: async () => [],
}

function setup({ available = true, reason = undefined as string | undefined, conflicts = [] as string[], allowReset = false } = {}) {
  const runs: { dryRun: boolean; actor?: { id: string; username: string } }[] = []
  const snapshots: LegacySource[] = []
  const erasedBy: { id: string; username: string }[] = []
  const migration = makeManageMigration({
    legacy: {
      path: '/legacy/portal.db',
      probe: async () => (available ? { available } : { available, reason }),
      snapshot: async () => {
        const source = { ...emptySource }
        snapshots.push(source)
        return source
      },
    },
    runImport: async (source, options) => {
      expect(source).toBe(snapshots.at(-1))
      runs.push(options)
      return report(options.dryRun, conflicts)
    },
    eraser: { eraseTestData: async (actor) => (erasedBy.push(actor), { drafts: 2, registrations: 1, sessions: 5, events: 6, adhesions: 3, responses: 4 }) },
    allowReset,
  })
  return { migration, runs, snapshots, erasedBy }
}

describe('manage migration', () => {
  it('tells where the old database is expected and whether it opens', async () => {
    expect(await setup().migration.legacyStatus(admin)).toEqual({ available: true, path: '/legacy/portal.db', resetAllowed: false })
    expect(await setup({ available: false, allowReset: true }).migration.legacyStatus(admin)).toEqual({ available: false, path: '/legacy/portal.db', resetAllowed: true })
    expect(await setup({ available: false, reason: 'file is not a database' }).migration.legacyStatus(admin)).toEqual({
      available: false, reason: 'file is not a database', path: '/legacy/portal.db', resetAllowed: false,
    })
  })

  it('says why the database does not open when it refuses to read it', async () => {
    const { migration } = setup({ available: false, reason: 'file is not a database' })
    await expect(migration.simulate(admin)).rejects.toThrow('o banco do portal antigo não está disponível em /legacy/portal.db: file is not a database')
  })

  it('refuses to simulate or import without the database, and reads nothing', async () => {
    const { migration, runs } = setup({ available: false })
    await expect(migration.simulate(admin)).rejects.toThrow('o banco do portal antigo não está disponível em /legacy/portal.db')
    await expect(migration.importNow(admin)).rejects.toThrow('o banco do portal antigo não está disponível em /legacy/portal.db')
    expect(runs).toEqual([])
  })

  it('simulates without writing', async () => {
    const { migration, runs } = setup()
    expect(await migration.simulate(admin)).toEqual(report(true))
    expect(runs).toEqual([{ dryRun: true }])
  })

  it('returns the simulation and writes nothing when it has a conflict', async () => {
    const { migration, runs } = setup({ conflicts: ['resposta 1: o id já existe'] })
    expect(await migration.importNow(admin)).toEqual(report(true, ['resposta 1: o id já existe']))
    expect(runs).toEqual([{ dryRun: true }])
  })

  it('imports for real after a clean simulation of the same snapshot, on behalf of the actor', async () => {
    const { migration, runs, snapshots } = setup()
    expect(await migration.importNow(admin)).toEqual(report(false))
    expect(runs).toEqual([{ dryRun: true }, { dryRun: false, actor: { id: 'v1', username: 'victor' } }])
    expect(snapshots).toHaveLength(1)
  })

  it('only lets an administrator see the status, simulate, import or reset', async () => {
    const { migration, runs, erasedBy } = setup({ allowReset: true })
    await expect(migration.legacyStatus(operator)).rejects.toThrow('só administrador')
    await expect(migration.simulate(operator)).rejects.toThrow('só administrador')
    await expect(migration.importNow(operator)).rejects.toThrow('só administrador')
    await expect(migration.resetTestData(operator, 'APAGAR')).rejects.toThrow('só administrador')
    expect(runs).toEqual([])
    expect(erasedBy).toEqual([])
  })

  it('runs one migration at a time', async () => {
    const { migration } = setup()
    const first = migration.importNow(admin)
    await expect(migration.importNow(admin)).rejects.toThrow('já há uma operação de migração em andamento; espere ela terminar')
    await first
    await expect(migration.simulate(admin)).resolves.toMatchObject({ dryRun: true })
  })

  it('refuses the reset when the environment does not allow it', async () => {
    const { migration, erasedBy } = setup({ allowReset: false })
    await expect(migration.resetTestData(admin, 'APAGAR')).rejects.toThrow('apagar dados de teste está desligado neste ambiente')
    expect(erasedBy).toEqual([])
  })

  it('refuses the reset without the exact confirmation', async () => {
    const { migration, erasedBy } = setup({ allowReset: true })
    for (const confirmation of ['', 'apagar', 'APAGAR ', 'SIM']) {
      await expect(migration.resetTestData(admin, confirmation)).rejects.toThrow('digite APAGAR para confirmar')
    }
    expect(erasedBy).toEqual([])
  })

  it('erases the test data on behalf of the actor, who goes into the audit of the same transaction', async () => {
    const { migration, erasedBy } = setup({ allowReset: true })
    expect(await migration.resetTestData(admin, 'APAGAR')).toEqual({ drafts: 2, registrations: 1, sessions: 5, events: 6, adhesions: 3, responses: 4 })
    expect(erasedBy).toEqual([{ id: 'v1', username: 'victor' }])
  })
})
