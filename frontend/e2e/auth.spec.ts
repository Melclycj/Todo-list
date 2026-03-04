import { test, expect } from '@playwright/test'
import { uid, registerAndLogin } from './helpers'

test.describe('Authentication', () => {
  test('register → login → logout', async ({ page }) => {
    const email = `test-${uid()}@example.com`
    const password = 'password123'

    // Register
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Create account' }).click()

    // Redirected to login
    await page.waitForURL('**/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

    // Login
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Landed on home page
    await page.waitForURL('**/')
    await expect(page.getByRole('heading', { name: /Active Tasks|All Tasks/i })).toBeVisible()

    // Logout
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL('**/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('duplicate email registration shows error', async ({ page }) => {
    const email = `dup-${uid()}@example.com`
    const password = 'password123'

    await registerAndLogin(page, email, password)

    // Sign out first
    await page.getByRole('button', { name: 'Sign out' }).click()

    // Try to register again with the same email
    await page.goto('/register')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText(/already|in use|exists/i)).toBeVisible()
  })

  test('invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('nobody@example.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText(/invalid/i)).toBeVisible()
  })

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL('**/login')
  })
})
