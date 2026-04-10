import { cn } from '@/lib/utils'
import type { Subtask } from '@/types/task'
import { TaskStatusBadge } from './TaskStatusBadge'
import { SUBTASK_WRAPPER_CLASS } from './subtask-styles'

interface SubtaskListReadonlyProps {
  subtasks: Subtask[]
  className?: string
}

export function SubtaskListReadonly({ subtasks, className }: SubtaskListReadonlyProps) {
  return (
    <div className={cn(SUBTASK_WRAPPER_CLASS, className)}>
      {subtasks.map((subtask) => (
        <div
          key={subtask.id}
          className="flex items-center gap-3 px-4 py-1.5 border-b border-border/30 last:border-b-0"
        >
          <TaskStatusBadge status={subtask.status} size="sm" />
          <span
            className={cn(
              'text-sm',
              subtask.status === 'done' && 'line-through text-muted-foreground'
            )}
          >
            {subtask.title}
          </span>
        </div>
      ))}
    </div>
  )
}
