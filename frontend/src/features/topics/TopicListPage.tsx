import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TaskList } from '@/features/tasks/TaskList'
import { TaskCreateDrawer } from '@/features/tasks/TaskCreateDrawer'
import { useTopics } from '@/hooks/useTopics'
import { useTasks } from '@/hooks/useTasks'

export function TopicListPage() {
  const { id } = useParams<{ id: string }>()
  const { data: topics = [] } = useTopics()
  const { data: tasks = [], isLoading } = useTasks({ topic_id: id })
  const [drawerOpen, setDrawerOpen] = useState(false)

  const topic = topics.find((t) => t.id === id)

  return (
    <div className="flex flex-col h-full">
      {/* Page header — matches TaskListPage topbar */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{topic?.name ?? 'Topic'}</h1>
          <Button size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus size={14} />
            New Task
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <TaskList
          tasks={tasks}
          isLoading={isLoading}
          isTopicView
          filterKey={`topic:${id ?? ''}`}
          onCreateTask={() => setDrawerOpen(true)}
        />
      </div>

      <TaskCreateDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
