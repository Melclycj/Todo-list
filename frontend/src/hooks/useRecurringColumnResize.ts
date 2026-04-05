import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'

const STORAGE_KEY = 'recurringTableColumnWidths_v1'

export type RecurringColumnKey = 'status' | 'title' | 'frequency' | 'nextDue' | 'topics' | 'description'

const COLUMN_PROPORTIONS: Record<RecurringColumnKey, number> = {
  status: 0.08,
  title: 0.15,
  frequency: 0.10,
  nextDue: 0.12,
  topics: 0.15,
  description: 0.28,
}

function computeDefaultWidths(): Record<RecurringColumnKey, number> {
  const vw = window.innerWidth
  return {
    status: Math.round(vw * COLUMN_PROPORTIONS.status),
    title: Math.round(vw * COLUMN_PROPORTIONS.title),
    frequency: Math.round(vw * COLUMN_PROPORTIONS.frequency),
    nextDue: Math.round(vw * COLUMN_PROPORTIONS.nextDue),
    topics: Math.round(vw * COLUMN_PROPORTIONS.topics),
    description: Math.round(vw * COLUMN_PROPORTIONS.description),
  }
}

function readSavedWidths(): Record<RecurringColumnKey, number> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...computeDefaultWidths(), ...JSON.parse(saved) }
  } catch {
    // fall through to computed defaults
  }
  return computeDefaultWidths()
}

export function useRecurringColumnResize() {
  const [widths, setWidths] = useState<Record<RecurringColumnKey, number>>(readSavedWidths)
  const cleanupRef = useRef<(() => void) | null>(null)
  const rafRef = useRef<number>(0)

  // Guarantee listeners are removed if the component unmounts mid-drag
  useEffect(() => {
    return () => { cleanupRef.current?.() }
  }, [])

  function startColumnDrag(column: RecurringColumnKey, e: MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = widths[column]

    function onMouseMove(event: globalThis.MouseEvent) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const newWidth = Math.max(80, startWidth + (event.clientX - startX))
        setWidths((prev) => ({ ...prev, [column]: newWidth }))
      })
    }

    function cleanup() {
      cancelAnimationFrame(rafRef.current)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      cleanupRef.current = null
    }

    function onMouseUp(event: globalThis.MouseEvent) {
      const finalWidth = Math.max(80, startWidth + (event.clientX - startX))
      const updated = { ...widths, [column]: finalWidth }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      cleanup()
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    cleanupRef.current = cleanup
  }

  return { widths, startColumnDrag }
}
