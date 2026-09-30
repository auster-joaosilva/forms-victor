import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client'
import { getEnv } from '../env'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }) })

if (getEnv().NODE_ENV !== 'production') globalForPrisma.prisma = prisma
