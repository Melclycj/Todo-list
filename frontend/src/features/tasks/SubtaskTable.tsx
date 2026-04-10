import { useState, useRef, useEffect } from 'react'
import type { Subtask } from '@/types/task'
import type { ColumnKey } from '@/hooks/useColumnResize'
import { SubtaskRow } from './SubtaskRow'
import { useCreateSubtask } from '@/hooks/useSubtasks'
import { DRAG_HANDLE_WIDTH, ACTIONS_COLUMN_WIDTH } from './TaskTableHeader'
import { SUBTASK_WRAPPER_CLASS } from './subtask-styles'
import { toast } from 'sonner'

interface SubtaskTableProps {
  taskId: string
  subtasks: Subtask[]
  columnWidths: Record<ColumnKey, number>
  totalColumns: number
  pendingNewSubtask?: boolean
  onCancelPending?: () => void
  onCreatedPending?: () => void
}

export function SubtaskTable({ taskId, subtasks, columnWidths, totalColumns, pendingNewSubtask, onCancelPending, onCreatedPending }: SubtaskTableProps) {
  const { mutate: createSubtask, isPending } = useCreateSubtask(taskId)
  const [newTitle, setNewTitle] = useState('')
  const pendingInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus the ephemeral row input when it appears
  useEffect(() => {
    if (pendingNewSubtask && pendingInputRef.current) {
      pendingInputRef.current.focus()
    }
  }, [pendingNewSubtask])

  function handleCreate() {
    const title = newTitle.trim()
    if (!title) return
    createSubtask(
      { title },
      {
        onSuccess: () => setNewTitle(''),
        onError: () => toast.error('Failed to create subtask'),
      }
    )
  }

  function handlePendingCreate(title: string) {
    const trimmed = title.trim()
    if (!trimmed) {
      onCancelPending?.()
      return
    }
    createSubtask(
      { title: trimmed },
      {
        onSuccess: () => onCreatedPending?.(),
        onError: () => toast.error('Failed to create subtask'),
      }
    )
  }

  return (
    <tr>
      <td colSpan={totalColumns} className="p-0">
        <div className={SUBTASK_WRAPPER_CLASS}>
          <table
            className="border-collapse w-full"
            style={{ tableLayout: 'fixed' }}
          >
            <tbody>
              {subtasks.map((subtask) => (
                <SubtaskRow
                  key={subtask.id}
                  subtask={subtask}
                  columnWidths={columnWidths}
                />
              ))}

              {/* Ephemeral new subtask row — auto-focused, discard on blur if empty */}
              {pendingNewSubtask && (
                <tr className="border-b border-border/30 bg-muted/10">
                  <td style={{ width: DRAG_HANDLE_WIDTH }} />
                  <td style={{ width: ACTIONS_COLUMN_WIDTH }} className="py-1.5 pl-2 pr-0" />
                  <td style={{ width: 24 }} />
                  <td style={{ width: columnWidths.status }} className="px-3 py-1.5">
                    <span className="text-xs text-muted-foreground/50">—</span>
                  </td>
                  <td style={{ width: columnWidths.title }} className="px-3 py-1.5">
                    <input
                      ref={pendingInputRef}
                      type="text"
                      defaultValue=""
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handlePendingCreate((e.target as HTMLInputElement).value)
                        }
                        if (e.key === 'Escape') onCancelPending?.()
                      }}
                      onBlur={(e) => {
                        const val = e.target.value.trim()
                        if (!val) onCancelPending?.()
                        else handlePendingCreate(val)
                      }}
                      placeholder="Enter subtask title..."
                      className="w-full bg-transparent text-sm focus:outline-none py-0.5 border-b border-ring/30 focus:border-ring"
                    />
                  </td>
                  <td style={{ width: columnWidths.dueDate }} />
                  <td style={{ width: columnWidths.topics }} />
                  <td style={{ width: columnWidths.description }} />
                </tr>
              )}

              {/* Persistent add subtask input row */}
              <tr className="border-b border-border/30">
                <td style={{ width: DRAG_HANDLE_WIDTH }} />
                <td style={{ width: ACTIONS_COLUMN_WIDTH }} className="py-1.5 pl-2 pr-0" />
                <td style={{ width: 24 }} />
                <td style={{ width: columnWidths.status }} className="px-3 py-1.5" />
                <td style={{ width: columnWidths.title }} className="px-3 py-1.5">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleCreate() }
                      if (e.key === 'Escape') setNewTitle('')
                    }}
                    placeholder="+ Add subtask..."
                    disabled={isPending}
                    className="w-full bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground/50 focus:text-foreground focus:outline-none py-0.5"
                  />
                </td>
                <td style={{ width: columnWidths.dueDate }} />
                <td style={{ width: columnWidths.topics }} />
                <td style={{ width: columnWidths.description }} />
              </tr>
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}
