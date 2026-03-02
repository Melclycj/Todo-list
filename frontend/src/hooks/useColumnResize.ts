import { useState } from 'react'
import type { MouseEvent } from 'react'

const STORAGE_KEY = 'taskTableColumnWidths'

export type ColumnKey = 'status' | 'title' | 'dueDate' | 'description'

const DEFAULT_WIDTHS: Record<ColumnKey, number> = {
  status: 130,
  title: 280,
  dueDate: 120,
  description: 240,
}

function readSavedWidths(): Record<ColumnKey, number> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? { ...DEFAULT_WIDTHS, ...JSON.parse(saved) } : DEFAULT_WIDTHS
  } catch {
    return DEFAULT_WIDTHS
  }
}

export function useColumnResize() {
  const [widths, setWidths] = useState<Record<ColumnKey, number>>(readSavedWidths)

  function startColumnDrag(column: ColumnKey, e: MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = widths[column]

    function onMouseMove(event: globalThis.MouseEvent) {
      const newWidth = Math.max(80, startWidth + (event.clientX - startX))
      setWidths((prev) => ({ ...prev, [column]: newWidth }))
    }

    function onMouseUp(event: globalThis.MouseEvent) {
      const finalWidth = Math.max(80, startWidth + (event.clientX - startX))
      const updated = { ...widths, [column]: finalWidth }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return { widths, startColumnDrag }
}
