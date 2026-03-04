import { test, expect } from '@playwright/test'
import { uid, registerAndLogin, createTask } from './helpers'

test.describe('Task CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page, `tasks-${uid()}@example.com`, 'password123')
  })

  test('create a task', async ({ page }) => {
    const title = `My Task ${uid()}`
    await createTask(page, title)
    await expect(page.getByText(title)).toBeVisible()
  })

  test('create a task with description and due date', async ({ page }) => {
    const title = `Detailed Task ${uid()}`

    await page.getByRole('button', { name: 'New Task', exact: true }).click()
    await page.getByLabel('Title *').fill(title)
    await page.getByLabel('Description').fill('Some notes about this task')

    // Fill in due date using the date-only input
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().slice(0, 10) // "YYYY-MM-DD"
    await page.locator('input[type="date"]').fill(dateStr)

    await page.getByRole('button', { name: 'Create Task' }).click()
    await expect(page.getByText(title)).toBeVisible()
  })

  test('edit a task title', async ({ page }) => {
    const original = `Edit Me ${uid()}`
    const updated = `Edited ${uid()}`

    await createTask(page, original)

    // Click the title cell to start inline editing
    await page.locator('tbody tr', { hasText: original }).getByText(original).click()

    // Type the new value and confirm with Enter
    const input = page.locator('tbody tr input[type="text"]')
    await input.fill(updated)
    await input.press('Enter')

    await expect(page.getByText(updated)).toBeVisible()
    await expect(page.getByText(original, { exact: true })).not.toBeVisible()
  })

  test('delete a task', async ({ page }) => {
    const title = `Delete Me ${uid()}`
    await createTask(page, title)

    // Enter edit mode via the pencil icon
    await page.getByRole('button', { name: 'Edit tasks' }).click()

    // Select the task row via its checkbox
    const row = page.locator('tbody tr', { hasText: title })
    await row.locator('input[type="checkbox"]').check()

    // Click the delete button (now enabled) and confirm
    await page.getByRole('button', { name: 'Delete selected' }).click()
    await page.getByRole('button', { name: /^Delete$/ }).click()

    await expect(page.getByText(title, { exact: true })).not.toBeVisible()
  })

  test('empty state is shown when no tasks exist', async ({ page }) => {
    await expect(page.getByText('No tasks yet')).toBeVisible()
  })
})
