import { test, expect } from '@playwright/test'
import { uid, registerAndLogin, createTask } from './helpers'

test.describe('Task Status Transitions', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page, `status-${uid()}@example.com`, 'password123')
  })

  test('Not started → In progress → Done → Not started (full cycle)', async ({ page }) => {
    const title = `Status Task ${uid()}`
    await createTask(page, title)

    const row = page.locator('tbody tr', { hasText: title })

    // Initial status: Not started
    const badge = row.getByRole('button', { name: /Status: Not started/i })
    await expect(badge).toBeVisible()

    // Click to advance to In progress
    await badge.click()
    await expect(row.getByRole('button', { name: /Status: In progress/i })).toBeVisible()

    // Click to advance to Done
    await row.getByRole('button', { name: /Status: In progress/i }).click()
    await expect(row.getByRole('button', { name: /Status: Done/i })).toBeVisible()

    // Row should show strikethrough on title
    await expect(row.locator('span', { hasText: title })).toHaveCSS('text-decoration-line', 'line-through')

    // Click to cycle back to Not started
    await row.getByRole('button', { name: /Status: Done/i }).click()
    await expect(row.getByRole('button', { name: /Status: Not started/i })).toBeVisible()

    // Strikethrough gone
    await expect(row.locator('span', { hasText: title })).not.toHaveCSS('text-decoration-line', 'line-through')
  })

  test('Done task stays visible in active view (same day)', async ({ page }) => {
    const title = `Done Today ${uid()}`
    await createTask(page, title)

    const row = page.locator('tbody tr', { hasText: title })

    // Advance to Done: Not started → In progress → Done
    await row.getByRole('button', { name: /Status: Not started/i }).click()
    await row.getByRole('button', { name: /Status: In progress/i }).click()

    // Task still visible on the active page
    await expect(page.getByText(title)).toBeVisible()
  })
})
