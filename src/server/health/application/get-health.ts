import type { MigrationStatus } from '../ports/migration-status'

export const makeGetHealth = (status: MigrationStatus) => async () => {
  const expectedMigration = await status.expected().catch(() => null)
  const appliedMigration = await status.applied().catch(() => null)
  return {
    ok: appliedMigration !== null && appliedMigration === expectedMigration,
    now: new Date().toISOString(),
    appliedMigration,
    expectedMigration,
  }
}
