import client from './client'
import type { ApiResponse } from '@/types/api'
import type { Topic, TopicCreatePayload, TopicRenamePayload } from '@/types/topic'

export async function getTopics(): Promise<ApiResponse<Topic[]>> {
  const { data } = await client.get<ApiResponse<Topic[]>>('/topics')
  return data
}

export async function createTopic(payload: TopicCreatePayload): Promise<ApiResponse<Topic>> {
  const { data } = await client.post<ApiResponse<Topic>>('/topics', payload)
  return data
}

export async function renameTopic(id: string, payload: TopicRenamePayload): Promise<ApiResponse<Topic>> {
  const { data } = await client.patch<ApiResponse<Topic>>(`/topics/${id}`, payload)
  return data
}

export async function deleteTopic(id: string): Promise<ApiResponse<null>> {
  const { data } = await client.delete<ApiResponse<null>>(`/topics/${id}`)
  return data
}
