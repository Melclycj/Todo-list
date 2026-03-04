import { useState } from 'react'
import { Plus, Repeat2, Pencil, Square } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { TaskEmptyState } from '@/features/tasks/TaskEmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskCreateDrawer } from '@/features/tasks/TaskCreateDrawer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useRecurringTemplates,
  useStopRecurringTemplate,
  useUpdateRecurringTemplate,
} from '@/hooks/useRecurring'
import type { RecurringTemplate } from '@/types/recurring'
import type { RecurringFrequency } from '@/types/recurring'
import { toast } from 'sonner'

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
}

function formatNextDue(template: RecurringTemplate): string {
  try {
    return format(parseISO(template.next_run_at), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

function TemplateRow({ template }: { template: RecurringTemplate }) {
  const { mutate: stop, isPending } = useStopRecurringTemplate()
  const [confirmStop, setConfirmStop] = useState(false)
  const [editing, setEditing] = useState(false)
  const { mutate: update, isPending: isUpdating } = useUpdateRecurringTemplate()

  const [editTitle, setEditTitle] = useState(template.title)
  const [editFreq, setEditFreq] = useState<RecurringFrequency>(template.frequency)
  const [editNextRunAt, setEditNextRunAt] = useState<string>(
    template.next_run_at ? template.next_run_at.slice(0, 10) : ''
  )

  function handleStop() {
    stop(template.id, {
      onSuccess: () => { toast.success('Recurring task stopped'); setConfirmStop(false) },
      onError: () => toast.error('Failed to stop'),
    })
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    const payload: Parameters<typeof update>[0]['payload'] = {
      title: editTitle,
      frequency: editFreq,
    }
    if (editNextRunAt) {
      payload.next_run_at = `${editNextRunAt}T00:00:00`
    }
    update(
      { id: template.id, payload },
      {
        onSuccess: () => { toast.success('Updated'); setEditing(false) },
        onError: () => toast.error('Failed to update'),
      }
    )
  }

  return (
    <>
      <tr className={`group border-b border-border hover:bg-muted/30 ${!template.is_active ? 'opacity-50' : ''}`}>
        {/* Status — recurring icon */}
        <td className="px-4 py-3 w-16 text-center">
          <Repeat2 size={14} className="inline text-muted-foreground" aria-label="Recurring" />
        </td>

        {/* Title */}
        <td className="px-4 py-3 text-sm font-medium truncate max-w-[200px]">
          {template.title}
        </td>

        {/* Frequency */}
        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
          {FREQ_LABELS[template.frequency]}
        </td>

        {/* Next Due */}
        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
          {template.is_active ? `Next due: ${formatNextDue(template)}` : 'Stopped'}
        </td>

        {/* Description */}
        <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[200px]">
          {template.description ?? '—'}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 w-20">
          {template.is_active && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditing(true)}
                className="p-1 rounded hover:bg-border text-muted-foreground"
                aria-label="Edit"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => setConfirmStop(true)}
                className="p-1 rounded hover:bg-border text-muted-foreground"
                aria-label="Stop"
              >
                <Square size={13} />
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Stop confirmation */}
      <Dialog open={confirmStop} onOpenChange={setConfirmStop}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Stop recurring task?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            No new instances will be created. Existing tasks are unaffected.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmStop(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleStop} disabled={isPending}>
              {isPending ? 'Stopping…' : 'Stop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit recurring task</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <select
                value={editFreq}
                onChange={(e) => setEditFreq(e.target.value as RecurringFrequency)}
                className="block w-full text-sm rounded-md border border-input bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Next due date</Label>
              <Input
                type="date"
                value={editNextRunAt}
                onChange={(e) => setEditNextRunAt(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isUpdating}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function RecurringPage() {
  const { data: templates = [], isLoading } = useRecurringTemplates()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex flex-col h-full">
      {/* Page header — matches TaskListPage topbar */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Recurring Tasks</h1>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> New Template
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
          </div>
        ) : templates.length === 0 ? (
          <TaskEmptyState isRecurring onCreateTask={() => setCreateOpen(true)} />
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-2 w-16 text-center">Status</th>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2 whitespace-nowrap">Frequency</th>
                  <th className="px-4 py-2 whitespace-nowrap">Next Due</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => <TemplateRow key={t.id} template={t} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create drawer — uses full TaskCreateDrawer with recurringOnly */}
      <TaskCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        recurringOnly
      />
    </div>
  )
}
