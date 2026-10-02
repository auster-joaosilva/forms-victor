import { can, type Role } from '@/server/shared/domain/permissions'
import { MigrationError, RESET_CONFIRMATION } from '../domain/migration'
import type { ImportActor } from '../ports/import-target'
import type { LegacyDatabase, LegacySource } from '../ports/legacy-source'
import type { ErasedTestData, TestDataEraser } from '../ports/test-data-eraser'
import type { ImportReport } from './import-legacy'

type Actor = ImportActor & { role: Role }
type RunImport = (source: LegacySource, options: { dryRun: boolean; actor?: ImportActor }) => Promise<ImportReport>
type AuditRecorder = (entry: { action: 'test_data_reset'; actorId: string; actorUsername: string; detail: ErasedTestData }) => Promise<void>

export function makeManageMigration({ legacy, runImport, eraser, recordAudit, allowReset }: {
  legacy: LegacyDatabase
  runImport: RunImport
  eraser: TestDataEraser
  recordAudit: AuditRecorder
  allowReset: boolean
}) {
  // Um container só: a trava em memória basta para um duplo clique não rodar duas importações em paralelo.
  let busy = false
  const exclusive = async <T>(actor: Actor, work: () => Promise<T>): Promise<T> => {
    if (!can(actor.role, 'manage_users')) throw new MigrationError('forbidden')
    if (busy) throw new MigrationError('busy')
    busy = true
    try {
      return await work()
    } finally {
      busy = false
    }
  }
  const snapshot = async () => {
    if (!(await legacy.isAvailable())) throw new MigrationError('unavailable', legacy.path)
    return legacy.snapshot()
  }

  return {
    legacyStatus: async () => ({ available: await legacy.isAvailable(), path: legacy.path, resetAllowed: allowReset }),

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
        const erased = await eraser.eraseTestData()
        await recordAudit({ action: 'test_data_reset', actorId: actor.id, actorUsername: actor.username, detail: erased })
        return erased
      }),
  }
}
