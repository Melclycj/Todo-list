import { test, expect } from '@playwright/test'
import { uid, registerAndLogin } from './helpers'

/**
 * FR-15: Reminder SSE stream authenticates end-to-end.
 *
 * This test verifies that after login the frontend's openReminderStream()
 * function sends the access token in the Authorization header and the backend
 * responds with 200 OK (not 401).
 *
 * The old bug: EventSource was used, which cannot set custom headers, so the
 * token ended up in the URL query string. The server returned 401, causing
 * a 60-second polling back-off. The fix moved to fetch() with an
 * "Authorization: Bearer <token>" header.
 *
 * Why waitForResponse is reliable here:
 *   Playwright intercepts the HTTP response at the header level, before the
 *   SSE body starts streaming. The predicate fires as soon as the server
 *   sends the response status line — no need to wait for the stream to close.
 *   We register the listener BEFORE the navigation that triggers the stream,
 *   so we never race the response.
 */
test.describe('FR-15 reminder stream authentication', () => {
  test('SSE stream returns 200 after login (not 401)', async ({ page }) => {
    // Set up the response waiter before any navigation so we capture the
    // very first stream request made after the app loads.
    const streamResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes('/reminder/stream') &&
        r.request().method() === 'GET',
      // Give the app time to mount and initiate the stream after login.
      // This is NOT a sleep — it's a max-wait on an observable network event.
      { timeout: 20_000 }
    )

    await registerAndLogin(page, `reminder-${uid()}@example.com`, 'password123')

    // The app should open the stream shortly after reaching the home page.
    // If the stream does not connect at all, waitForResponse will timeout
    // and the test will fail with a clear timeout message.
    const response = await streamResponsePromise

    expect(response.status()).toBe(200)
  })
})
