import { TaskRow } from './TaskRow'
import { TaskTableHeader } from './TaskTableHeader'
import { TaskEmptyState } from './TaskEmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useColumnResize } from '@/hooks/useColumnResize'
import type { Task, TaskFilterWindow } from '@/types/task'

interface TaskListProps {
  tasks: Task[]
  isLoading?: boolean
  filterWindow?: TaskFilterWindow
  isTopicView?: boolean
  isSearch?: boolean
  searchQuery?: string
  onCreateTask?: () => void
}

export function TaskList({
  tasks,
  isLoading,
  filterWindow,
  isTopicView,
  isSearch,
  searchQuery,
  onCreateTask,
}: TaskListProps) {
  const { widths, startColumnDrag } = useColumnResize()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <TaskEmptyState
        window={filterWindow}
        isTopicView={isTopicView}
        isSearch={isSearch && !!searchQuery}
        onCreateTask={onCreateTask}
      />
    )
  }

  return (
    <div className="border border-border rounded-lg overflow-auto h-full">
      <table className="w-full border-collapse" style={{ minWidth: 780 }}>
        <TaskTableHeader widths={widths} onStartDrag={startColumnDrag} />
        <tbody>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} columnWidths={widths} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
