import { execSync } from 'node:child_process'
import { E2E_ADMIN } from './fill'

export default function globalSetup() {
  process.loadEnvFile('.env')
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalido')
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('O ponta a ponta só roda contra o banco local de desenvolvimento.')
  execSync(`docker compose exec -T postgres psql -U app -d ${url.pathname.slice(1)} -c "DELETE FROM rate_limit_hits; DELETE FROM auth_rate_limits"`, { stdio: 'inherit' })
  execSync('pnpm auth:bootstrap-admin', {
    stdio: 'inherit',
    env: { ...process.env, BOOTSTRAP_ADMIN_USERNAME: E2E_ADMIN.username, BOOTSTRAP_ADMIN_PASSWORD: E2E_ADMIN.password },
  })
}
