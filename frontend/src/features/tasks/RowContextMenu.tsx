import { MoreHorizontal, Trash2, ListPlus, Square } from 'lucide-react'
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
}

export function RowContextMenu({ actions }: RowContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent"
          onClick={(e) => e.stopPropagation()}
          aria-label="More options"
        >
          <MoreHorizontal size={14} className="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4}>
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
