import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  timeout: 120_000,
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: 'http://localhost:3000', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'pnpm dev', url: 'http://localhost:3000/health', reuseExistingServer: true, timeout: 120_000 },
})
