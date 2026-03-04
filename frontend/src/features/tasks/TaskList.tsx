import { TaskRow } from './TaskRow'
import { TaskTableHeader } from './TaskTableHeader'
import { TaskEmptyState } from './TaskEmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useColumnResize } from '@/hooks/useColumnResize'
import type { Task, TaskFilterWindow } from '@/types/task'

// Fixed width for the checkbox column shown in edit mode
const CHECKBOX_COLUMN_WIDTH = 40

interface TaskListProps {
  tasks: Task[]
  isLoading?: boolean
  filterWindow?: TaskFilterWindow
  isTopicView?: boolean
  isSearch?: boolean
  searchQuery?: string
  onCreateTask?: () => void
  isEditMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export function TaskList({
  tasks,
  isLoading,
  filterWindow,
  isTopicView,
  isSearch,
  searchQuery,
  onCreateTask,
  isEditMode,
  selectedIds,
  onToggleSelect,
}: TaskListProps) {
  const { widths, startColumnDrag } = useColumnResize()

  const totalWidth =
    Object.values(widths).reduce((sum, w) => sum + w, 0) +
    (isEditMode ? CHECKBOX_COLUMN_WIDTH : 0)

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
      <table
        className="border-collapse"
        style={{ tableLayout: 'fixed', width: totalWidth, minWidth: totalWidth }}
      >
        <TaskTableHeader widths={widths} onStartDrag={startColumnDrag} isEditMode={isEditMode} />
        <tbody>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              columnWidths={widths}
              isEditMode={isEditMode}
              isSelected={selectedIds?.has(task.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
