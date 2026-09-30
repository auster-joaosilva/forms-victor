export const LIMITS = [
  { seconds: 60, max: 5 },
  { seconds: 3600, max: 30 },
] as const

export function windowStart(now: Date, seconds: number): Date {
  const size = seconds * 1000
  return new Date(Math.floor(now.getTime() / size) * size)
}

export function secondsUntilWindowEnds(now: Date, seconds: number): number {
  const end = windowStart(now, seconds).getTime() + seconds * 1000
  return Math.max(1, Math.ceil((end - now.getTime()) / 1000))
}
