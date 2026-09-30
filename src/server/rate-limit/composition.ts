import { prismaRateLimitStore } from './adapters/prisma-rate-limit-store'
import { makeCheckRateLimit } from './application/check-rate-limit'

export const checkRateLimit = makeCheckRateLimit(prismaRateLimitStore)
