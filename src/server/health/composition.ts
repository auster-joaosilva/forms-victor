import { prismaMigrationStatus } from './adapters/prisma-migration-status'
import { makeGetHealth } from './application/get-health'

export const getHealth = makeGetHealth(prismaMigrationStatus)
