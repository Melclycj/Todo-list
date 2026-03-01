import { TaskForm, type TaskFormValues } from './TaskForm'
import { useUpdateTask } from '@/hooks/useTasks'
import { toast } from 'sonner'
import type { Task } from '@/types/task'

interface TaskRowExpandedProps {
  task: Task
  onClose: () => void
}

export function TaskRowExpanded({ task, onClose }: TaskRowExpandedProps) {
  const { mutate: updateTask, isPending } = useUpdateTask(task.id)

  function handleSubmit(values: TaskFormValues) {
    updateTask(
      {
        title: values.title,
        description: values.description || null,
        due_date: values.dueDate || null,
        topic_ids: values.topicIds,
      },
      {
        onSuccess: () => {
          toast.success('Task updated')
          onClose()
        },
        onError: () => toast.error('Failed to update task'),
      }
    )
  }

  return (
    <div className="px-8 py-4 bg-muted/40 border-b border-border">
      <TaskForm
        initialValues={{
          title: task.title,
          description: task.description ?? '',
          dueDate: task.due_date,
          topicIds: task.topics.map((t) => t.id),
        }}
        onSubmit={handleSubmit}
        onCancel={onClose}
        isPending={isPending}
        submitLabel="Save changes"
      />
    </div>
  )
}
