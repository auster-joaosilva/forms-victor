import { z } from 'zod'

// O compose passa `${VAR:-}`: variável ausente chega como texto vazio.
const optionalText = z.preprocess((value) => (value === '' ? undefined : value), z.string().min(1).optional())

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  S3_ENDPOINT: z.string().regex(/^[a-z0-9.-]+:\d+$/, 'S3_ENDPOINT é host:porta, sem protocolo'),
  S3_USE_SSL: z.stringbool().default(false),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(3),
  S3_SECRET_KEY: z.string().min(8),
  BACKUP_BUCKET: z.string().min(3).default('forms-victor-backups'),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  APP_PUBLIC_URL: z.url(),
  LEGACY_DB_PATH: z.string().min(1).default('/legacy/portal.db'),
  SMTP_HOST: z.string().min(1).default('smtps.uhserver.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: optionalText,
  SMTP_PASSWORD: optionalText,
  // Apaga respostas e adesões: só a palavra exata liga, e um erro de digitação derruba a subida em vez de passar calado.
}).refine((env) => (env.SMTP_USER === undefined) === (env.SMTP_PASSWORD === undefined), {
  path: ['SMTP_PASSWORD'],
  message: 'SMTP_USER e SMTP_PASSWORD vão juntos',
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
