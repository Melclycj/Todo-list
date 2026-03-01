import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTask,
  deleteTask,
  getTasks,
  updateTask,
  updateTaskOrder,
  updateTaskStatus,
} from '@/api/tasks'
import type {
  TaskCreatePayload,
  TaskFilterParams,
  TaskOrderUpdatePayload,
  TaskStatusUpdatePayload,
  TaskUpdatePayload,
} from '@/types/task'

export const TASKS_QUERY_KEY = 'tasks'

export function useTasks(params?: TaskFilterParams) {
  return useQuery({
    queryKey: [TASKS_QUERY_KEY, params],
    queryFn: () => getTasks(params),
    select: (res) => res.data ?? [],
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: TaskCreatePayload) => createTask(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] })
    },
  })
}

export function useUpdateTask(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: TaskUpdatePayload) => updateTask(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] })
    },
  })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TaskStatusUpdatePayload }) =>
      updateTaskStatus(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] })
    },
  })
}

export function useReorderTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TaskOrderUpdatePayload }) =>
      updateTaskOrder(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] })
    },
  })
}
