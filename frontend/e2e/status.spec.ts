import { test, expect } from '@playwright/test'
import { uid, registerAndLogin, createTask } from './helpers'

test.describe('Task Status Transitions', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page, `status-${uid()}@example.com`, 'password123')
  })

  test('To Do → In Progress → Done', async ({ page }) => {
    const title = `Status Task ${uid()}`
    await createTask(page, title)

    const row = page.locator('.group', { hasText: title }).first()

    // Initial status: To Do (gray circle, no fill)
    const circle = row.getByRole('button', { name: /Status: to do/i })
    await expect(circle).toBeVisible()

    // Click to advance to In Progress
    await circle.click()
    await expect(row.getByRole('button', { name: /Status: in progress/i })).toBeVisible()

    // Click to advance to Done
    await row.getByRole('button', { name: /Status: in progress/i }).click()
    await expect(row.getByRole('button', { name: /Status: done/i })).toBeVisible()

    // Row should now show strikethrough
    await expect(row.locator('span', { hasText: title })).toHaveCSS('text-decoration-line', 'line-through')
  })

  test('Done task stays visible in active view (same day)', async ({ page }) => {
    const title = `Done Today ${uid()}`
    await createTask(page, title)

    const row = page.locator('.group', { hasText: title }).first()

    // Advance to Done via two clicks
    await row.getByRole('button', { name: /Status: to do/i }).click()
    await row.getByRole('button', { name: /Status: in progress/i }).click()

    // Task still visible on the active page
    await expect(page.getByText(title)).toBeVisible()
  })
})
