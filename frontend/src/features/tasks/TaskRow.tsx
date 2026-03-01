import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types/task'
import { TaskStatusCircle } from './TaskStatusCircle'
import { TaskTopicTags } from './TaskTopicTags'
import { TaskDueDateDisplay } from './TaskDueDateDisplay'
import { TaskActionsMenu } from './TaskActionsMenu'
import { TaskRowExpanded } from './TaskRowExpanded'
import { useUpdateTaskStatus } from '@/hooks/useTasks'
import { toast } from 'sonner'

function nextStatus(current: TaskStatus): TaskStatus {
  if (current === 'todo') return 'in_progress'
  if (current === 'in_progress') return 'done'
  return 'done'
}

interface TaskRowProps {
  task: Task
  dragHandle?: React.ReactNode
}

export function TaskRow({ task, dragHandle }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false)
  const { mutate: updateStatus } = useUpdateTaskStatus()
  const isDone = task.status === 'done'

  function handleStatusClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (isDone) return

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
    <div className="group">
      {/* Row */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 border-b border-border hover:bg-muted/30 cursor-pointer transition-colors h-11',
          isDone && 'opacity-60'
        )}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {dragHandle && (
          <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {dragHandle}
          </span>
        )}

        <TaskStatusCircle status={task.status} onClick={handleStatusClick} />

        <span
          className={cn(
            'flex-1 text-sm truncate',
            isDone && 'line-through text-muted-foreground'
          )}
        >
          {task.title}
        </span>

        <div className="flex items-center gap-2 flex-shrink-0">
          <TaskTopicTags topics={task.topics} />
          <TaskDueDateDisplay dueDate={task.due_date} isDone={isDone} />
          <TaskActionsMenu
            taskId={task.id}
            taskTitle={task.title}
            onEdit={() => setExpanded(true)}
          />
        </div>
      </div>

      {/* Expanded inline editor */}
      {expanded && (
        <TaskRowExpanded task={task} onClose={() => setExpanded(false)} />
      )}
    </div>
  )
}
