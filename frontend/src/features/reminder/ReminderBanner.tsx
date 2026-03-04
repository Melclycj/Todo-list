import { useReminder } from '@/hooks/useReminder'

export function ReminderBanner() {
  const message = useReminder()

  if (!message) return null

  return (
    <div className="border-l-2 border-primary bg-accent px-2 py-1.5 mt-2 rounded-r-md">
      <p className="text-xs text-foreground leading-snug">
        {message}
      </p>
    </div>
  )
}
