import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO, isPast } from 'date-fns'
import { ChevronRight, ChevronDown, AlertCircle } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types/task'
import type { ColumnKey } from '@/hooks/useColumnResize'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TaskTopicSelector } from './TaskTopicSelector'
import { RowContextMenu, TASK_DELETE_ACTION, TASK_ADD_SUBTASK_ACTION } from './RowContextMenu'
import { BulkDeleteDialog } from './BulkDeleteDialog'
import { SubtaskTable } from './SubtaskTable'
import { GRIP_COLUMN_WIDTH, EXPAND_COLUMN_WIDTH } from './TaskTableHeader'
import { useUpdateTaskStatus, useUpdateTask, useDeleteTask } from '@/hooks/useTasks'
import { toast } from 'sonner'

function nextStatus(current: TaskStatus): TaskStatus {
  if (current === 'in_progress') return 'done'
  if (current === 'done') return 'todo'
  return 'in_progress'
}

export interface EditableCellProps {
  inputValue: string
  displayText: string
  placeholder?: string
  inputType?: 'text' | 'date'
  /** Render the editor as an inline auto-resizing textarea. */
  multiline?: boolean
  /**
   * Render the editor as a Popover overlay anchored to the cell.
   * Implies multiline textarea. Max width is min(500px, 90vw).
   * Click outside → commit. Escape → cancel.
   */
  popupEdit?: boolean
  onSave: (value: string) => void
  textClassName?: string
  disabled?: boolean
}

export function EditableCell({
  inputValue,
  displayText,
  placeholder = '—',
  inputType = 'text',
  multiline,
  popupEdit,
  onSave,
  textClassName,
  disabled,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(inputValue)
  const spanRef = useRef<HTMLSpanElement>(null)
  // Ref to the floating editor so the mousedown-outside handler can read its value
  const popupRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const [floatStyle, setFloatStyle] = useState<React.CSSProperties>({})

  // ── mousedown-outside closes popup ───────────────────────────────────────
  // Using mousedown (not blur) so that horizontal scrolling the table never
  // accidentally closes the editor — scroll events do not trigger mousedown.
  useEffect(() => {
    if (!editing || !popupEdit) return
    function handleMouseDown(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        const val = popupRef.current.value
        setEditing(false)
        if (val !== inputValue) onSave(val)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [editing, popupEdit, inputValue, onSave])

  function commitInline() {
    setEditing(false)
    if (draft !== inputValue) onSave(draft)
  }

  function cancel() {
    setDraft(inputValue)
    setEditing(false)
  }

  function autoResize(el: HTMLTextAreaElement | null) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  function startEdit(e: React.MouseEvent) {
    if (disabled) return
    e.stopPropagation()
    setDraft(inputValue)

    if (popupEdit && spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      // Width = same as the description column, capped at 90vw
      const width = Math.min(rect.width, vw * 0.9)
      // If the column's right edge is off-screen, flush the popup to the
      // viewport's right edge. Otherwise anchor it to the cell's position.
      const isRightEdgeVisible = rect.right <= vw
      const left = isRightEdgeVisible ? rect.left : vw - width
      setFloatStyle({ position: 'fixed', top: rect.top, left, width })
    }

    setEditing(true)
  }

  const displaySpan = (
    <span
      ref={spanRef}
      onClick={startEdit}
      className={cn(
        'block min-h-[1.25rem] rounded px-0.5 -mx-0.5 text-sm leading-5 whitespace-pre-wrap',
        disabled ? 'cursor-not-allowed' : 'cursor-text hover:bg-accent/40',
        textClassName
      )}
    >
      {displayText || (
        <span className="text-muted-foreground/40 italic text-xs">{placeholder}</span>
      )}
    </span>
  )

  // ── Popup mode ────────────────────────────────────────────────────────────
  // Portal renders outside the table so overflow:auto never clips it.
  // position:fixed keeps it in viewport space regardless of scroll.
  // Anchored to cell when visible, flush to viewport right edge otherwise.
  // mousedown-outside saves; Escape cancels.
  if (popupEdit) {
    const useTextarea = inputType === 'text' && multiline

    return (
      <>
        {displaySpan}
        {editing && createPortal(
          useTextarea ? (
            <textarea
              ref={(el) => { popupRef.current = el; autoResize(el) }}
              value={draft}
              autoFocus
              rows={1}
              onChange={(e) => { setDraft(e.target.value); autoResize(e.target) }}
              onKeyDown={(e) => { if (e.key === 'Escape') cancel() }}
              onClick={(e) => e.stopPropagation()}
              style={{ ...floatStyle, zIndex: 9999 }}
              className="bg-background border border-ring rounded px-0.5 py-0 text-sm focus:outline-none resize-none overflow-hidden leading-5 shadow-md"
            />
          ) : (
            <input
              ref={(el) => { popupRef.current = el }}
              type={inputType}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancel()
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setEditing(false)
                  if (draft !== inputValue) onSave(draft)
                }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{ ...floatStyle, zIndex: 9999 }}
              className="bg-background border border-ring rounded px-1.5 py-0.5 text-sm focus:outline-none shadow-md"
            />
          ),
          document.body
        )}
      </>
    )
  }

  // ── Inline multiline (textarea) ───────────────────────────────────────────
  if (editing && multiline) {
    return (
      <textarea
        ref={autoResize}
        value={draft}
        autoFocus
        rows={1}
        onChange={(e) => { setDraft(e.target.value); autoResize(e.target) }}
        onBlur={commitInline}
        onKeyDown={(e) => { if (e.key === 'Escape') cancel() }}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-background ring-1 ring-ring rounded px-0.5 py-0 text-sm focus:outline-none resize-none overflow-hidden leading-5"
      />
    )
  }

  // ── Inline single-line (input) ────────────────────────────────────────────
  if (editing) {
    return (
      <input
        type={inputType}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitInline}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel()
          if (e.key === 'Enter') { e.preventDefault(); commitInline() }
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-background border border-ring rounded px-1.5 py-0.5 text-sm focus:outline-none"
      />
    )
  }

  return displaySpan
}

function getDerivedStatusLabel(task: Task): string | undefined {
  if (task.subtask_count === 0) return undefined
  if (task.subtask_done_count === 0) return 'Not started'
  if (task.subtask_done_count === task.subtask_count) return 'Done'
  return `In progress: ${task.subtask_done_count}/${task.subtask_count}`
}

function getDerivedStatus(task: Task): TaskStatus {
  if (task.subtask_count === 0) return task.status
  if (task.subtask_done_count === 0) return 'todo'
  if (task.subtask_done_count === task.subtask_count) return 'done'
  return 'in_progress'
}

interface TaskRowProps {
  task: Task
  columnWidths: Record<ColumnKey, number>
  isEditMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
  isExpanded?: boolean
  onToggleExpand?: () => void
  totalColumns?: number
  isDragDisabled?: boolean
  /** Index for staggered fade-in animation on filter change */
  staggerIndex?: number
}

export function TaskRow({ task, columnWidths, isEditMode, isSelected, onToggleSelect, isExpanded, onToggleExpand, totalColumns = 7, isDragDisabled, staggerIndex }: TaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isDragDisabled || isEditMode })
  const { mutate: updateStatus } = useUpdateTaskStatus()
  const { mutate: updateTask } = useUpdateTask(task.id)
  const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingNewSubtask, setPendingNewSubtask] = useState(false)
  const hasSubtasks = task.subtask_count > 0
  const derivedLabel = getDerivedStatusLabel(task)
  const derivedStatus = getDerivedStatus(task)
  const isDone = hasSubtasks ? derivedStatus === 'done' : task.status === 'done'

  // Clear ephemeral row when task is collapsed
  useEffect(() => {
    if (!isExpanded) setPendingNewSubtask(false)
  }, [isExpanded])

  const cancelPendingSubtask = useCallback(() => {
    setPendingNewSubtask(false)
    // If task has no real subtasks, collapse it back
    if (task.subtask_count === 0) onToggleExpand?.()
  }, [task.subtask_count, onToggleExpand])

  function handleStatusClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (hasSubtasks) return // status is derived from subtasks
    const next = nextStatus(task.status)
    updateStatus(
      { id: task.id, payload: { status: next } },
      {
        onSuccess: () => { if (next === 'done') toast.success('Task completed') },
        onError: () => toast.error('Failed to update status'),
      }
    )
  }

  function handleAddSubtask() {
    setPendingNewSubtask(true)
    if (!isExpanded) onToggleExpand?.()
  }

  function saveField(payload: { title?: string; due_date?: string | null; description?: string | null }) {
    updateTask(payload, { onError: () => toast.error('Failed to save') })
  }

  const dueDateInputValue = task.due_date ? task.due_date.slice(0, 10) : ''
  const dueDateDisplay = task.due_date ? format(parseISO(task.due_date), 'MMM d, yyyy') : ''
  const isOverdue = !isDone && !!task.due_date && isPast(parseISO(task.due_date))

  return (
    <>
      <tr
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.4 : undefined,
          ...(staggerIndex != null ? { animationDelay: `${staggerIndex * 40}ms` } : {}),
        }}
        className={cn(
          'group border-b border-border hover:bg-muted/40 transition-colors',
          isDone && 'opacity-60',
          staggerIndex != null && 'animate-fadeInRow'
        )}
      >
        {/* Checkbox (edit mode only) */}
        {isEditMode && (
          <td className="px-3 py-2 w-10" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect?.(task.id)}
              className="accent-primary h-4 w-4 cursor-pointer"
            />
          </td>
        )}

        {/* Grip icon — click opens menu, hold+drag reorders */}
        {!isEditMode && (
          <td style={{ width: GRIP_COLUMN_WIDTH }} className="py-2 pl-2 pr-0">
            <RowContextMenu
              actions={[
                TASK_DELETE_ACTION(() => setConfirmDelete(true)),
                TASK_ADD_SUBTASK_ACTION(handleAddSubtask),
              ]}
              dragAttributes={attributes}
              dragListeners={listeners}
              hidden={isDragDisabled}
            />
          </td>
        )}

        {/* Expand/collapse indicator */}
        {!isEditMode && (
          <td style={{ width: EXPAND_COLUMN_WIDTH }} className="py-2 px-0">
            {(hasSubtasks || pendingNewSubtask) ? (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleExpand?.() }}
                className="p-0.5 rounded hover:bg-accent/40 transition-colors"
                aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
              >
                {isExpanded
                  ? <ChevronDown size={14} className="text-muted-foreground" />
                  : <ChevronRight size={14} className="text-muted-foreground" />
                }
              </button>
            ) : null}
          </td>
        )}

        {/* Status */}
        <td style={{ width: columnWidths.status }} className="px-3 py-2">
          <TaskStatusBadge
            status={hasSubtasks ? derivedStatus : task.status}
            label={derivedLabel}
            onClick={handleStatusClick}
            disabled={hasSubtasks}
          />
        </td>

        {/* Title */}
        <td style={{ width: columnWidths.title }} className="px-3 py-2">
          {task.recurring_template_id ? (
            <span
              role="button"
              tabIndex={0}
              onClick={() => toast.info('Titles of recurring task instances cannot be changed')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  toast.info('Titles of recurring task instances cannot be changed')
                }
              }}
              className={cn(
                'cursor-not-allowed block min-h-[1.25rem] rounded px-0.5 -mx-0.5 text-sm select-none',
                isDone ? 'line-through text-muted-foreground' : ''
              )}
            >
              {task.title}
            </span>
          ) : (
            <EditableCell
              inputValue={task.title}
              displayText={task.title}
              placeholder="Task title"
              popupEdit
              onSave={(val) => { if (val.trim()) saveField({ title: val.trim() }) }}
              textClassName={isDone ? 'line-through text-muted-foreground' : undefined}
            />
          )}
        </td>

        {/* Due Date */}
        <td style={{ width: columnWidths.dueDate }} className="px-3 py-2">
          <div className="flex items-center gap-1">
            {isOverdue && <AlertCircle size={13} className="text-destructive animate-pulse flex-shrink-0" />}
            <EditableCell
              inputValue={dueDateInputValue}
              displayText={dueDateDisplay}
              placeholder="No date"
              inputType="date"
              popupEdit
              onSave={(val) => saveField({ due_date: val ? `${val}T00:00:00` : null })}
              textClassName={isOverdue ? 'text-destructive font-medium' : undefined}
            />
          </div>
        </td>

        {/* Topics */}
        <td style={{ width: columnWidths.topics }} className="px-3 py-2">
          <TaskTopicSelector taskId={task.id} selectedTopics={task.topics} />
        </td>

        {/* Description */}
        <td style={{ width: columnWidths.description }} className="px-3 py-2">
          <EditableCell
            inputValue={task.description ?? ''}
            displayText={task.description ?? ''}
            placeholder="No description"
            popupEdit
            multiline
            onSave={(val) => saveField({ description: val || null })}
          />
        </td>
      </tr>

      {(hasSubtasks || pendingNewSubtask) && (
        <tr>
          <td colSpan={totalColumns} className="p-0">
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <SubtaskTable
                  taskId={task.id}
                  subtasks={task.subtasks}
                  columnWidths={columnWidths}
                  totalColumns={totalColumns}
                  pendingNewSubtask={pendingNewSubtask}
                  onCancelPending={cancelPendingSubtask}
                  onCreatedPending={() => setPendingNewSubtask(false)}
                  isInner
                />
              </div>
            </div>
          </td>
        </tr>
      )}

      <BulkDeleteDialog
        open={confirmDelete}
        count={1}
        isPending={isDeleting}
        onConfirm={() => {
          deleteTask(task.id, {
            onSuccess: () => { toast.success('Task deleted'); setConfirmDelete(false) },
            onError: () => toast.error('Failed to delete task'),
          })
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
