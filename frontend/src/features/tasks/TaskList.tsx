import { useState, useCallback, useMemo, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { useQueryClient } from '@tanstack/react-query'
import { TaskRow } from './TaskRow'
import { TaskTableHeader, GRIP_COLUMN_WIDTH, EXPAND_COLUMN_WIDTH } from './TaskTableHeader'
import { TaskEmptyState } from './TaskEmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useColumnResize } from '@/hooks/useColumnResize'
import { useBatchReorder, TASKS_QUERY_KEY } from '@/hooks/useTasks'
import { useDateGroups } from './useDateGroups'
import type { Task, TaskFilterWindow } from '@/types/task'
import type { ApiResponse } from '@/types/api'
import { toast } from 'sonner'

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
  /**
   * Signature representing the current filter identity (filter window,
   * topic, search query, etc.). When it changes, every row is remounted
   * so the fade-in animation replays even if the task set is identical.
   */
  filterKey?: string
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
  filterKey,
}: TaskListProps) {
  const { widths, startColumnDrag } = useColumnResize()
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{ overId: string; placement: 'above' | 'below' } | null>(null)
  const dateGroups = useDateGroups(tasks)
  const { mutate: batchReorder } = useBatchReorder()
  const queryClient = useQueryClient()

  // Track filter identity. When filterKey changes, bump a counter that we
  // prepend to each row's React key. That forces every row to unmount and
  // remount, which replays the `animate-fadeInRow` CSS animation — even on
  // rows whose task ids are unchanged between the old and new filter. This
  // is the fix for the stale-DOM bug where persisting rows never re-faded.
  //
  // Writing refs during render is a documented React pattern for "derived
  // values that should change only when some input changes" and avoids the
  // extra render that useState+useEffect would cause.
  const prevFilterKeyRef = useRef<string | undefined>(filterKey)
  const animationCounterRef = useRef(0)
  if (prevFilterKeyRef.current !== filterKey) {
    animationCounterRef.current++
    prevFilterKeyRef.current = filterKey
  }
  const animationKey = animationCounterRef.current

  // Require 5px movement before activating drag — allows click to open context menu
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  })
  const sensors = useSensors(pointerSensor)

  const totalWidth =
    Object.values(widths).reduce((sum, w) => sum + w, 0) +
    (isEditMode ? CHECKBOX_COLUMN_WIDTH : GRIP_COLUMN_WIDTH + EXPAND_COLUMN_WIDTH)

  const totalColumns = isEditMode ? 6 : 7

  const taskMap = useMemo(() => {
    const m = new Map<string, Task>()
    for (const t of tasks) m.set(t.id, t)
    return m
  }, [tasks])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setExpandedTaskId(null) // collapse any expanded row
    setActiveTask(taskMap.get(event.active.id as string) ?? null)
    setDropIndicator(null)
  }, [taskMap])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      setDropIndicator(null)
      return
    }
    const movedTask = taskMap.get(active.id as string)
    const overTask = taskMap.get(over.id as string)
    if (!movedTask || !overTask) {
      setDropIndicator(null)
      return
    }
    const movedKey = movedTask.due_date ? movedTask.due_date.slice(0, 10) : '__no_date__'
    const overKey = overTask.due_date ? overTask.due_date.slice(0, 10) : '__no_date__'
    if (movedKey !== overKey) {
      setDropIndicator(null)
      return
    }
    const group = dateGroups.find((g) => g.key === movedKey)
    if (!group) {
      setDropIndicator(null)
      return
    }
    const aIdx = group.tasks.findIndex((t) => t.id === movedTask.id)
    const oIdx = group.tasks.findIndex((t) => t.id === overTask.id)
    if (aIdx === -1 || oIdx === -1) {
      setDropIndicator(null)
      return
    }
    // Dragging down → insert after over-row (line on its bottom edge).
    // Dragging up → insert before over-row (line on its top edge).
    setDropIndicator({ overId: overTask.id, placement: aIdx < oIdx ? 'below' : 'above' })
  }, [taskMap, dateGroups])

  const applyOrder = useCallback(
    (orderedIds: string[]) => {
      // Optimistic update: the query cache stores the full ApiResponse wrapper
      // (useTasks unwraps it via `select` at read time), so we reach into
      // `.data` when updating. Spreading `old` directly would throw
      // `TypeError: old is not iterable` on the wrapper object.
      queryClient.setQueriesData<ApiResponse<Task[]>>(
        { queryKey: [TASKS_QUERY_KEY] },
        (old) => {
          if (!old?.data) return old
          const updated = [...old.data]
          for (let i = 0; i < orderedIds.length; i++) {
            const idx = updated.findIndex((t) => t.id === orderedIds[i])
            if (idx !== -1) updated[idx] = { ...updated[idx], manual_order: i }
          }
          updated.sort((a, b) => {
            const da = a.due_date ?? '\uffff'
            const db = b.due_date ?? '\uffff'
            if (da !== db) return da < db ? -1 : 1
            const oa = a.manual_order ?? 0
            const ob = b.manual_order ?? 0
            if (oa !== ob) return oa - ob
            return (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1
          })
          return { ...old, data: updated }
        }
      )

      // Persist: send all tasks in the group with their new manual_order
      batchReorder(
        orderedIds.map((id, i) => ({ id, manual_order: i })),
        {
          onError: () => {
            void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] })
          },
        }
      )
    },
    [queryClient, batchReorder]
  )

  // Keyboard-accessible reorder: move a task up/down within its date group.
  // dnd-kit's keyboard sensor conflicts with the grip's menu trigger, so this
  // is an explicit Alt+Arrow path; both it and pointer drag use applyOrder.
  const moveTask = useCallback(
    (taskId: string, direction: 'up' | 'down') => {
      const group = dateGroups.find((g) => g.tasks.some((t) => t.id === taskId))
      if (!group || group.tasks.length < 2) return
      const ids = group.tasks.map((t) => t.id)
      const idx = ids.indexOf(taskId)
      const target = direction === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= ids.length) return
      const prevOrder = [...ids]
      const newOrder = [...ids]
      ;[newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]]
      applyOrder(newOrder)
      toast('Task moved', {
        action: { label: 'Undo', onClick: () => applyOrder(prevOrder) },
      })
    },
    [dateGroups, applyOrder]
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTask(null)
    setDropIndicator(null)
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

    const ids = group.tasks.map((t) => t.id)
    const oldIndex = ids.indexOf(movedTask.id)
    const newIndex = ids.indexOf(overTask.id)
    if (oldIndex === -1 || newIndex === -1) return

    // Snapshot the pre-reorder order so the move can be undone.
    const prevOrder = [...ids]

    // Compute the new order
    const newOrder = [...ids]
    newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, movedTask.id)

    applyOrder(newOrder)

    toast('Tasks reordered', {
      action: {
        label: 'Undo',
        onClick: () => applyOrder(prevOrder),
      },
    })
  }, [taskMap, dateGroups, applyOrder])

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

  // Build a global stagger index across all date groups
  let globalIndex = 0

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveTask(null); setDropIndicator(null) }}
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
                  {group.tasks.map((task) => {
                    const staggerIdx = globalIndex++
                    const indicator =
                      dropIndicator?.overId === task.id ? dropIndicator.placement : null
                    return (
                      <TaskRow
                        key={`${animationKey}:${task.id}`}
                        task={task}
                        columnWidths={widths}
                        isEditMode={isEditMode}
                        isSelected={selectedIds?.has(task.id)}
                        onToggleSelect={onToggleSelect}
                        isExpanded={expandedTaskId === task.id}
                        onToggleExpand={() => setExpandedTaskId((prev) => prev === task.id ? null : task.id)}
                        totalColumns={totalColumns}
                        isDragDisabled={isSingleItem}
                        staggerIndex={staggerIdx}
                        dropIndicator={indicator}
                        onKeyboardReorder={moveTask}
                      />
                    )
                  })}
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
