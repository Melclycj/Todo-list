import client from './client'
import type { ApiResponse } from '@/types/api'
import type { Task } from '@/types/task'

export async function getArchivedTasks(params?: {
  page?: number
  limit?: number
}): Promise<ApiResponse<Task[]>> {
  const { data } = await client.get<ApiResponse<Task[]>>('/archive', { params })
  return data
}

export async function restoreTask(id: string): Promise<ApiResponse<Task>> {
  const { data } = await client.post<ApiResponse<Task>>(`/archive/${id}/restore`)
  return data
}
