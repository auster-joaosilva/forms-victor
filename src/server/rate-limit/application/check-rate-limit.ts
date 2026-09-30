import { LIMITS, secondsUntilWindowEnds, windowStart } from '../domain/windows'
import type { RateLimitStore } from '../ports/rate-limit-store'

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number }

export const makeCheckRateLimit =
  (store: RateLimitStore) =>
  async ({ route, origin, now = new Date() }: { route: string; origin: string | null; now?: Date }): Promise<RateLimitResult> => {
    const key = `${route}|${origin ?? 'sem-origem'}`
    let blockedFor = 0
    for (const limit of LIMITS) {
      const count = await store.increment(`${key}|${limit.seconds}`, windowStart(now, limit.seconds))
      if (count > limit.max) blockedFor = Math.max(blockedFor, secondsUntilWindowEnds(now, limit.seconds))
    }
    await store.purgeBefore(new Date(now.getTime() - 2 * 3600 * 1000))
    return blockedFor ? { allowed: false, retryAfterSeconds: blockedFor } : { allowed: true }
  }
