import client from './client'
import type { ApiResponse } from '@/types/api'
import type { Subtask, SubtaskCreatePayload, SubtaskUpdatePayload } from '@/types/task'

export async function getSubtasks(taskId: string): Promise<ApiResponse<Subtask[]>> {
  const { data } = await client.get<ApiResponse<Subtask[]>>(`/tasks/${taskId}/subtasks`)
  return data
}

export async function createSubtask(
  taskId: string,
  payload: SubtaskCreatePayload
): Promise<ApiResponse<Subtask>> {
  const { data } = await client.post<ApiResponse<Subtask>>(`/tasks/${taskId}/subtasks`, payload)
  return data
}

export async function updateSubtask(
  taskId: string,
  subtaskId: string,
  payload: SubtaskUpdatePayload
): Promise<ApiResponse<Subtask>> {
  const { data } = await client.patch<ApiResponse<Subtask>>(
    `/tasks/${taskId}/subtasks/${subtaskId}`,
    payload
  )
  return data
}

export async function deleteSubtask(
  taskId: string,
  subtaskId: string
): Promise<ApiResponse<null>> {
  const { data } = await client.delete<ApiResponse<null>>(
    `/tasks/${taskId}/subtasks/${subtaskId}`
  )
  return data
}
