import { can, type Role } from '@/server/shared/domain/permissions'
import { MigrationError, RESET_CONFIRMATION } from '../domain/migration'
import type { ImportActor } from '../ports/import-target'
import type { LegacyDatabase, LegacySource } from '../ports/legacy-source'
import type { TestDataEraser } from '../ports/test-data-eraser'
import type { ImportReport } from './import-legacy'

type Actor = ImportActor & { role: Role }
type RunImport = (source: LegacySource, options: { dryRun: boolean; actor?: ImportActor }) => Promise<ImportReport>

export function makeManageMigration({ legacy, runImport, eraser, allowReset }: {
  legacy: LegacyDatabase
  runImport: RunImport
  eraser: TestDataEraser
  allowReset: boolean
}) {
  // Um container só: a trava em memória basta para um duplo clique não rodar duas importações em paralelo.
  let busy = false
  const assertAdmin = (actor: Actor) => {
    if (!can(actor.role, 'manage_users')) throw new MigrationError('forbidden')
  }
  const exclusive = async <T>(actor: Actor, work: () => Promise<T>): Promise<T> => {
    assertAdmin(actor)
    if (busy) throw new MigrationError('busy')
    busy = true
    try {
      return await work()
    } finally {
      busy = false
    }
  }
  const snapshot = async () => {
    const availability = await legacy.probe()
    if (!availability.available) throw new MigrationError('unavailable', { path: legacy.path, cause: availability.reason })
    return legacy.snapshot()
  }

  return {
    legacyStatus: async (actor: Actor) => {
      assertAdmin(actor)
      return { ...(await legacy.probe()), path: legacy.path, resetAllowed: allowReset }
    },

    simulate: (actor: Actor) => exclusive(actor, async () => runImport(await snapshot(), { dryRun: true })),

    importNow: (actor: Actor) =>
      exclusive(actor, async () => {
        const source = await snapshot()
        const simulation = await runImport(source, { dryRun: true })
        if (simulation.conflicts.length) return simulation
        return runImport(source, { dryRun: false, actor: { id: actor.id, username: actor.username } })
      }),

    resetTestData: (actor: Actor, confirmation: string) =>
      exclusive(actor, async () => {
        if (!allowReset) throw new MigrationError('reset_disabled')
        if (confirmation !== RESET_CONFIRMATION) throw new MigrationError('reset_unconfirmed')
        return eraser.eraseTestData({ id: actor.id, username: actor.username })
      }),
  }
}
