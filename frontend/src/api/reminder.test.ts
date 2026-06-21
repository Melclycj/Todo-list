import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getAccessToken: vi.fn(() => null),
  setAccessToken: vi.fn(),
}))

import client, { getAccessToken } from './client'
import { getReminder, openReminderStream } from './reminder'

describe('reminder api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getReminder', () => {
    it('calls GET /reminder', async () => {
      vi.mocked(client.get).mockResolvedValue({ data: { success: true, data: { message: 'hi' } } })
      await getReminder()
      expect(client.get).toHaveBeenCalledWith('/reminder')
    })

    it('returns the response data', async () => {
      const response = { success: true, data: { message: 'Keep going!' }, error: null }
      vi.mocked(client.get).mockResolvedValue({ data: response })
      const result = await getReminder()
      expect(result).toEqual(response)
    })
  })

  describe('openReminderStream', () => {
    // A fetch whose stream never yields, so the connection stays "open" and
    // we can assert on how it was opened.
    function neverEndingFetch() {
      return vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => ({ read: () => new Promise(() => {}) }) },
      })
    }

    it('sends the access token in the Authorization header, never in the URL', () => {
      vi.mocked(getAccessToken).mockReturnValue('my-token')
      const fetchMock = neverEndingFetch()
      vi.stubGlobal('fetch', fetchMock)

      const handle = openReminderStream({ onMessage: () => {}, onError: () => {} })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/v1/reminder/stream')
      expect(url).not.toContain('token=') // security: token must not be in the URL
      expect(url).not.toContain('my-token') // the secret value must never appear in the URL
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer my-token')

      handle.close()
      vi.unstubAllGlobals()
    })

    it('omits the Authorization header when there is no access token', () => {
      vi.mocked(getAccessToken).mockReturnValue(null)
      const fetchMock = neverEndingFetch()
      vi.stubGlobal('fetch', fetchMock)

      const handle = openReminderStream({ onMessage: () => {}, onError: () => {} })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/v1/reminder/stream')
      expect(url).not.toContain('token=')
      expect((init.headers as Record<string, string>).Authorization).toBeUndefined()

      handle.close()
      vi.unstubAllGlobals()
    })
  })
})
