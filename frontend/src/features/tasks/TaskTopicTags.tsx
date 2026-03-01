import type { Topic } from '@/types/topic'
import { Badge } from '@/components/ui/badge'

interface TaskTopicTagsProps {
  topics: Topic[]
  maxVisible?: number
}

export function TaskTopicTags({ topics, maxVisible = 2 }: TaskTopicTagsProps) {
  if (topics.length === 0) return null

  const visible = topics.slice(0, maxVisible)
  const overflow = topics.length - maxVisible

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((topic) => (
        <Badge key={topic.id} variant="secondary" className="text-[11px] px-1.5 py-0">
          {topic.name}
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge variant="outline" className="text-[11px] px-1.5 py-0">
          +{overflow}
        </Badge>
      )}
    </div>
  )
}
