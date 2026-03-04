import { useEffect, useState } from 'react'
import type { Topic } from '@/types/topic'
import { useTopics } from '@/hooks/useTopics'
import { useUpdateTask } from '@/hooks/useTasks'
import { TaskTopicTags } from './TaskTopicTags'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'

interface TaskTopicSelectorProps {
  taskId: string
  selectedTopics: Topic[]
}

export function TaskTopicSelector({ taskId, selectedTopics }: TaskTopicSelectorProps) {
  const [open, setOpen] = useState(false)
  // Local pending IDs — toggled synchronously, flushed to server on popover close
  const [pendingIds, setPendingIds] = useState<Set<string>>(
    () => new Set(selectedTopics.map((t) => t.id))
  )
  const { data: allTopics = [] } = useTopics()
  const { mutate: updateTask } = useUpdateTask(taskId)

  // Sync pendingIds when selectedTopics changes (e.g. after server update)
  useEffect(() => {
    if (!open) {
      setPendingIds(new Set(selectedTopics.map((t) => t.id)))
    }
  }, [selectedTopics, open])

  function handleToggle(topicId: string) {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (next.has(topicId)) next.delete(topicId)
      else next.add(topicId)
      return next
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      // Flush: only send request if the selection actually changed
      const originalIds = new Set(selectedTopics.map((t) => t.id))
      const changed =
        pendingIds.size !== originalIds.size ||
        [...pendingIds].some((id) => !originalIds.has(id))
      if (changed) {
        updateTask(
          { topic_ids: [...pendingIds] },
          { onError: () => toast.error('Failed to update topics') }
        )
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div
          onClick={(e) => e.stopPropagation()}
          className="cursor-pointer min-h-[1.25rem] rounded px-0.5 -mx-0.5 hover:bg-accent/40"
        >
          {selectedTopics.length > 0 ? (
            <TaskTopicTags topics={selectedTopics} maxVisible={3} />
          ) : (
            <span className="text-muted-foreground/40 italic text-xs">Add topics</span>
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
