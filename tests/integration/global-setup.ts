import { execSync } from 'node:child_process'
import { assertTestDatabase } from './guard'

export default async function setup() {
  process.loadEnvFile('.env.test')
  assertTestDatabase()
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit', env: process.env })
}
