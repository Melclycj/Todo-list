import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface BulkDeleteDialogProps {
  open: boolean
  count: number
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function BulkDeleteDialog({
  open,
  count,
  isPending,
  onConfirm,
  onCancel,
}: BulkDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {count} task{count !== 1 ? 's' : ''}?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This will permanently delete{' '}
          <span className="font-medium text-foreground">{count}</span> selected task
          {count !== 1 ? 's' : ''}. This action cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
