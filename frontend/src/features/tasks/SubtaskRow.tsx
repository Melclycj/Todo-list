import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Subtask, TaskStatus } from '@/types/task'
import type { ColumnKey } from '@/hooks/useColumnResize'
import { TaskStatusBadge } from './TaskStatusBadge'
import { EditableCell } from './TaskRow'
import { GRIP_COLUMN_WIDTH } from './TaskTableHeader'
import { useUpdateSubtask, useDeleteSubtask } from '@/hooks/useSubtasks'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

function nextSubtaskStatus(current: TaskStatus): TaskStatus {
  if (current === 'todo') return 'in_progress'
  if (current === 'in_progress') return 'done'
  return 'todo'
}

interface SubtaskRowProps {
  subtask: Subtask
  columnWidths: Record<ColumnKey, number>
}

export function SubtaskRow({ subtask, columnWidths }: SubtaskRowProps) {
  const { mutate: updateSubtask } = useUpdateSubtask(subtask.task_id)
  const { mutate: deleteSubtask, isPending: isDeleting } = useDeleteSubtask(subtask.task_id)
  const [isHovered, setIsHovered] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isDone = subtask.status === 'done'

  function handleStatusClick(e: React.MouseEvent) {
    e.stopPropagation()
    const next = nextSubtaskStatus(subtask.status)
    updateSubtask(
      { subtaskId: subtask.id, payload: { status: next } },
      { onError: () => toast.error('Failed to update subtask status') }
    )
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmDelete(true)
  }

  function confirmDeleteSubtask() {
    deleteSubtask(subtask.id, {
      onSuccess: () => setConfirmDelete(false),
      onError: () => toast.error('Failed to delete subtask'),
    })
  }

  return (
    <tr
      className={cn('group/subtask border-b border-border/50 hover:bg-muted/10 transition-colors', isDone && 'opacity-60')}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Grip column — delete button for subtasks */}
      <td style={{ width: GRIP_COLUMN_WIDTH }} className="py-1.5 pl-1 pr-0">
        {isHovered && (
          <button
            onClick={handleDeleteClick}
            className="p-0.5 rounded hover:bg-destructive/10 transition-colors"
            aria-label="Delete subtask"
          >
            <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
          </button>
        )}
        <Dialog open={confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(false) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete subtask?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Delete{' '}
              <span className="font-medium text-foreground">{subtask.title || 'this subtask'}</span>?
              This can&apos;t be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmDeleteSubtask} disabled={isDeleting}>
                {isDeleting ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </td>

      {/* Expand column spacer */}
      <td style={{ width: 24 }} />

      {/* Status */}
      <td style={{ width: columnWidths.status }} className="px-3 py-1.5">
        <TaskStatusBadge status={subtask.status} onClick={handleStatusClick} size="sm" />
      </td>

      {/* Title */}
      <td style={{ width: columnWidths.title }} className="px-3 py-1.5">
        <EditableCell
          inputValue={subtask.title}
          displayText={subtask.title}
          placeholder="Subtask title"
          popupEdit
          onSave={(val) => {
            if (val.trim()) {
              updateSubtask(
                { subtaskId: subtask.id, payload: { title: val.trim() } },
                { onError: () => toast.error('Failed to save') }
              )
            }
          }}
          textClassName={cn('text-sm', isDone && 'line-through text-muted-foreground')}
        />
      </td>

      {/* Due Date — empty for subtasks */}
      <td style={{ width: columnWidths.dueDate }} className="px-3 py-1.5" />

      {/* Topics — empty for subtasks */}
      <td style={{ width: columnWidths.topics }} className="px-3 py-1.5" />

      {/* Description — empty for subtasks */}
      <td style={{ width: columnWidths.description }} className="px-3 py-1.5" />
    </tr>
  )
}
