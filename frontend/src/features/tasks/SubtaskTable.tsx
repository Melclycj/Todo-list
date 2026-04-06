import { useState } from 'react'
import type { Subtask } from '@/types/task'
import type { ColumnKey } from '@/hooks/useColumnResize'
import { SubtaskRow } from './SubtaskRow'
import { useCreateSubtask } from '@/hooks/useSubtasks'
import { ACTIONS_COLUMN_WIDTH } from './TaskTableHeader'
import { toast } from 'sonner'

interface SubtaskTableProps {
  taskId: string
  subtasks: Subtask[]
  columnWidths: Record<ColumnKey, number>
  totalColumns: number
}

export function SubtaskTable({ taskId, subtasks, columnWidths, totalColumns }: SubtaskTableProps) {
  const { mutate: createSubtask, isPending } = useCreateSubtask(taskId)
  const [newTitle, setNewTitle] = useState('')

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

  return (
    <tr>
      <td colSpan={totalColumns} className="p-0">
        <div className="border-l-2 border-primary/30 ml-4 bg-muted/5">
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

              {/* Add subtask input row */}
              <tr className="border-b border-border/30">
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
