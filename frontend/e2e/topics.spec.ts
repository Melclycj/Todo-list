import { test, expect } from '@playwright/test'
import { uid, registerAndLogin, createTask } from './helpers'

test.describe('Topic Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page, `topics-${uid()}@example.com`, 'password123')
  })

  test('create a topic via the sidebar', async ({ page }) => {
    const topicName = `Topic ${uid()}`

    await page.getByRole('button', { name: 'Add topic' }).click()
    await page.getByPlaceholder('Topic name…').fill(topicName)
    await page.getByPlaceholder('Topic name…').press('Enter')

    await expect(page.getByText(topicName)).toBeVisible()
  })

  test('assign a topic to a task and filter by topic', async ({ page }) => {
    const topicName = `Filter Topic ${uid()}`
    const taskTitle = `Tagged Task ${uid()}`
    const otherTask = `Untagged Task ${uid()}`

    // Create topic in sidebar
    await page.getByRole('button', { name: 'Add topic' }).click()
    await page.getByPlaceholder('Topic name…').fill(topicName)
    await page.getByPlaceholder('Topic name…').press('Enter')
    await expect(page.getByText(topicName)).toBeVisible()

    // Create two tasks
    await createTask(page, otherTask)
    await createTask(page, taskTitle)

    // Edit tagged task to assign the topic
    await page.getByText(taskTitle).click()
    await page.getByRole('button', { name: topicName }).click() // topic pill in form
    await page.getByRole('button', { name: 'Save changes' }).click()

    // Navigate to the topic filter via sidebar
    await page.locator('a', { hasText: topicName }).click()

    // Only the tagged task should appear
    await expect(page.getByText(taskTitle)).toBeVisible()
    await expect(page.getByText(otherTask)).not.toBeVisible()
  })

  test('rename a topic', async ({ page }) => {
    const original = `Rename Me ${uid()}`
    const renamed = `Renamed ${uid()}`

    await page.getByRole('button', { name: 'Add topic' }).click()
    await page.getByPlaceholder('Topic name…').fill(original)
    await page.getByPlaceholder('Topic name…').press('Enter')

    // Hover the topic to reveal the ... menu
    const topicItem = page.locator('a', { hasText: original })
    await topicItem.hover()
    await topicItem.getByRole('button').click()
    await page.getByRole('menuitem', { name: 'Rename' }).click()

    // The name becomes an input — clear and type new name
    const input = page.getByRole('navigation').locator('input')
    await input.clear()
    await input.fill(renamed)
    await input.press('Enter')

    await expect(page.getByText(renamed)).toBeVisible()
    await expect(page.getByText(original)).not.toBeVisible()
  })

  test('delete a topic — tasks remain', async ({ page }) => {
    const topicName = `Delete Topic ${uid()}`
    const taskTitle = `Has Topic ${uid()}`

    // Create topic and task
    await page.getByRole('button', { name: 'Add topic' }).click()
    await page.getByPlaceholder('Topic name…').fill(topicName)
    await page.getByPlaceholder('Topic name…').press('Enter')
    await createTask(page, taskTitle)

    // Assign topic to task
    await page.getByText(taskTitle).click()
    await page.getByRole('button', { name: topicName }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()

    // Delete the topic
    const topicItem = page.locator('a', { hasText: topicName })
    await topicItem.hover()
    await topicItem.getByRole('button').click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete' }).click()

    // Topic gone from sidebar
    await expect(page.getByRole('navigation').getByText(topicName)).not.toBeVisible()

    // Navigate home via sidebar link (avoids page.goto which clears in-memory auth)
    await page.getByRole('link', { name: 'Active Tasks' }).click()

    // Task still exists on home page
    await expect(page.getByText(taskTitle)).toBeVisible()
  })
})
