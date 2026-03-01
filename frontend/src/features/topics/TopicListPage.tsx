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
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {topic?.name ?? 'Topic'}
        </h1>
        <Button size="sm" onClick={() => setDrawerOpen(true)}>
          <Plus size={14} />
          New Task
        </Button>
      </div>

      <TaskList
        tasks={tasks}
        isLoading={isLoading}
        isTopicView
        onCreateTask={() => setDrawerOpen(true)}
      />

      <TaskCreateDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
