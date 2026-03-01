import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskDueDateDisplayProps {
  dueDate: string | null
  isDone?: boolean
}

export function TaskDueDateDisplay({ dueDate, isDone }: TaskDueDateDisplayProps) {
  if (!dueDate) return null

  const date = parseISO(dueDate)
  const overdue = !isDone && isPast(date)

  let label: string
  if (isToday(date)) {
    label = 'Today'
  } else if (isTomorrow(date)) {
    label = 'Tomorrow'
  } else {
    label = format(date, 'MMM d')
  }

  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-xs flex-shrink-0',
        overdue ? 'text-destructive' : 'text-muted-foreground'
      )}
    >
      {overdue && <AlertCircle size={11} />}
      {label}
    </span>
  )
}
