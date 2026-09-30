import { readdir } from 'node:fs/promises'
import { prisma } from '@/server/shared/prisma/client'
import type { MigrationStatus } from '../ports/migration-status'

export const prismaMigrationStatus: MigrationStatus = {
  async applied() {
    const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name DESC LIMIT 1`
    return rows[0]?.migration_name ?? null
  },
  async expected() {
    const entries = await readdir('prisma/migrations', { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort().at(-1) ?? null
  },
}
