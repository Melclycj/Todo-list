import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TaskList } from './TaskList'
import { TaskSearchBar } from './TaskSearchBar'
import { TaskCreateDrawer } from './TaskCreateDrawer'
import { useTasks } from '@/hooks/useTasks'
import { useDebounce } from '@/hooks/useDebounce'
import type { TaskFilterWindow } from '@/types/task'

const FILTER_LABELS: Record<string, string> = {
  today: 'Today',
  '3days': 'Within 3 Days',
  week: 'Within a Week',
  all: 'All Tasks',
}

export function TaskListPage() {
  const [searchParams] = useSearchParams()
  const filterWindow = (searchParams.get('window') ?? 'all') as TaskFilterWindow

  const [searchQuery, setSearchQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const debouncedQuery = useDebounce(searchQuery, 300)

  const { data: tasks = [], isLoading } = useTasks({
    window: filterWindow,
    q: debouncedQuery || undefined,
  })

  const pageTitle = FILTER_LABELS[filterWindow] ?? 'Active Tasks'

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
        <Button size="sm" onClick={() => setDrawerOpen(true)}>
          <Plus size={14} />
          New Task
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <TaskSearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Task list */}
      <TaskList
        tasks={tasks}
        isLoading={isLoading}
        filterWindow={filterWindow}
        isSearch={!!debouncedQuery}
        searchQuery={debouncedQuery}
        onCreateTask={() => setDrawerOpen(true)}
      />

      {/* Create task drawer */}
      <TaskCreateDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
