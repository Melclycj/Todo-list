import { X } from 'lucide-react'
import { TaskForm, type TaskFormValues } from './TaskForm'
import { useCreateTask } from '@/hooks/useTasks'
import { useCreateRecurringTemplate } from '@/hooks/useRecurring'
import { toast } from 'sonner'

interface TaskCreateDrawerProps {
  open: boolean
  onClose: () => void
  /** When true, recurring toggle is pre-checked and cannot be unchecked */
  recurringOnly?: boolean
}

export function TaskCreateDrawer({ open, onClose, recurringOnly = false }: TaskCreateDrawerProps) {
  const { mutate: createTask, isPending: isCreatingTask } = useCreateTask()
  const { mutate: createTemplate, isPending: isCreatingTemplate } = useCreateRecurringTemplate()

  if (!open) return null

  function handleSubmit(values: TaskFormValues) {
    if (values.isRecurring) {
      createTemplate(
        {
          title: values.title,
          description: values.description || null,
          frequency: values.frequency,
          due_date: values.dueDate || null,
          topic_ids: values.topicIds,
        },
        {
          onSuccess: () => {
            toast.success('Recurring task created')
            onClose()
          },
          onError: () => toast.error('Failed to create recurring task'),
        }
      )
    } else {
      createTask(
        {
          title: values.title,
          description: values.description || null,
          due_date: values.dueDate || null,
          topic_ids: values.topicIds,
        },
        {
          onSuccess: () => {
            toast.success('Task created')
            onClose()
          },
          onError: () => toast.error('Failed to create task'),
        }
      )
    }
  }

  const isPending = isCreatingTask || isCreatingTemplate

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">
            {recurringOnly ? 'New Recurring Task' : 'New Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <TaskForm
            onSubmit={handleSubmit}
            onCancel={onClose}
            isPending={isPending}
            submitLabel={recurringOnly ? 'Create Template' : 'Create Task'}
            recurringOnly={recurringOnly}
          />
        </div>
      </div>
    </>
  )
}
