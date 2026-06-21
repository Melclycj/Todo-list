import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { uid, registerAndLogin } from './helpers'

/**
 * NFR-09: Zero serious/critical axe violations on every main page.
 *
 * Pages tested:
 *   1. /login   — unauthenticated
 *   2. /        — task list (authenticated)
 *   3. /archive — archive page (authenticated)
 *   4. /recurring — recurring tasks page (authenticated)
 *
 * The assertion intentionally fails if axe finds serious or critical
 * violations — a failing build here is honest signal that NFR-09 is not
 * clean, not a reason to relax the assertion.
 *
 * Why 'serious' | 'critical' only: axe 'moderate' and 'minor' issues often
 * require manual context judgment; blocking CI on them produces noise. The
 * testing-policy rule requires failing on CRITICAL axe violations; this test
 * also catches SERIOUS to be conservative.
 */

const BLOCKED_IMPACTS: ReadonlyArray<string> = ['serious', 'critical']

// Run a11y scans with animations disabled so axe never measures contrast
// mid-fade (e.g. the empty-state fade-in renders muted text semi-transparent,
// which is a scan-timing artifact, not a real contrast failure).
test.use({ reducedMotion: 'reduce' })

test.describe('NFR-09 accessibility — axe scan', () => {
  test('login page has no serious/critical violations', async ({ page }) => {
    await page.goto('/login')
    // Wait for the page to finish hydrating before scanning
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()
    const violations = results.violations.filter(
      (v) => v.impact && BLOCKED_IMPACTS.includes(v.impact)
    )
    expect(
      violations,
      `axe found ${violations.length} serious/critical violation(s) on /login:\n` +
        violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')
    ).toHaveLength(0)
  })

  test('task list page has no serious/critical violations', async ({ page }) => {
    await registerAndLogin(page, `a11y-tasks-${uid()}@example.com`, 'password123')

    // Wait for the task list to fully render (empty state or table)
    await expect(
      page.getByText('No tasks yet').or(page.locator('table'))
    ).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()
    const violations = results.violations.filter(
      (v) => v.impact && BLOCKED_IMPACTS.includes(v.impact)
    )
    expect(
      violations,
      `axe found ${violations.length} serious/critical violation(s) on /:\n` +
        violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')
    ).toHaveLength(0)
  })

  test('archive page has no serious/critical violations', async ({ page }) => {
    await registerAndLogin(page, `a11y-archive-${uid()}@example.com`, 'password123')
    await page.goto('/archive')

    // Wait for the page heading to render. Do NOT use networkidle — the
    // reminder SSE stream stays open, so the page never reaches network idle.
    await expect(page.getByRole('heading').first()).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()
    const violations = results.violations.filter(
      (v) => v.impact && BLOCKED_IMPACTS.includes(v.impact)
    )
    expect(
      violations,
      `axe found ${violations.length} serious/critical violation(s) on /archive:\n` +
        violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')
    ).toHaveLength(0)
  })

  test('recurring page has no serious/critical violations', async ({ page }) => {
    await registerAndLogin(page, `a11y-recurring-${uid()}@example.com`, 'password123')
    await page.goto('/recurring')

    // Avoid networkidle — the reminder SSE stream stays open.
    await expect(page.getByRole('heading').first()).toBeVisible()

    const results = await new AxeBuilder({ page }).analyze()
    const violations = results.violations.filter(
      (v) => v.impact && BLOCKED_IMPACTS.includes(v.impact)
    )
    expect(
      violations,
      `axe found ${violations.length} serious/critical violation(s) on /recurring:\n` +
        violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')
    ).toHaveLength(0)
  })
})
