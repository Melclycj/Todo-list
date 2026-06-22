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

    // Click the title cell to start popup editing (portalled to document.body)
    await page.locator('tbody tr', { hasText: original }).getByText(original).click()

    // The popup editor is portalled outside the table — locate on body
    const input = page.locator('body > input[type="text"]')
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

  test('no non-functional view-mode control is present (FR-16)', async ({ page }) => {
    // The dead "Task Board" view option was removed entirely; only the
    // implemented table view exists, so there is no view-mode selector.
    await expect(page.getByRole('combobox', { name: 'View mode' })).toHaveCount(0)
    await expect(page.getByText('Task Board')).toHaveCount(0)
  })

  test('drag-reorder is operable by keyboard (NFR-09)', async ({ page }) => {
    const a = `KB-A ${uid()}`
    const b = `KB-B ${uid()}`
    await createTask(page, a) // created first → renders above B
    await createTask(page, b)

    // Both tasks have no due date → same sortable group, so the grip shows.
    const rowA = page.locator('tbody tr', { hasText: a })
    await rowA.hover()
    const grip = rowA.getByRole('button', { name: /Actions and reorder|Actions/i })
    await grip.focus()

    // dnd-kit KeyboardSensor: Space picks up, Arrow moves, Space drops.
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Space')

    // A has moved below B: the first task row now contains B.
    await expect(
      page.locator('tbody tr').filter({ hasText: /KB-/ }).first()
    ).toContainText(b)
  })
})
