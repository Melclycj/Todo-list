import { useEffect, useState } from 'react'
import { Plus, Repeat2, Check, Trash2, Pencil } from 'lucide-react'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  useRecurringTemplates,
  useStopRecurringTemplate,
  useUpdateRecurringTemplate,
} from '@/hooks/useRecurring'
import { useTopics } from '@/hooks/useTopics'
import { EditableCell } from '@/features/tasks/TaskRow'
import type { RecurringTemplate, RecurringFrequency, RecurringUpdatePayload } from '@/types/recurring'
import { toast } from 'sonner'

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
}

function formatNextDue(template: RecurringTemplate): string {
  if (!template.is_active) return 'Stopped'
  try {
    return format(parseISO(template.next_run_at), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

// ---------------------------------------------------------------------------
// Inline select cell for frequency
// ---------------------------------------------------------------------------

interface EditableSelectCellProps {
  value: RecurringFrequency
  onSave: (value: RecurringFrequency) => void
  disabled?: boolean
}

function EditableSelectCell({ value, onSave, disabled }: EditableSelectCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function startEdit(e: React.MouseEvent) {
    if (disabled) return
    e.stopPropagation()
    setDraft(value)
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    if (draft !== value) onSave(draft)
  }

  if (editing) {
    return (
      <select
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value as RecurringFrequency)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        className="bg-background border border-ring rounded px-1.5 py-0.5 text-sm focus:outline-none"
      >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="fortnightly">Fortnightly</option>
        <option value="monthly">Monthly</option>
      </select>
    )
  }

  return (
    <span
      onClick={startEdit}
      className={cn(
        'block min-h-[1.25rem] rounded px-0.5 -mx-0.5 text-sm text-muted-foreground whitespace-nowrap',
        disabled ? 'cursor-not-allowed' : 'cursor-text hover:bg-accent/40'
      )}
    >
      {FREQ_LABELS[value]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Inline topic selector for recurring templates
// ---------------------------------------------------------------------------

interface RecurringTopicSelectorProps {
  template: RecurringTemplate
  disabled?: boolean
}

function RecurringTopicSelector({ template, disabled }: RecurringTopicSelectorProps) {
  const [open, setOpen] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(
    () => new Set(template.topics.map((t) => t.id))
  )
  const { data: allTopics = [] } = useTopics()
  const { mutate: update } = useUpdateRecurringTemplate()

  useEffect(() => {
    if (!open) {
      setPendingIds(new Set(template.topics.map((t) => t.id)))
    }
  }, [template.topics, open])

  function handleToggle(topicId: string) {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (next.has(topicId)) next.delete(topicId)
      else next.add(topicId)
      return next
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    if (disabled) return
    setOpen(nextOpen)
    if (!nextOpen) {
      const originalIds = new Set(template.topics.map((t) => t.id))
      const changed =
        pendingIds.size !== originalIds.size ||
        [...pendingIds].some((id) => !originalIds.has(id))
      if (changed) {
        update(
          { id: template.id, payload: { topic_ids: [...pendingIds] } },
          { onError: () => toast.error('Failed to update topics') }
        )
      }
    }
  }

  return (
    <Popover open={disabled ? false : open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div
          onClick={(e) => { if (!disabled) e.stopPropagation() }}
          className={cn(
            'min-h-[1.25rem] rounded px-0.5 -mx-0.5',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-accent/40'
          )}
        >
          {template.topics.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {template.topics.map((topic) => (
                <span
                  key={topic.id}
                  className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border"
                >
                  {topic.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground/40 italic text-xs">
              {disabled ? '—' : 'Add topics'}
            </span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-52 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {allTopics.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">No topics created yet</p>
        ) : (
          <ul className="space-y-0.5">
            {allTopics.map((topic) => (
              <li key={topic.id}>
                <label className="flex items-center gap-2 px-1 py-1 rounded hover:bg-accent cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={pendingIds.has(topic.id)}
                    onChange={() => handleToggle(topic.id)}
                    className="accent-primary h-3.5 w-3.5"
                  />
                  <span className="truncate">{topic.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Template row
// ---------------------------------------------------------------------------

interface TemplateRowProps {
  template: RecurringTemplate
  isEditMode: boolean
  isSelected: boolean
  onToggleSelect: (id: string) => void
}

function TemplateRow({ template, isEditMode, isSelected, onToggleSelect }: TemplateRowProps) {
  const { mutate: update } = useUpdateRecurringTemplate()
  const isInactive = !template.is_active

  function saveField(payload: RecurringUpdatePayload) {
    update(
      { id: template.id, payload },
      { onError: () => toast.error('Failed to update') }
    )
  }

  const nextRunInput = template.next_run_at ? template.next_run_at.slice(0, 10) : ''

  return (
    <tr className={cn('group border-b border-border hover:bg-muted/20 transition-colors', isInactive && 'opacity-50')}>
      {/* Checkbox (edit mode only) */}
      {isEditMode && (
        <td className="px-3 py-2 w-10" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(template.id)}
            disabled={isInactive}
            className="accent-primary h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
          />
        </td>
      )}

      {/* Status — recurring icon */}
      <td className="px-4 py-3 w-16 text-center">
        <Repeat2 size={14} className="inline text-muted-foreground" aria-label="Recurring" />
      </td>

      {/* Title */}
      <td className="px-4 py-3 text-sm font-medium max-w-[200px]">
        <EditableCell
          inputValue={template.title}
          displayText={template.title}
          placeholder="Template title"
          onSave={(val) => { if (val.trim()) saveField({ title: val.trim() }) }}
          disabled={isInactive}
        />
      </td>

      {/* Frequency */}
      <td className="px-4 py-3">
        <EditableSelectCell
          value={template.frequency}
          onSave={(val) => saveField({ frequency: val })}
          disabled={isInactive}
        />
      </td>

      {/* Next Due */}
      <td className="px-4 py-3">
        <EditableCell
          inputValue={nextRunInput}
          displayText={formatNextDue(template)}
          placeholder="—"
          inputType="date"
          onSave={(val) => { if (val) saveField({ next_run_at: `${val}T00:00:00` }) }}
          disabled={isInactive}
          textClassName="text-muted-foreground whitespace-nowrap"
        />
      </td>

      {/* Topics */}
      <td className="px-4 py-3">
        <RecurringTopicSelector template={template} disabled={isInactive} />
      </td>

      {/* Description */}
      <td className="px-4 py-3">
        <EditableCell
          inputValue={template.description ?? ''}
          displayText={template.description ?? ''}
          placeholder="No description"
          onSave={(val) => saveField({ description: val || null })}
          disabled={isInactive}
          textClassName="text-muted-foreground"
        />
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function RecurringPage() {
  const { data: templates = [], isLoading } = useRecurringTemplates()
  const [createOpen, setCreateOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmStop, setConfirmStop] = useState(false)
  const { mutate: stop, isPending: isStopping } = useStopRecurringTemplate()

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitEditMode() {
    setIsEditMode(false)
    setSelectedIds(new Set())
  }

  function handleBulkStop() {
    const ids = Array.from(selectedIds)
    let remaining = ids.length
    ids.forEach((id) => {
      stop(id, {
        onSuccess: () => {
          remaining--
          if (remaining === 0) {
            toast.success(`${ids.length} template${ids.length !== 1 ? 's' : ''} stopped`)
            setConfirmStop(false)
            exitEditMode()
          }
        },
        onError: () => toast.error('Failed to stop some templates'),
      })
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Recurring Tasks</h1>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> New Template
          </Button>
          {/* Edit mode toolbar — mirrors TaskEditToolbar in Active Tasks */}
          {!isEditMode ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)} title="Select to stop">
              <Pencil size={14} />
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmStop(true)}
                disabled={selectedIds.size === 0}
                title="Stop selected"
                className={cn(selectedIds.size === 0 && 'opacity-50 cursor-not-allowed')}
              >
                <Trash2 size={14} />
              </Button>
              <Button variant="outline" size="sm" onClick={exitEditMode} title="Done">
                <Check size={14} />
              </Button>
            </div>
          )}
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
                  {isEditMode && <th className="px-3 py-2 w-10"></th>}
                  <th className="px-4 py-2 w-16 text-center">Status</th>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2 whitespace-nowrap">Frequency</th>
                  <th className="px-4 py-2 whitespace-nowrap">Next Due</th>
                  <th className="px-4 py-2">Topics</th>
                  <th className="px-4 py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <TemplateRow
                    key={t.id}
                    template={t}
                    isEditMode={isEditMode}
                    isSelected={selectedIds.has(t.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create drawer */}
      <TaskCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        recurringOnly
      />

      {/* Bulk stop confirmation */}
      <Dialog open={confirmStop} onOpenChange={setConfirmStop}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Stop {selectedIds.size} recurring template{selectedIds.size !== 1 ? 's' : ''}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            No new instances will be created. Existing tasks are unaffected.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmStop(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkStop} disabled={isStopping}>
              {isStopping ? 'Stopping…' : 'Stop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
