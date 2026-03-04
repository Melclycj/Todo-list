import { Check, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TaskEditToolbarProps {
  isEditMode: boolean
  selectedCount: number
  onEnterEditMode: () => void
  onExitEditMode: () => void
  onDelete: () => void
}

export function TaskEditToolbar({
  isEditMode,
  selectedCount,
  onEnterEditMode,
  onExitEditMode,
  onDelete,
}: TaskEditToolbarProps) {
  if (!isEditMode) {
    return (
      <Button variant="outline" size="sm" onClick={onEnterEditMode} title="Edit tasks">
        <Pencil size={14} />
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={onDelete}
        disabled={selectedCount === 0}
        title="Delete selected"
        className={cn(selectedCount === 0 && 'opacity-50 cursor-not-allowed')}
      >
        <Trash2 size={14} />
      </Button>
      <Button variant="outline" size="sm" onClick={onExitEditMode} title="Done">
        <Check size={14} />
      </Button>
    </div>
  )
}
