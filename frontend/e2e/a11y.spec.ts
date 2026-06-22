import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { uid, registerAndLogin } from './helpers'

/**
 * NFR-09: Zero serious/critical axe violations on every main page.
 *
 * Pages: /login (unauth), / (task list), /archive, /recurring.
 *
 * The assertion intentionally fails if axe finds serious/critical violations —
 * a failing build here is honest signal that NFR-09 is not clean, not a reason
 * to relax the assertion.
 */

const BLOCKED_IMPACTS: ReadonlyArray<string> = ['serious', 'critical']

test.use({ reducedMotion: 'reduce' })

// Freeze all CSS animation/transition before scanning. `reducedMotion` alone
// does NOT reliably suppress the empty-state's arbitrary `animate-[fadeIn]`
// utility (Tailwind @layer + !important cascade), so axe would otherwise
// measure muted text mid-fade and report spurious contrast failures whose
// values change run-to-run. Injected un-layered with !important so it wins.
async function freezeAnimations(page: Page) {
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  })
}

// NFR-09 requires the scan at 320 / 768 / 1440 px.
const VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]

async function expectNoSeriousViolations(page: Page, label: string) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp)
    await freezeAnimations(page)
    const results = await new AxeBuilder({ page }).analyze()
    const violations = results.violations.filter(
      (v) => v.impact && BLOCKED_IMPACTS.includes(v.impact)
    )
    expect(
      violations,
      `axe found ${violations.length} serious/critical violation(s) on ${label} @${vp.width}px:\n` +
        violations.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')
    ).toHaveLength(0)
  }
}

test.describe('NFR-09 accessibility — axe scan', () => {
  test('login page has no serious/critical violations', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expectNoSeriousViolations(page, '/login')
  })

  test('task list page has no serious/critical violations', async ({ page }) => {
    await registerAndLogin(page, `a11y-tasks-${uid()}@example.com`, 'password123')
    await expect(page.getByText('No tasks yet').or(page.locator('table'))).toBeVisible()
    await expectNoSeriousViolations(page, '/')
  })

  test('archive page has no serious/critical violations', async ({ page }) => {
    await registerAndLogin(page, `a11y-archive-${uid()}@example.com`, 'password123')
    await page.goto('/archive')
    await expect(page.getByText('Archive is empty')).toBeVisible()
    await expectNoSeriousViolations(page, '/archive')
  })

  test('recurring page has no serious/critical violations', async ({ page }) => {
    await registerAndLogin(page, `a11y-recurring-${uid()}@example.com`, 'password123')
    await page.goto('/recurring')
    await expect(page.getByText('No recurring tasks')).toBeVisible()
    await expectNoSeriousViolations(page, '/recurring')
  })
})
