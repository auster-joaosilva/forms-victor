import { execSync } from 'node:child_process'

export default async function setup() {
  process.loadEnvFile('.env.test')
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit', env: process.env })
}
