import { prisma } from '@/server/shared/prisma/client'
import type { RateLimitStore } from '../ports/rate-limit-store'

export const prismaRateLimitStore: RateLimitStore = {
  async increment(key, windowStart) {
    const row = await prisma.rateLimitHit.upsert({
      where: { key_windowStart: { key, windowStart } },
      create: { key, windowStart, count: 1 },
      update: { count: { increment: 1 } },
    })
    return row.count
  },
  async purgeBefore(moment) {
    await prisma.rateLimitHit.deleteMany({ where: { windowStart: { lt: moment } } })
  },
}
