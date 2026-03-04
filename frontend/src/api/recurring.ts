import client from './client'
import type { ApiResponse } from '@/types/api'
import type {
  RecurringTemplate,
  RecurringCreatePayload,
  RecurringUpdatePayload,
} from '@/types/recurring'

export async function getRecurringTemplates(): Promise<ApiResponse<RecurringTemplate[]>> {
  const { data } = await client.get<ApiResponse<RecurringTemplate[]>>('/recurring')
  return data
}

export async function createRecurringTemplate(
  payload: RecurringCreatePayload
): Promise<ApiResponse<RecurringTemplate>> {
  const { data } = await client.post<ApiResponse<RecurringTemplate>>('/recurring', payload)
  return data
}

export async function updateRecurringTemplate(
  id: string,
  payload: RecurringUpdatePayload
): Promise<ApiResponse<RecurringTemplate>> {
  const { data } = await client.patch<ApiResponse<RecurringTemplate>>(`/recurring/${id}`, payload)
  return data
}

export async function stopRecurringTemplate(id: string): Promise<ApiResponse<null>> {
  const { data } = await client.delete<ApiResponse<null>>(`/recurring/${id}`)
  return data
}
