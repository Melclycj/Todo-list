import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  const drawerRef = useRef<HTMLDivElement>(null)

  // Keep the drawer mounted during exit animation
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // Next frame: trigger enter transition
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
    }
  }, [open])

  // Move focus to first focusable element when drawer opens
  useEffect(() => {
    if (visible && drawerRef.current) {
      const first = drawerRef.current.querySelector<HTMLElement>(
        'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
      )
      first?.focus()
    }
  }, [visible])

  function handleTransitionEnd() {
    if (!visible) setMounted(false)
  }

  if (!mounted) return null

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

  // Full focus trap: keep Tab / Shift+Tab cycling within the drawer, plus Esc.
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key !== 'Tab' || !drawerRef.current) return
    const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const isPending = isCreatingTask || isCreatingTemplate

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/30 transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-drawer-title"
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-xl flex flex-col transition-transform duration-200 ease-out',
          visible ? 'translate-x-0' : 'translate-x-full'
        )}
        onTransitionEnd={handleTransitionEnd}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id="create-drawer-title" className="font-semibold text-foreground">
            {recurringOnly ? 'New Recurring Task' : 'New Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
