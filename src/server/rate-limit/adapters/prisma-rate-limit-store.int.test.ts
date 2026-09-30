import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../../../../tests/integration/db'
import { prismaRateLimitStore } from './prisma-rate-limit-store'

describe('prismaRateLimitStore', () => {
  beforeEach(resetDatabase)
  it('increments atomically under concurrency', async () => {
    const start = new Date('2026-10-01T12:00:00Z')
    const counts = await Promise.all(Array.from({ length: 10 }, () => prismaRateLimitStore.increment('k', start)))
    expect(counts.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})
