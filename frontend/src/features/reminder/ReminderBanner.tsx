import { useEffect, useRef, useState } from 'react'
import { useReminder } from '@/hooks/useReminder'

export function ReminderBanner() {
  const message = useReminder()
  const [displayedMessage, setDisplayedMessage] = useState(message)
  const [fading, setFading] = useState(false)
  const prevMessage = useRef(message)

  useEffect(() => {
    if (message === prevMessage.current) return
    prevMessage.current = message

    // Fade out, swap text, fade in
    setFading(true)
    const timer = setTimeout(() => {
      setDisplayedMessage(message)
      setFading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [message])

  if (!displayedMessage) return null

  return (
    <div className="border-l-2 border-primary bg-accent px-2 py-1.5 mt-2 rounded-r-md">
      <p
        className="text-xs text-foreground leading-snug transition-opacity duration-300"
        style={{ opacity: fading ? 0 : 1 }}
      >
        {displayedMessage}
      </p>
    </div>
  )
}
