import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { useQueryClient } from '@tanstack/react-query'
import { TaskRow } from './TaskRow'
import { TaskTableHeader, DRAG_HANDLE_WIDTH, ACTIONS_COLUMN_WIDTH, EXPAND_COLUMN_WIDTH } from './TaskTableHeader'
import { TaskEmptyState } from './TaskEmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useColumnResize } from '@/hooks/useColumnResize'
import { useReorderTask, TASKS_QUERY_KEY } from '@/hooks/useTasks'
import { useDateGroups } from './useDateGroups'
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
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const dateGroups = useDateGroups(tasks)
  const { mutate: reorderTask } = useReorderTask()
  const queryClient = useQueryClient()

  const totalWidth =
    Object.values(widths).reduce((sum, w) => sum + w, 0) +
    (isEditMode ? CHECKBOX_COLUMN_WIDTH : DRAG_HANDLE_WIDTH + ACTIONS_COLUMN_WIDTH + EXPAND_COLUMN_WIDTH)

  const totalColumns = isEditMode ? 6 : 8

  const taskMap = useMemo(() => {
    const m = new Map<string, Task>()
    for (const t of tasks) m.set(t.id, t)
    return m
  }, [tasks])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setExpandedTaskId(null) // collapse any expanded row
    setActiveTask(taskMap.get(event.active.id as string) ?? null)
  }, [taskMap])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const movedTask = taskMap.get(active.id as string)
    const overTask = taskMap.get(over.id as string)
    if (!movedTask || !overTask) return

    // Find the group both tasks belong to
    const movedKey = movedTask.due_date ? movedTask.due_date.slice(0, 10) : '__no_date__'
    const overKey = overTask.due_date ? overTask.due_date.slice(0, 10) : '__no_date__'
    if (movedKey !== overKey) return // should not happen due to SortableContext isolation

    const group = dateGroups.find((g) => g.key === movedKey)
    if (!group) return

    // Compute new order: reorder the group array
    const ids = group.tasks.map((t) => t.id)
    const oldIndex = ids.indexOf(movedTask.id)
    const newIndex = ids.indexOf(overTask.id)
    if (oldIndex === -1 || newIndex === -1) return

    // Reorder
    ids.splice(oldIndex, 1)
    ids.splice(newIndex, 0, movedTask.id)

    // Optimistic update: update manual_order for all tasks in the group
    queryClient.setQueriesData<Task[]>(
      { queryKey: [TASKS_QUERY_KEY] },
      (old) => {
        if (!old) return old
        const updated = [...old]
        for (let i = 0; i < ids.length; i++) {
          const idx = updated.findIndex((t) => t.id === ids[i])
          if (idx !== -1) updated[idx] = { ...updated[idx], manual_order: i }
        }
        // Re-sort to reflect new order
        updated.sort((a, b) => {
          const da = a.due_date ?? '\uffff'
          const db = b.due_date ?? '\uffff'
          if (da !== db) return da < db ? -1 : 1
          return (a.manual_order ?? 0) - (b.manual_order ?? 0)
        })
        return updated
      }
    )

    // Persist: send the new order for the moved task
    reorderTask(
      { id: movedTask.id, payload: { manual_order: newIndex } },
      {
        onError: () => {
          void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] })
        },
      }
    )
  }, [taskMap, dateGroups, queryClient, reorderTask])

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
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="border border-border rounded-lg overflow-auto h-full">
        <table
          className="border-collapse"
          style={{ tableLayout: 'fixed', width: totalWidth, minWidth: totalWidth }}
        >
          <TaskTableHeader widths={widths} onStartDrag={startColumnDrag} isEditMode={isEditMode} />
          <tbody>
            {dateGroups.map((group) => {
              const groupIds = group.tasks.map((t) => t.id)
              const isSingleItem = group.tasks.length <= 1
              return (
                <SortableContext
                  key={group.key}
                  items={groupIds}
                  strategy={verticalListSortingStrategy}
                >
                  {group.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      columnWidths={widths}
                      isEditMode={isEditMode}
                      isSelected={selectedIds?.has(task.id)}
                      onToggleSelect={onToggleSelect}
                      isExpanded={expandedTaskId === task.id}
                      onToggleExpand={() => setExpandedTaskId((prev) => prev === task.id ? null : task.id)}
                      totalColumns={totalColumns}
                      isDragDisabled={isSingleItem}
                    />
                  ))}
                </SortableContext>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Drag overlay — renders a static row clone outside the table to avoid width collapse */}
      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <table
            className="border-collapse shadow-lg rounded"
            style={{ tableLayout: 'fixed', width: totalWidth, minWidth: totalWidth }}
          >
            <tbody>
              <TaskRow
                task={activeTask}
                columnWidths={widths}
                totalColumns={totalColumns}
                isDragDisabled
              />
            </tbody>
          </table>
        )}
      </DragOverlay>
    </DndContext>
  )
}
