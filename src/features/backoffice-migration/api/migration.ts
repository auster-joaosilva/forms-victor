import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  MigrationError, importMigration, legacyStatus, resetTestData, simulateMigration, type ErasedTestData, type ImportReport,
} from '@/server/legacy-import/composition'
import { requireCapability } from '@/server/shared/http/session-middleware'

export type { ErasedTestData, ImportReport, TableReport } from '@/server/legacy-import/composition'
export type MigrationStatus = { available: boolean; reason?: string; path: string; resetAllowed: boolean }
export type ReportOutcome = { ok: true; report: ImportReport } | { ok: false; message: string }
export type ResetOutcome = { ok: true; erased: ErasedTestData } | { ok: false; message: string }

const refusal = (error: unknown): { ok: false; message: string } => {
  if (error instanceof MigrationError) return { ok: false, message: error.message }
  throw error
}

export const migrationStatusFn = createServerFn({ method: 'GET' })
  .middleware([requireCapability('manage_users')])
  .handler(({ context }): Promise<MigrationStatus> => legacyStatus(context.session.user))

export const simulateMigrationFn = createServerFn({ method: 'POST' })
  .middleware([requireCapability('manage_users')])
  .handler(({ context }): Promise<ReportOutcome> =>
    simulateMigration(context.session.user).then((report) => ({ ok: true as const, report }), refusal),
  )

export const importMigrationFn = createServerFn({ method: 'POST' })
  .middleware([requireCapability('manage_users')])
  .handler(({ context }): Promise<ReportOutcome> =>
    importMigration(context.session.user).then((report) => ({ ok: true as const, report }), refusal),
  )

export const resetTestDataFn = createServerFn({ method: 'POST' })
  .middleware([requireCapability('manage_users')])
  .inputValidator(z.object({ confirmation: z.string().max(20) }))
  .handler(({ data, context }): Promise<ResetOutcome> =>
    resetTestData(context.session.user, data.confirmation).then((erased) => ({ ok: true as const, erased }), refusal),
  )
