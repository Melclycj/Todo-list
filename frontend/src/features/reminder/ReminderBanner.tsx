import { useReminder } from '@/hooks/useReminder'

export function ReminderBanner() {
  const message = useReminder()

  if (!message) return null

  return (
    <div className="border-l-4 border-primary bg-accent px-3 py-2.5 mx-2 mt-2 mb-1 rounded-r-md">
      <p className="text-sm text-foreground leading-snug transition-opacity duration-300">
        {message}
      </p>
    </div>
  )
}
