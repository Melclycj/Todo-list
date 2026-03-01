import client from './client'
import type { ApiResponse } from '@/types/api'
import type {
  Task,
  TaskCreatePayload,
  TaskUpdatePayload,
  TaskStatusUpdatePayload,
  TaskOrderUpdatePayload,
  TaskFilterParams,
} from '@/types/task'

export async function getTasks(params?: TaskFilterParams): Promise<ApiResponse<Task[]>> {
  const { data } = await client.get<ApiResponse<Task[]>>('/tasks', { params })
  return data
}

export async function getTask(id: string): Promise<ApiResponse<Task>> {
  const { data } = await client.get<ApiResponse<Task>>(`/tasks/${id}`)
  return data
}

export async function createTask(payload: TaskCreatePayload): Promise<ApiResponse<Task>> {
  const { data } = await client.post<ApiResponse<Task>>('/tasks', payload)
  return data
}

export async function updateTask(id: string, payload: TaskUpdatePayload): Promise<ApiResponse<Task>> {
  const { data } = await client.patch<ApiResponse<Task>>(`/tasks/${id}`, payload)
  return data
}

export async function deleteTask(id: string): Promise<ApiResponse<null>> {
  const { data } = await client.delete<ApiResponse<null>>(`/tasks/${id}`)
  return data
}

export async function updateTaskStatus(
  id: string,
  payload: TaskStatusUpdatePayload
): Promise<ApiResponse<Task>> {
  const { data } = await client.patch<ApiResponse<Task>>(`/tasks/${id}/status`, payload)
  return data
}

export async function updateTaskOrder(
  id: string,
  payload: TaskOrderUpdatePayload
): Promise<ApiResponse<Task>> {
  const { data } = await client.patch<ApiResponse<Task>>(`/tasks/${id}/order`, payload)
  return data
}
