import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRecurringTemplate,
  getRecurringTemplates,
  stopRecurringTemplate,
  updateRecurringTemplate,
} from '@/api/recurring'
import type { RecurringCreatePayload, RecurringUpdatePayload } from '@/types/recurring'
import { TASKS_QUERY_KEY } from './useTasks'

export const RECURRING_QUERY_KEY = 'recurring'

export function useRecurringTemplates() {
  return useQuery({
    queryKey: [RECURRING_QUERY_KEY],
    queryFn: getRecurringTemplates,
    select: (res) => res.data ?? [],
  })
}

export function useCreateRecurringTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: RecurringCreatePayload) => createRecurringTemplate(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [RECURRING_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] })
    },
  })
}

export function useUpdateRecurringTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RecurringUpdatePayload }) =>
      updateRecurringTemplate(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [RECURRING_QUERY_KEY] })
    },
  })
}

export function useStopRecurringTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => stopRecurringTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [RECURRING_QUERY_KEY] })
    },
  })
}
