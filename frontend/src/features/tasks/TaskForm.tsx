import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useTopics, useCreateTopic } from '@/hooks/useTopics'
import type { RecurringFrequency as RF } from '@/types/recurring'

export interface TaskFormValues {
  title: string
  description: string
  dueDate: string | null
  topicIds: string[]
  isRecurring: boolean
  frequency: RF
}

interface TaskFormProps {
  initialValues?: Partial<TaskFormValues>
  onSubmit: (values: TaskFormValues) => void
  onCancel: () => void
  isPending?: boolean
  submitLabel?: string
  /** When true, recurring toggle is pre-checked and cannot be unchecked */
  recurringOnly?: boolean
  /** When true, the title field is rendered read-only with an info notice */
  readonlyTitle?: boolean
}

export function TaskForm({
  initialValues,
  onSubmit,
  onCancel,
  isPending,
  submitLabel = 'Save',
  recurringOnly = false,
  readonlyTitle = false,
}: TaskFormProps) {
  const { data: topics = [] } = useTopics()
  const { mutateAsync: createTopic } = useCreateTopic()

  const [title, setTitle] = useState(initialValues?.title ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  // Internal state stores date-only string (YYYY-MM-DD) for the date input
  const [dueDate, setDueDate] = useState<string | null>(
    initialValues?.dueDate ? initialValues.dueDate.slice(0, 10) : null
  )
  const [topicIds, setTopicIds] = useState<string[]>(initialValues?.topicIds ?? [])
  const [isRecurring, setIsRecurring] = useState(recurringOnly || (initialValues?.isRecurring ?? false))
  const [frequency, setFrequency] = useState<RF>(initialValues?.frequency ?? 'weekly')
  const [titleError, setTitleError] = useState('')

  // Inline new tag state
  const [showNewTagInput, setShowNewTagInput] = useState(false)
  const [newTagInput, setNewTagInput] = useState('')
  const newTagInputRef = useRef<HTMLInputElement>(null)

  const isDailyFrequency = isRecurring && frequency === 'daily'
  const todayStr = new Date().toISOString().slice(0, 10)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setTitleError('Title is required.')
      return
    }
    // Daily tasks have no due date (they're always due on the day created)
    let fullDueDate: string | null = null
    if (!isDailyFrequency && dueDate) {
      fullDueDate = `${dueDate}T00:00:00`
    }
    onSubmit({ title: title.trim(), description, dueDate: fullDueDate, topicIds, isRecurring, frequency })
  }

  function toggleTopic(id: string) {
    setTopicIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    )
  }

  async function commitNewTag(value: string) {
    const name = value.trim()
    if (!name) {
      setShowNewTagInput(false)
      setNewTagInput('')
      return
    }
    try {
      const res = await createTopic({ name })
      const newTopic = res.data
      if (newTopic) {
        setTopicIds((prev) => [...prev, newTopic.id])
      }
    } catch {
      // Topic creation failed — silently ignore so the form stays usable
    }
    setShowNewTagInput(false)
    setNewTagInput('')
  }

  function handleNewTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void commitNewTag(newTagInput)
    }
    if (e.key === 'Escape') {
      setShowNewTagInput(false)
      setNewTagInput('')
    }
  }

  function handleShowNewTagInput() {
    setShowNewTagInput(true)
    // Focus happens via useEffect on next render; use setTimeout as fallback
    setTimeout(() => newTagInputRef.current?.focus(), 0)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="task-title">Title *</Label>
        {readonlyTitle ? (
          <div className="space-y-1">
            <p className="text-sm font-medium px-3 py-2 bg-muted rounded-md">{title}</p>
            <p className="text-xs text-muted-foreground">
              Titles of recurring task instances cannot be changed.
            </p>
          </div>
        ) : (
          <>
            <Input
              id="task-title"
              placeholder="Task title…"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleError('') }}
              autoFocus
            />
            {titleError && <p className="text-xs text-destructive">{titleError}</p>}
          </>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="task-description">Description</Label>
        <Textarea
          id="task-description"
          placeholder="Add a note…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      {/* Due Date — hidden for daily, date-only otherwise */}
      <div className="space-y-1.5">
        <Label>Due Date</Label>
        {isDailyFrequency ? (
          <Input
            type="date"
            value={todayStr}
            disabled
            className="flex-1 opacity-50 cursor-not-allowed"
          />
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dueDate ?? ''}
              onChange={(e) => setDueDate(e.target.value || null)}
              className="flex-1"
            />
            {dueDate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDueDate(null)}
                className="text-muted-foreground"
              >
                Clear
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Topics */}
      <div className="space-y-1.5">
        <Label>
          Topics{isRecurring && (
            <span className="text-xs font-normal text-muted-foreground ml-1">
              (applied to each spawned task)
            </span>
          )}
        </Label>
        <div className="flex flex-wrap gap-1.5 items-center">
          {topics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => toggleTopic(topic.id)}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs border transition-colors',
                topicIds.includes(topic.id)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted'
              )}
            >
              {topic.name}
            </button>
          ))}

          {showNewTagInput ? (
            <input
              ref={newTagInputRef}
              type="text"
              value={newTagInput}
              autoFocus
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={handleNewTagKeyDown}
              onBlur={() => void commitNewTag(newTagInput)}
              placeholder="New tag…"
              className="px-2.5 py-0.5 rounded-full text-xs border border-ring bg-background focus:outline-none w-24"
              aria-label="New tag name"
            />
          ) : (
            <button
              type="button"
              onClick={handleShowNewTagInput}
              aria-label="Add new tag"
              className="px-2 py-0.5 rounded-full text-xs border border-dashed border-border hover:border-ring hover:bg-muted transition-colors text-muted-foreground"
            >
              + New tag
            </button>
          )}
        </div>
      </div>

      {/* Recurring toggle */}
      <div className="space-y-2">
        <label className={cn('flex items-center gap-2', recurringOnly ? 'cursor-not-allowed' : 'cursor-pointer')}>
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => !recurringOnly && setIsRecurring(e.target.checked)}
            disabled={recurringOnly}
            className="rounded"
          />
          <span className="text-sm">Make this a recurring task</span>
        </label>
        {isRecurring && (
          <div className="ml-6">
            <Label htmlFor="frequency" className="text-xs">Frequency</Label>
            <select
              id="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as RF)}
              className="mt-1 block w-full text-sm rounded-md border border-input bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
