import { useMemo } from 'react'
import { format, parseISO, startOfDay } from 'date-fns'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { TaskRow } from './TaskRow'
import { TaskEmptyState } from './TaskEmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useReorderTask } from '@/hooks/useTasks'
import { toast } from 'sonner'
import type { Task, TaskFilterWindow } from '@/types/task'

interface SortableTaskRowProps {
  task: Task
}

function SortableTaskRow({ task }: SortableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }

  const dragHandle = (
    <span
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing text-muted-foreground"
    >
      <GripVertical size={14} />
    </span>
  )

  return (
    <div ref={setNodeRef} style={style}>
      <TaskRow task={task} dragHandle={dragHandle} />
    </div>
  )
}

function groupByDate(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>()
  for (const task of tasks) {
    const key = task.due_date
      ? format(startOfDay(parseISO(task.due_date)), 'yyyy-MM-dd')
      : '__no_date__'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(task)
  }
  return groups
}

function DateGroupLabel({ dateKey }: { dateKey: string }) {
  if (dateKey === '__no_date__') {
    return (
      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border bg-background">
        No due date
      </div>
    )
  }
  return (
    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border bg-background">
      {format(parseISO(dateKey), 'EEEE, MMM d')}
    </div>
  )
}

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
  const { mutate: reorderTask } = useReorderTask()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const groups = useMemo(() => {
    const datedTasks = tasks.filter((t) => t.due_date !== null)
    const undatedTasks = tasks.filter((t) => t.due_date === null)
    const grouped = groupByDate(datedTasks)
    if (undatedTasks.length > 0) {
      grouped.set('__no_date__', undatedTasks)
    }
    return grouped
  }, [tasks])

  function handleDragEnd(event: DragEndEvent, groupTasks: Task[]) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeTask = groupTasks.find((t) => t.id === active.id)
    const overTask = groupTasks.find((t) => t.id === over.id)

    if (!activeTask || !overTask) return

    // Cross-date-group drag is not allowed (enforced by separate sortable contexts)
    if (activeTask.due_date !== overTask.due_date) {
      toast.error('Tasks can only be reordered within the same date')
      return
    }

    const overIndex = groupTasks.indexOf(overTask)
    reorderTask(
      { id: activeTask.id, payload: { manual_order: overIndex } },
      { onError: () => toast.error('Failed to save order') }
    )
  }

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
    <div className="border border-border rounded-lg overflow-hidden">
      {Array.from(groups.entries()).map(([dateKey, groupTasks]) => (
        <div key={dateKey}>
          <DateGroupLabel dateKey={dateKey} />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => handleDragEnd(event, groupTasks)}
          >
            <SortableContext
              items={groupTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {groupTasks.map((task) => (
                <SortableTaskRow key={task.id} task={task} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      ))}
    </div>
  )
}
