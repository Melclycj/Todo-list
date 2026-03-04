import { cn } from '@/lib/utils'
import type { TaskStatus } from '@/types/task'

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-400',
  in_progress:
    'bg-amber-100 text-amber-700 border-amber-400 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-400',
  done: 'bg-emerald-100 text-emerald-700 border-emerald-400 hover:bg-gray-100 hover:text-gray-600 hover:border-gray-300',
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
}

interface TaskStatusBadgeProps {
  status: TaskStatus
  onClick?: (e: React.MouseEvent) => void
  disabled?: boolean
}

export function TaskStatusBadge({ status, onClick, disabled }: TaskStatusBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-2 py-0.5 rounded-full text-xs font-medium border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap',
        STATUS_STYLES[status],
        disabled ? 'cursor-default' : 'cursor-pointer'
      )}
      aria-label={`Status: ${STATUS_LABEL[status]}`}
    >
      {STATUS_LABEL[status]}
    </button>
  )
}
