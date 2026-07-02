import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSubtask, updateSubtask, deleteSubtask } from '@/api/subtasks'
import type { SubtaskCreatePayload, SubtaskUpdatePayload } from '@/types/task'
import { TASKS_QUERY_KEY } from './useTasks'

export function useCreateSubtask(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: SubtaskCreatePayload) => createSubtask(taskId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] })
    },
  })
}

export function useUpdateSubtask(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ subtaskId, payload }: { subtaskId: string; payload: SubtaskUpdatePayload }) =>
      updateSubtask(taskId, subtaskId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] })
    },
  })
}

export function useDeleteSubtask(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (subtaskId: string) => deleteSubtask(taskId, subtaskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] })
    },
  })
}
