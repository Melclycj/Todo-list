import { useRef, useState, useCallback, useEffect } from 'react'
import { GripVertical, Trash2, ListPlus, Square } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface RowContextMenuAction {
  label: string
  icon: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive'
}

interface RowContextMenuProps {
  actions: RowContextMenuAction[]
  /** dnd-kit sortable attributes for the grip handle */
  dragAttributes?: React.HTMLAttributes<HTMLButtonElement>
  /** dnd-kit sortable listeners for the grip handle */
  dragListeners?: Record<string, Function>
  /** Hide the grip icon entirely (e.g. single-item groups) */
  hidden?: boolean
}

// Must match the PointerSensor activationConstraint.distance in TaskList.
// If the pointer moves more than this before release, treat the gesture as
// a drag (dnd-kit starts dragging) and suppress the menu-open click.
const DRAG_THRESHOLD = 5

export function RowContextMenu({ actions, dragAttributes, dragListeners, hidden }: RowContextMenuProps) {
  const [open, setOpen] = useState(false)
  const wasDrag = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => () => cleanupRef.current?.(), [])

  // Radix DropdownMenuTrigger opens the menu on pointerdown, which conflicts
  // with dnd-kit's drag activation. To keep both behaviors we:
  //   1. Put dnd listeners on a plain grip button (no DropdownMenuTrigger).
  //   2. Track pointer movement on document — drag if moved > threshold.
  //   3. Open the menu manually on click, but only if it wasn't a drag.
  //   4. Anchor DropdownMenu to a hidden sibling trigger so Radix can still
  //      position the menu correctly.
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    wasDrag.current = false
    const startX = e.clientX
    const startY = e.clientY

    // Forward to dnd-kit's listener so the sortable can start drag tracking.
    ;(dragListeners as any)?.onPointerDown?.(e)

    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        wasDrag.current = true
      }
    }
    const cleanup = () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', cleanup)
      document.removeEventListener('pointercancel', cleanup)
      cleanupRef.current = null
    }
    cleanupRef.current = cleanup
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', cleanup)
    document.addEventListener('pointercancel', cleanup)
  }, [dragListeners])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // If the pointer moved past the drag threshold, this was a reorder gesture.
    if (wasDrag.current) {
      wasDrag.current = false
      return
    }
    setOpen((prev) => !prev)
  }, [])

  if (hidden) return null

  const isDraggable = !!dragListeners
  const cursorClass = isDraggable ? 'cursor-grab active:cursor-grabbing touch-none' : 'cursor-pointer'

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        {...dragAttributes}
        {...(dragListeners as Record<string, any>)}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        className={`opacity-0 group-hover:opacity-60 focus:opacity-60 transition-opacity p-1 ${cursorClass} rounded hover:bg-accent/40`}
        aria-label={isDraggable ? 'Actions and reorder' : 'Actions'}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <GripVertical size={16} className="text-muted-foreground" />
      </button>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        {/* Invisible anchor — Radix positions the menu relative to this span,
            which sits over the grip button. pointer-events-none ensures it
            never intercepts drags or clicks on the real button. */}
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden="true"
            tabIndex={-1}
            className="absolute inset-0 pointer-events-none"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={4}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            buttonRef.current?.focus()
          }}
        >
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.label}
              onClick={(e) => { e.stopPropagation(); action.onClick() }}
              className={action.variant === 'destructive' ? 'text-destructive focus:text-destructive' : ''}
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export const TASK_DELETE_ACTION = (onClick: () => void): RowContextMenuAction => ({
  label: 'Delete',
  icon: <Trash2 size={14} />,
  onClick,
  variant: 'destructive',
})

export const TASK_ADD_SUBTASK_ACTION = (onClick: () => void): RowContextMenuAction => ({
  label: 'Add Subtask',
  icon: <ListPlus size={14} />,
  onClick,
})

export const RECURRING_STOP_ACTION = (onClick: () => void): RowContextMenuAction => ({
  label: 'Stop',
  icon: <Square size={14} />,
  onClick,
})
