import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  S3_ENDPOINT: z.string().regex(/^[a-z0-9.-]+:\d+$/, 'S3_ENDPOINT é host:porta, sem protocolo'),
  S3_USE_SSL: z.stringbool().default(false),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(3),
  S3_SECRET_KEY: z.string().min(8),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  APP_PUBLIC_URL: z.url(),
  LEGACY_DB_PATH: z.string().min(1).default('/legacy/portal.db'),
  // Apaga respostas e adesões: só a palavra exata liga, e um erro de digitação derruba a subida em vez de passar calado.
  ALLOW_TEST_DATA_RESET: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
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
