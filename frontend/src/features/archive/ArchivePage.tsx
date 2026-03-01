import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TaskEmptyState } from '@/features/tasks/TaskEmptyState'
import { TaskTopicTags } from '@/features/tasks/TaskTopicTags'
import { useArchivedTasks, useRestoreTask } from '@/hooks/useArchive'
import { toast } from 'sonner'
import type { Task } from '@/types/task'

function ArchiveRow({ task }: { task: Task }) {
  const { mutate: restore, isPending } = useRestoreTask()

  function handleRestore() {
    restore(task.id, {
      onSuccess: () => toast.success('Task restored to active'),
      onError: () => toast.error('Failed to restore task'),
    })
  }

  return (
    <div className="group flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-muted/30">
      <div className="flex-1 min-w-0">
        <p className="text-sm line-through text-muted-foreground truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-1">
          {task.done_at && (
            <span className="text-xs text-muted-foreground">
              Done {format(parseISO(task.done_at), 'MMM d, yyyy')}
            </span>
          )}
          <TaskTopicTags topics={task.topics} />
        </div>
        {task.result_note && (
          <p className="text-xs text-muted-foreground mt-0.5 italic">"{task.result_note}"</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="opacity-0 group-hover:opacity-100 transition-opacity gap-1.5 text-muted-foreground"
        onClick={handleRestore}
        disabled={isPending}
      >
        <RotateCcw size={13} />
        Restore
      </Button>
    </div>
  )
}

export function ArchivePage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useArchivedTasks(page)
  const tasks = data?.tasks ?? []
  const meta = data?.meta

  const totalPages = meta ? Math.ceil(meta.total / meta.limit) : 1

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Archive</h1>
        {meta && (
          <span className="text-sm text-muted-foreground">{meta.total} tasks</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <TaskEmptyState isArchive />
      ) : (
        <>
          <div className="border border-border rounded-lg overflow-hidden">
            {tasks.map((task) => (
              <ArchiveRow key={task.id} task={task} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={14} />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )
}
