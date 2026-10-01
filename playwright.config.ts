import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 3000)
const origin = `http://localhost:${port}`

export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  timeout: 120_000,
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: origin, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm dev --port ${port} --strictPort`,
    url: `${origin}/health`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { PORT: String(port), BETTER_AUTH_URL: origin, APP_PUBLIC_URL: origin },
  },
})
