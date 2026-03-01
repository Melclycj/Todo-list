import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getArchivedTasks, restoreTask } from '@/api/archive'
import { TASKS_QUERY_KEY } from './useTasks'

export const ARCHIVE_QUERY_KEY = 'archive'

export function useArchivedTasks(page = 1) {
  return useQuery({
    queryKey: [ARCHIVE_QUERY_KEY, page],
    queryFn: () => getArchivedTasks({ page, limit: 20 }),
    select: (res) => ({ tasks: res.data ?? [], meta: res.meta }),
  })
}

export function useRestoreTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => restoreTask(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ARCHIVE_QUERY_KEY] })
      void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] })
    },
  })
}
