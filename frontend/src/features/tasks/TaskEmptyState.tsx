import { CheckSquare, Calendar, CalendarDays, Tag, Search, Archive, Repeat } from 'lucide-react'
import type { TaskFilterWindow } from '@/types/task'

interface TaskEmptyStateProps {
  window?: TaskFilterWindow
  isTopicView?: boolean
  isSearch?: boolean
  isArchive?: boolean
  isRecurring?: boolean
  onCreateTask?: () => void
}

export function TaskEmptyState({
  window: filterWindow,
  isTopicView,
  isSearch,
  isArchive,
  isRecurring,
  onCreateTask,
}: TaskEmptyStateProps) {
  let icon = <CheckSquare size={32} className="text-muted-foreground/50" />
  let heading = 'No tasks yet'
  let description = 'Create your first task to get started.'

  if (isSearch) {
    icon = <Search size={32} className="text-muted-foreground/50" />
    heading = 'No results found'
    description = 'Try a different search term.'
  } else if (isArchive) {
    icon = <Archive size={32} className="text-muted-foreground/50" />
    heading = 'Archive is empty'
    description = 'Completed tasks will appear here after the 4am cycle.'
  } else if (isRecurring) {
    icon = <Repeat size={32} className="text-muted-foreground/50" />
    heading = 'No recurring tasks'
    description = 'Set up a recurring task to automate your routine.'
  } else if (isTopicView) {
    icon = <Tag size={32} className="text-muted-foreground/50" />
    heading = 'No tasks in this topic'
    description = 'Assign tasks to this topic to see them here.'
  } else if (filterWindow === 'today') {
    icon = <Calendar size={32} className="text-muted-foreground/50" />
    heading = 'Nothing due today'
    description = 'Enjoy your free time, or plan ahead.'
  } else if (filterWindow === '3days' || filterWindow === 'week') {
    icon = <CalendarDays size={32} className="text-muted-foreground/50" />
    heading = 'All clear for now'
    description = 'No tasks due in this window.'
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {icon}
      <div>
        <p className="font-medium text-foreground">{heading}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {onCreateTask && !isSearch && !isArchive && !isRecurring && (
        <button
          onClick={onCreateTask}
          className="text-sm text-primary hover:underline mt-1"
        >
          + New Task
        </button>
      )}
    </div>
  )
}
