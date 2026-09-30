import { defineConfig, env } from 'prisma/config'

try {
  process.loadEnvFile('.env')
} catch {
  // em produção as variáveis vêm do ambiente
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx --env-file-if-exists=.env prisma/seed.ts' },
  datasource: { url: env('DATABASE_URL') },
})
