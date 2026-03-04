import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTopic, deleteTopic, getTopics, renameTopic } from '@/api/topics'
import type { TopicCreatePayload, TopicRenamePayload } from '@/types/topic'
import { TASKS_QUERY_KEY } from './useTasks'

export const TOPICS_QUERY_KEY = 'topics'

export function useTopics() {
  return useQuery({
    queryKey: [TOPICS_QUERY_KEY],
    queryFn: getTopics,
    select: (res) => res.data ?? [],
  })
}

export function useCreateTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: TopicCreatePayload) => createTopic(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TOPICS_QUERY_KEY] })
    },
  })
}

export function useRenameTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TopicRenamePayload }) =>
      renameTopic(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TOPICS_QUERY_KEY] })
    },
  })
}

export function useDeleteTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteTopic(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TOPICS_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] })
    },
  })
}
