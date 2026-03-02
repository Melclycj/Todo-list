import { useState } from 'react'
import { Plus, Repeat, Pencil, Square } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { TaskEmptyState } from '@/features/tasks/TaskEmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
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
  useCreateRecurringTemplate,
  useUpdateRecurringTemplate,
} from '@/hooks/useRecurring'
import type { RecurringTemplate } from '@/types/recurring'
import type { RecurringFrequency } from '@/types/recurring'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
}

function TemplateRow({ template }: { template: RecurringTemplate }) {
  const { mutate: stop, isPending } = useStopRecurringTemplate()
  const [confirmStop, setConfirmStop] = useState(false)
  const [editing, setEditing] = useState(false)
  const { mutate: update, isPending: isUpdating } = useUpdateRecurringTemplate()

  const [editTitle, setEditTitle] = useState(template.title)
  const [editFreq, setEditFreq] = useState<RecurringFrequency>(template.frequency)

  function handleStop() {
    stop(template.id, {
      onSuccess: () => { toast.success('Recurring task stopped'); setConfirmStop(false) },
      onError: () => toast.error('Failed to stop'),
    })
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    update(
      { id: template.id, payload: { title: editTitle, frequency: editFreq } },
      {
        onSuccess: () => { toast.success('Updated'); setEditing(false) },
        onError: () => toast.error('Failed to update'),
      }
    )
  }

  return (
    <div className={cn('group flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-muted/30', !template.is_active && 'opacity-50')}>
      <Repeat size={14} className="text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{template.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {FREQ_LABELS[template.frequency]}
          {template.is_active && ` · Next: ${format(parseISO(template.next_run_at), 'MMM d, yyyy')}`}
          {!template.is_active && ' · Stopped'}
        </p>
      </div>
      <Badge variant={template.is_active ? 'default' : 'secondary'} className="text-xs">
        {template.is_active ? 'Active' : 'Stopped'}
      </Badge>
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
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isUpdating}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function RecurringPage() {
  const { data: templates = [], isLoading } = useRecurringTemplates()
  const { mutate: create, isPending: isCreating } = useCreateRecurringTemplate()
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [freq, setFreq] = useState<RecurringFrequency>('weekly')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    create(
      { title: title.trim(), frequency: freq },
      {
        onSuccess: () => { toast.success('Recurring task created'); setCreateOpen(false); setTitle('') },
        onError: () => toast.error('Failed to create'),
      }
    )
  }

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
          {templates.map((t) => <TemplateRow key={t.id} template={t} />)}
        </div>
      )}

      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Recurring Task</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input autoFocus placeholder="Task title…" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <select
                value={freq}
                onChange={(e) => setFreq(e.target.value as RecurringFrequency)}
                className="block w-full text-sm rounded-md border border-input bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isCreating}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
