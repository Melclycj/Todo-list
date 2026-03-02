import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types/task'
import type { ColumnKey } from '@/hooks/useColumnResize'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TaskActionsMenu } from './TaskActionsMenu'
import { TaskRowExpanded } from './TaskRowExpanded'
import { useUpdateTaskStatus } from '@/hooks/useTasks'
import { toast } from 'sonner'

function nextStatus(current: TaskStatus): TaskStatus {
  if (current === 'in_progress') return 'done'
  if (current === 'done') return 'todo'
  return 'in_progress' // todo → in_progress
}

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return '—'
  return format(parseISO(dueDate), 'MMM d, yyyy')
}

interface TaskRowProps {
  task: Task
  columnWidths: Record<ColumnKey, number>
}

export function TaskRow({ task, columnWidths }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false)
  const { mutate: updateStatus } = useUpdateTaskStatus()
  const isDone = task.status === 'done'

  function handleStatusClick(e: React.MouseEvent) {
    e.stopPropagation()
    const next = nextStatus(task.status)
    updateStatus(
      { id: task.id, payload: { status: next } },
      {
        onSuccess: () => {
          if (next === 'done') toast.success('Task completed')
        },
        onError: () => toast.error('Failed to update status'),
      }
    )
  }

  return (
    <>
      <tr
        className={cn(
          'border-b border-border hover:bg-muted/30 transition-colors cursor-pointer',
          isDone && 'opacity-60'
        )}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {/* Status */}
        <td style={{ width: columnWidths.status }} className="px-3 py-2">
          <TaskStatusBadge status={task.status} onClick={handleStatusClick} />
        </td>

        {/* Title */}
        <td style={{ width: columnWidths.title }} className="px-3 py-2">
          <span
            className={cn('text-sm', isDone && 'line-through text-muted-foreground')}
          >
            {task.title}
          </span>
        </td>

        {/* Due Date */}
        <td
          style={{ width: columnWidths.dueDate }}
          className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap"
        >
          {formatDueDate(task.due_date)}
        </td>

        {/* Description */}
        <td
          style={{ width: columnWidths.description }}
          className="px-3 py-2 text-sm text-muted-foreground"
        >
          {task.description || '—'}
        </td>

        {/* Actions */}
        <td
          className="px-2 py-2 w-10"
          onClick={(e) => e.stopPropagation()}
        >
          <TaskActionsMenu
            taskId={task.id}
            taskTitle={task.title}
            onEdit={() => setExpanded(true)}
          />
        </td>
      </tr>

      {/* Inline editor row */}
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0">
            <TaskRowExpanded task={task} onClose={() => setExpanded(false)} />
          </td>
        </tr>
      )}
    </>
  )
}
