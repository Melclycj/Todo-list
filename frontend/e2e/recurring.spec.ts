import { test, expect } from '@playwright/test'
import { uid, registerAndLogin } from './helpers'

test.describe('Recurring Task Creation', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page, `recurring-${uid()}@example.com`, 'password123')
  })

  test('create a recurring task template via the drawer', async ({ page }) => {
    const title = `Weekly Review ${uid()}`

    // Open create task drawer
    await page.getByRole('button', { name: 'New Task', exact: true }).click()
    await page.getByLabel('Title *').fill(title)

    // Check the recurring toggle
    await page.getByRole('checkbox', { name: /recurring/i }).check()

    // Frequency dropdown should appear — verify it defaults to Weekly
    await expect(page.getByRole('combobox', { name: /frequency/i })).toBeVisible()
    await expect(page.getByRole('combobox', { name: /frequency/i })).toHaveValue('weekly')

    await page.getByRole('button', { name: 'Create Task' }).click()

    // Toast confirms creation
    await expect(page.getByText(/recurring task created/i)).toBeVisible()
  })

  test('recurring template appears in the Recurring Tasks view', async ({ page }) => {
    const title = `Monthly Report ${uid()}`

    // Create via drawer
    await page.getByRole('button', { name: 'New Task', exact: true }).click()
    await page.getByLabel('Title *').fill(title)
    await page.getByRole('checkbox', { name: /recurring/i }).check()

    // Change to Monthly
    await page.getByRole('combobox', { name: /frequency/i }).selectOption('monthly')
    await page.getByRole('button', { name: 'Create Task' }).click()

    // Navigate to Recurring Tasks
    await page.getByRole('link', { name: 'Recurring Tasks' }).click()
    await page.waitForURL('**/recurring')

    await expect(page.getByText(title)).toBeVisible()
    await expect(page.getByText(/Monthly\s·/)).toBeVisible()
  })

  test('creating a recurring template also creates an immediate instance', async ({ page }) => {
    const title = `Immediate Instance ${uid()}`

    await page.getByRole('button', { name: 'New Task', exact: true }).click()
    await page.getByLabel('Title *').fill(title)
    await page.getByRole('checkbox', { name: /recurring/i }).check()
    await page.getByRole('button', { name: 'Create Task' }).click()

    // The first instance appears in the active task list
    // (drawer closes back to home page — no goto needed; goto('/') would clear in-memory auth)
    await expect(page.getByText(new RegExp(title))).toBeVisible()
  })

  test('stop a recurring template', async ({ page }) => {
    const title = `Stop Me ${uid()}`

    // Create template
    await page.getByRole('button', { name: 'New Task', exact: true }).click()
    await page.getByLabel('Title *').fill(title)
    await page.getByRole('checkbox', { name: /recurring/i }).check()
    await page.getByRole('button', { name: 'Create Task' }).click()

    // Navigate to Recurring Tasks
    await page.getByRole('link', { name: 'Recurring Tasks' }).click()

    const row = page.locator('.group', { hasText: title }).first()
    await row.hover()

    // Click the stop (square) button
    await row.getByRole('button', { name: 'Stop' }).click()

    // Confirm in the dialog
    await page.getByRole('dialog').getByRole('button', { name: 'Stop' }).click()

    // Template now shows as Stopped (exact: true targets the Badge, not the frequency line "Weekly · Stopped")
    await expect(page.getByText('Stopped', { exact: true })).toBeVisible()
  })

  test('create a recurring task with fortnightly frequency', async ({ page }) => {
    const title = `Fortnightly Standup ${uid()}`

    await page.getByRole('button', { name: 'New Task', exact: true }).click()
    await page.getByLabel('Title *').fill(title)
    await page.getByRole('checkbox', { name: /recurring/i }).check()
    await page.getByRole('combobox', { name: /frequency/i }).selectOption('fortnightly')
    await page.getByRole('button', { name: 'Create Task' }).click()

    await page.getByRole('link', { name: 'Recurring Tasks' }).click()
    await expect(page.getByText(title)).toBeVisible()
    await expect(page.getByText(/Fortnightly\s·/)).toBeVisible()
  })
})
