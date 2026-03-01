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

    // Fill in due date using the datetime-local input
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const isoLocal = tomorrow.toISOString().slice(0, 16) // "YYYY-MM-DDTHH:MM"
    await page.locator('input[type="datetime-local"]').fill(isoLocal)

    await page.getByRole('button', { name: 'Create Task' }).click()
    await expect(page.getByText(title)).toBeVisible()
  })

  test('edit a task title', async ({ page }) => {
    const original = `Edit Me ${uid()}`
    const updated = `Edited ${uid()}`

    await createTask(page, original)

    // Click row to expand inline editor
    await page.getByText(original).click()
    await page.getByLabel('Title *').clear()
    await page.getByLabel('Title *').fill(updated)
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText(updated)).toBeVisible()
    await expect(page.getByText(original)).not.toBeVisible()
  })

  test('delete a task', async ({ page }) => {
    const title = `Delete Me ${uid()}`
    await createTask(page, title)

    // Hover the row to reveal the actions menu
    const row = page.locator(`text=${title}`).locator('..')
    await row.hover()

    await page.getByRole('button', { name: 'Task actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    // Confirm deletion
    await page.getByRole('button', { name: /^Delete$/ }).click()

    await expect(page.getByText(title, { exact: true })).not.toBeVisible()
  })

  test('empty state is shown when no tasks exist', async ({ page }) => {
    await expect(page.getByText('No tasks yet')).toBeVisible()
  })
})
