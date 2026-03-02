import { useState } from 'react'
import type { MouseEvent } from 'react'

const STORAGE_KEY = 'sidebarWidth'
const DEFAULT_WIDTH = 512
const MIN_WIDTH = 160
const MAX_WIDTH = 600

function readSavedWidth(): number {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    const n = parseInt(saved, 10)
    if (!isNaN(n)) return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n))
  }
  return DEFAULT_WIDTH
}

export function useSidebarResize() {
  const [width, setWidth] = useState<number>(readSavedWidth)

  function startDrag(e: MouseEvent) {
    e.preventDefault()

    function onMouseMove(event: globalThis.MouseEvent) {
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, event.clientX)))
    }

    function onMouseUp(event: globalThis.MouseEvent) {
      const finalWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, event.clientX))
      localStorage.setItem(STORAGE_KEY, String(finalWidth))
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return { width, startDrag }
}
