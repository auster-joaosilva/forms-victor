export interface RateLimitStore {
  increment(key: string, windowStart: Date): Promise<number>
  purgeBefore(moment: Date): Promise<void>
}
