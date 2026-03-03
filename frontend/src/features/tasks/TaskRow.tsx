import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types/task'
import type { ColumnKey } from '@/hooks/useColumnResize'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TaskTopicSelector } from './TaskTopicSelector'
import { useUpdateTaskStatus, useUpdateTask } from '@/hooks/useTasks'
import { toast } from 'sonner'

function nextStatus(current: TaskStatus): TaskStatus {
  if (current === 'in_progress') return 'done'
  if (current === 'done') return 'todo'
  return 'in_progress'
}

interface EditableCellProps {
  inputValue: string
  displayText: string
  placeholder?: string
  inputType?: 'text' | 'date'
  onSave: (value: string) => void
  textClassName?: string
}

function EditableCell({
  inputValue,
  displayText,
  placeholder = '—',
  inputType = 'text',
  onSave,
  textClassName,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(inputValue)

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setDraft(inputValue)
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    if (draft !== inputValue) onSave(draft)
  }

  function cancel() {
    setDraft(inputValue)
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    if (e.key === 'Escape') cancel()
  }

  if (editing) {
    return (
      <input
        type={inputType}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-background border border-ring rounded px-1.5 py-0.5 text-sm focus:outline-none"
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      className={cn(
        'cursor-text block min-h-[1.25rem] rounded px-0.5 -mx-0.5 hover:bg-accent/40 text-sm',
        textClassName
      )}
    >
      {displayText || (
        <span className="text-muted-foreground/40 italic text-xs">{placeholder}</span>
      )}
    </span>
  )
}

interface TaskRowProps {
  task: Task
  columnWidths: Record<ColumnKey, number>
  isEditMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}

export function TaskRow({ task, columnWidths, isEditMode, isSelected, onToggleSelect }: TaskRowProps) {
  const { mutate: updateStatus } = useUpdateTaskStatus()
  const { mutate: updateTask } = useUpdateTask(task.id)
  const isDone = task.status === 'done'

  function handleStatusClick(e: React.MouseEvent) {
    e.stopPropagation()
    const next = nextStatus(task.status)
    updateStatus(
      { id: task.id, payload: { status: next } },
      {
        onSuccess: () => { if (next === 'done') toast.success('Task completed') },
        onError: () => toast.error('Failed to update status'),
      }
    )
  }

  function saveField(payload: { title?: string; due_date?: string | null; description?: string | null }) {
    updateTask(payload, { onError: () => toast.error('Failed to save') })
  }

  const dueDateInputValue = task.due_date ? task.due_date.slice(0, 10) : ''
  const dueDateDisplay = task.due_date ? format(parseISO(task.due_date), 'MMM d, yyyy') : ''

  return (
    <tr className={cn('group border-b border-border hover:bg-muted/20 transition-colors', isDone && 'opacity-60')}>
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

      {/* Status */}
      <td style={{ width: columnWidths.status }} className="px-3 py-2">
        <TaskStatusBadge status={task.status} onClick={handleStatusClick} />
      </td>

      {/* Title */}
      <td style={{ width: columnWidths.title }} className="px-3 py-2">
        <EditableCell
          inputValue={task.title}
          displayText={task.title}
          placeholder="Task title"
          onSave={(val) => { if (val.trim()) saveField({ title: val.trim() }) }}
          textClassName={isDone ? 'line-through text-muted-foreground' : undefined}
        />
      </td>

      {/* Due Date */}
      <td style={{ width: columnWidths.dueDate }} className="px-3 py-2">
        <EditableCell
          inputValue={dueDateInputValue}
          displayText={dueDateDisplay}
          placeholder="No date"
          inputType="date"
          onSave={(val) => saveField({ due_date: val ? `${val}T00:00:00` : null })}
        />
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
          onSave={(val) => saveField({ description: val || null })}
        />
      </td>
    </tr>
  )
}
