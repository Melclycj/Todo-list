import type { MouseEvent } from 'react'
import type { ColumnKey } from '@/hooks/useColumnResize'

interface TaskTableHeaderProps {
  widths: Record<ColumnKey, number>
  onStartDrag: (column: ColumnKey, e: MouseEvent) => void
  isEditMode?: boolean
}

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'title', label: 'Title' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'topics', label: 'Topics' },
  { key: 'description', label: 'Description' },
]

export function TaskTableHeader({ widths, onStartDrag, isEditMode }: TaskTableHeaderProps) {
  return (
    <thead className="sticky top-0 z-10 bg-muted">
      <tr>
        {isEditMode && <th className="w-10 border-b border-border" />}
        {COLUMNS.map((col) => (
          <th
            key={col.key}
            style={{ width: widths[col.key], minWidth: widths[col.key] }}
            className="relative text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2 border-b border-border select-none"
          >
            {col.label}
            <div
              className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-border hover:bg-primary transition-colors"
              onMouseDown={(e) => onStartDrag(col.key, e)}
            />
          </th>
        ))}
      </tr>
    </thead>
  )
}
