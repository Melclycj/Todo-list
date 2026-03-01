import { defineConfig, devices } from '@playwright/test'

/**
 * E2E tests run against the full Docker Compose stack.
 *
 * Start the stack first:
 *   docker compose up -d --build
 *
 * Then run tests:
 *   npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // sequential — tests share a single DB instance
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:80',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
