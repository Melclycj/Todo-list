import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TaskList } from './TaskList'
import { TaskSearchBar } from './TaskSearchBar'
import { TaskCreateDrawer } from './TaskCreateDrawer'
import { TaskFilterDropdown } from './TaskFilterDropdown'
import { useTasks } from '@/hooks/useTasks'
import { useDebounce } from '@/hooks/useDebounce'
import type { TaskFilterWindow } from '@/types/task'

const FILTER_LABELS: Record<TaskFilterWindow, string> = {
  all: 'All Tasks',
  today: 'Today',
  '3days': 'Within 3 Days',
  week: 'Within a Week',
}

const STORAGE_KEY = 'taskFilterWindow'

function readSavedFilter(): TaskFilterWindow {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && saved in FILTER_LABELS) return saved as TaskFilterWindow
  return 'all'
}

export function TaskListPage() {
  const [filterWindow, setFilterWindow] = useState<TaskFilterWindow>(readSavedFilter)
  const [searchQuery, setSearchQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const debouncedQuery = useDebounce(searchQuery, 300)

  const { data: tasks = [], isLoading } = useTasks({
    window: filterWindow,
    q: debouncedQuery || undefined,
  })

  function handleFilterChange(value: TaskFilterWindow) {
    setFilterWindow(value)
    localStorage.setItem(STORAGE_KEY, value)
  }

  const pageTitle = FILTER_LABELS[filterWindow]

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 gap-4 flex-shrink-0 border-b border-border">
        <div className="flex items-center gap-2">
          <TaskFilterDropdown value={filterWindow} onChange={handleFilterChange} />
          <TaskSearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground hidden sm:block">{pageTitle}</h1>
          <Button size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus size={14} />
            New Task
          </Button>
        </div>
      </div>

      {/* Task table — fills remaining space */}
      <div className="flex-1 overflow-hidden p-4">
        <TaskList
          tasks={tasks}
          isLoading={isLoading}
          filterWindow={filterWindow}
          isSearch={!!debouncedQuery}
          searchQuery={debouncedQuery}
          onCreateTask={() => setDrawerOpen(true)}
        />
      </div>

      {/* Create task drawer */}
      <TaskCreateDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
