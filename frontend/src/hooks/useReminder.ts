import { useEffect, useRef, useState } from 'react'
import { getReminder, openReminderStream, type ReminderStreamHandle } from '@/api/reminder'

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000
const FALLBACK_POLL_MS = 60_000

export function useReminder() {
  const [message, setMessage] = useState<string>('')
  const mountedRef = useRef(false)
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<ReminderStreamHandle | null>(null)
  const usingFallbackRef = useRef(false)

  function clearTimers() {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
  }

  function startPollingFallback() {
    if (usingFallbackRef.current) return
    usingFallbackRef.current = true

    pollIntervalRef.current = setInterval(() => {
      if (!mountedRef.current) return
      void getReminder().then((res) => {
        if (mountedRef.current && res.data?.message) setMessage(res.data.message)
      })
    }, FALLBACK_POLL_MS)
  }

  function connect() {
    if (!mountedRef.current) return

    streamRef.current = openReminderStream({
      onMessage: (data: string) => {
        if (!mountedRef.current) return
        try {
          const parsed = JSON.parse(data) as { message: string }
          setMessage(parsed.message)
        } catch {
          setMessage(data)
        }
        retryCountRef.current = 0
      },
      onError: () => {
        streamRef.current?.close()
        streamRef.current = null

        if (!mountedRef.current) return

        if (retryCountRef.current >= MAX_RETRIES) {
          startPollingFallback()
          return
        }

        const delay = BASE_DELAY_MS * Math.pow(2, retryCountRef.current)
        retryCountRef.current += 1

        retryTimeoutRef.current = setTimeout(() => {
          connect()
        }, delay)
      },
    })
  }

  useEffect(() => {
    mountedRef.current = true

    // Fetch initial message immediately
    void getReminder().then((res) => {
      if (mountedRef.current && res.data?.message) setMessage(res.data.message)
    })

    connect()

    return () => {
      mountedRef.current = false
      streamRef.current?.close()
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return message
}
