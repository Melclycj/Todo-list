import { type Page, expect } from '@playwright/test'

/** Unique suffix to isolate test data across runs */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

/** Register a new account and land on the home page */
export async function registerAndLogin(page: Page, email: string, password: string) {
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()

  // Redirected to login after registration
  await page.waitForURL('**/login')

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await page.waitForURL('**/')
}

/** Open the "New Task" drawer */
export async function openCreateTaskDrawer(page: Page) {
  await page.getByRole('button', { name: 'New Task', exact: true }).click()
  await expect(page.getByText('New Task').first()).toBeVisible()
}

/** Fill in the task title and submit */
export async function createTask(page: Page, title: string) {
  await openCreateTaskDrawer(page)
  await page.getByLabel('Title *').fill(title)
  await page.getByRole('button', { name: 'Create Task' }).click()
  await expect(page.getByText(title)).toBeVisible()
}
