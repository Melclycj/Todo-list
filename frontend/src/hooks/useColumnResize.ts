import { useState } from 'react'
import type { MouseEvent } from 'react'

const STORAGE_KEY = 'taskTableColumnWidths_v2'

export type ColumnKey = 'status' | 'title' | 'dueDate' | 'description'

// Proportions of the full viewport width used as the one-time computed default.
// Adjust these values to rebalance columns. They do not need to sum to 1.
const COLUMN_PROPORTIONS: Record<ColumnKey, number> = {
  status: 0.15,
  title: 0.15,
  dueDate: 0.15,
  description: 0.40,
}

function computeDefaultWidths(): Record<ColumnKey, number> {
  const vw = window.innerWidth
  return {
    status: Math.round(vw * COLUMN_PROPORTIONS.status),
    title: Math.round(vw * COLUMN_PROPORTIONS.title),
    dueDate: Math.round(vw * COLUMN_PROPORTIONS.dueDate),
    description: Math.round(vw * COLUMN_PROPORTIONS.description),
  }
}

function readSavedWidths(): Record<ColumnKey, number> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...computeDefaultWidths(), ...JSON.parse(saved) }
  } catch {
    // fall through to computed defaults
  }
  return computeDefaultWidths()
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
