import { cn } from '@/lib/utils'
import type { TaskStatus } from '@/types/task'

const STATUS_CLASSES: Record<TaskStatus, string> = {
  todo: 'border-2 border-gray-400 bg-transparent hover:border-amber-500',
  in_progress: 'border-2 border-amber-500 bg-amber-100 hover:border-emerald-500',
  done: 'bg-emerald-500 border-2 border-emerald-500',
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'to do',
  in_progress: 'in progress',
  done: 'done',
}

interface TaskStatusCircleProps {
  status: TaskStatus
  onClick?: (e: React.MouseEvent) => void
  disabled?: boolean
}

export function TaskStatusCircle({ status, onClick, disabled }: TaskStatusCircleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-4 h-4 rounded-full flex-shrink-0 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        STATUS_CLASSES[status],
        disabled ? 'cursor-default' : 'cursor-pointer'
      )}
      aria-label={`Status: ${STATUS_LABEL[status]}`}
    >
      {status === 'done' && (
        <svg viewBox="0 0 12 12" className="w-full h-full p-[2px]" fill="none">
          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
