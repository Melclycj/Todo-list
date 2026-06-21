import client, { getAccessToken } from './client'
import type { ApiResponse } from '@/types/api'

export async function getReminder(): Promise<ApiResponse<{ message: string }>> {
  const { data } = await client.get<ApiResponse<{ message: string }>>('/reminder')
  return data
}

export interface ReminderStreamHandle {
  close: () => void
}

interface ReminderStreamCallbacks {
  onMessage: (message: string) => void
  onError: (error: unknown) => void
}

/**
 * Open the reminder SSE stream over `fetch` (not `EventSource`) so the access
 * token travels in the `Authorization` header. `EventSource` cannot set
 * headers, which had forced the token into the URL query string — where it
 * leaks into server/proxy access logs, browser history, and Referer headers.
 * Here the token never leaves the header.
 *
 * Parses SSE `data:` frames (ignoring `:` keep-alive comments) and calls
 * `onMessage` per event; calls `onError` on HTTP/network failure or when the
 * stream closes. Returns a handle whose `close()` aborts the request.
 */
export function openReminderStream(callbacks: ReminderStreamCallbacks): ReminderStreamHandle {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
  const token = getAccessToken()
  const controller = new AbortController()

  const headers: Record<string, string> = { Accept: 'text/event-stream' }
  if (token) headers.Authorization = `Bearer ${token}`

  void (async () => {
    try {
      const res = await fetch(`${baseUrl}/reminder/stream`, {
        method: 'GET',
        headers,
        credentials: 'omit', // header-only auth — the stream does not use cookies
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        callbacks.onError(new Error(`Reminder stream failed: ${res.status}`))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      for (;;) {
        const { value, done } = await reader.read()
        if (done) {
          callbacks.onError(new Error('Reminder stream closed'))
          return
        }
        buffer += decoder.decode(value, { stream: true })

        // SSE frames are separated by a blank line.
        let sepIndex: number
        while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sepIndex)
          buffer = buffer.slice(sepIndex + 2)

          const data = frame
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).replace(/^ /, ''))
            .join('\n')

          if (data) callbacks.onMessage(data)
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return // intentional close on unmount / reconnect
      callbacks.onError(error)
    }
  })()

  return { close: () => controller.abort() }
}
