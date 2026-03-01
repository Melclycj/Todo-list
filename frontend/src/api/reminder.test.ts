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
import { getReminder, createReminderStream } from './reminder'

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

  describe('createReminderStream', () => {
    it('builds URL without token when no access token', () => {
      vi.mocked(getAccessToken).mockReturnValue(null)
      const MockEventSource = vi.fn()
      vi.stubGlobal('EventSource', MockEventSource)

      createReminderStream()

      expect(MockEventSource).toHaveBeenCalledWith(
        '/api/v1/reminder/stream',
        { withCredentials: true }
      )
      vi.unstubAllGlobals()
    })

    it('appends token query param when access token is set', () => {
      vi.mocked(getAccessToken).mockReturnValue('my-token')
      const MockEventSource = vi.fn()
      vi.stubGlobal('EventSource', MockEventSource)

      createReminderStream()

      expect(MockEventSource).toHaveBeenCalledWith(
        '/api/v1/reminder/stream?token=my-token',
        { withCredentials: true }
      )
      vi.unstubAllGlobals()
    })
  })
})
