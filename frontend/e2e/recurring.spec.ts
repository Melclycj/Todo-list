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

  test('recurring template appears in the Recurring Tasks view as a table row', async ({ page }) => {
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

    // Title appears in table row
    await expect(page.getByText(title, { exact: true })).toBeVisible()
    // Frequency column shows Monthly
    await expect(page.getByText('Monthly', { exact: true })).toBeVisible()
    // Next due column shows "Next due:"
    await expect(page.getByText(/Next due:/)).toBeVisible()
  })

  test('creating a recurring template also creates an immediate instance', async ({ page }) => {
    const title = `Immediate Instance ${uid()}`

    await page.getByRole('button', { name: 'New Task', exact: true }).click()
    await page.getByLabel('Title *').fill(title)
    await page.getByRole('checkbox', { name: /recurring/i }).check()
    await page.getByRole('button', { name: 'Create Task' }).click()

    // The first instance appears in the active task list
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

    const row = page.getByRole('row', { name: new RegExp(title) })
    await row.hover()

    // Click the stop (square) button
    await row.getByRole('button', { name: 'Stop' }).click()

    // Confirm in the dialog
    await page.getByRole('dialog').getByRole('button', { name: 'Stop' }).click()

    // Next due cell now shows Stopped
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
    await expect(page.getByText(title, { exact: true })).toBeVisible()
    await expect(page.getByText('Fortnightly', { exact: true })).toBeVisible()
  })

  test('create a daily recurring task — due date is grayed out showing today', async ({ page }) => {
    const title = `Daily Standup ${uid()}`

    await page.getByRole('button', { name: 'New Task', exact: true }).click()
    await page.getByLabel('Title *').fill(title)
    await page.getByRole('checkbox', { name: /recurring/i }).check()

    // Switch frequency to daily
    await page.getByRole('combobox', { name: /frequency/i }).selectOption('daily')

    // Due date input should be disabled (grayed out) showing today
    const dueDateInput = page.locator('input[type="date"]')
    await expect(dueDateInput).toBeDisabled()

    // Today's date
    const today = new Date().toISOString().slice(0, 10)
    await expect(dueDateInput).toHaveValue(today)

    await page.getByRole('button', { name: 'Create Task' }).click()
    await expect(page.getByText(/recurring task created/i)).toBeVisible()
  })

  test('daily recurring task appears in table with Daily frequency', async ({ page }) => {
    const title = `Daily Checkup ${uid()}`

    await page.getByRole('button', { name: 'New Task', exact: true }).click()
    await page.getByLabel('Title *').fill(title)
    await page.getByRole('checkbox', { name: /recurring/i }).check()
    await page.getByRole('combobox', { name: /frequency/i }).selectOption('daily')
    await page.getByRole('button', { name: 'Create Task' }).click()

    await page.getByRole('link', { name: 'Recurring Tasks' }).click()
    await expect(page.getByText(title, { exact: true })).toBeVisible()
    await expect(page.getByText('Daily', { exact: true })).toBeVisible()
    await expect(page.getByText(/Next due:/)).toBeVisible()
  })

  test('create recurring task from Recurring Tasks page via New Template button', async ({ page }) => {
    const title = `Template Created ${uid()}`

    // Navigate to Recurring Tasks
    await page.getByRole('link', { name: 'Recurring Tasks' }).click()
    await page.waitForURL('**/recurring')

    // Click the "New Template" button
    await page.getByRole('button', { name: 'New Template' }).click()

    // The TaskCreateDrawer should open with "New Recurring Task" title
    await expect(page.getByText('New Recurring Task')).toBeVisible()

    // Recurring checkbox should be checked and disabled
    const recurringCheckbox = page.getByRole('checkbox', { name: /recurring/i })
    await expect(recurringCheckbox).toBeChecked()
    await expect(recurringCheckbox).toBeDisabled()

    // Fill in title and create
    await page.getByLabel('Title *').fill(title)
    await page.getByRole('button', { name: 'Create Template' }).click()

    await expect(page.getByText(/recurring task created/i)).toBeVisible()

    // Template appears in table
    await expect(page.getByRole('cell', { name: title })).toBeVisible()
  })

  test('recurring table shows recurring icon in status column', async ({ page }) => {
    const title = `Icon Test ${uid()}`

    await page.getByRole('button', { name: 'New Task', exact: true }).click()
    await page.getByLabel('Title *').fill(title)
    await page.getByRole('checkbox', { name: /recurring/i }).check()
    await page.getByRole('button', { name: 'Create Task' }).click()

    await page.getByRole('link', { name: 'Recurring Tasks' }).click()

    const row = page.getByRole('row', { name: new RegExp(title) })
    // The row contains the SVG recurring icon (aria-label="Recurring")
    await expect(row.getByLabel('Recurring')).toBeVisible()
  })
})
