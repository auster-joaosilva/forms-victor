import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  S3_ENDPOINT: z.string().regex(/^[a-z0-9.-]+:\d+$/, 'S3_ENDPOINT é host:porta, sem protocolo'),
  S3_USE_SSL: z.union([z.boolean(), z.string().transform(v => v === 'true')]).default(false),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(3),
  S3_SECRET_KEY: z.string().min(8),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  APP_PUBLIC_URL: z.string().url(),
  ADHESION_WINDOW_END: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default('2026-09-30'),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    throw new Error(`Ambiente inválido — ${problems.join('; ')}`)
  }
  return result.data
}

let cached: Env | undefined

export function getEnv(): Env {
  cached ??= parseEnv(process.env)
  return cached
}
