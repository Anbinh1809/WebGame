import { defineConfig } from '@playwright/test'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

export default defineConfig({
  testDir: './e2e',
  timeout: 35_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `${npm} run dev -- --host 127.0.0.1 --port 5173`,
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
