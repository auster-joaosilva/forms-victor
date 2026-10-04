export type RateLimitedRoute = 'cnpj-lookup'

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number }

export interface RateLimiter {
  check(route: RateLimitedRoute, origin: string | null): Promise<RateLimitDecision>
}
