import client from './client'
import type { ApiResponse } from '@/types/api'
import { getAccessToken } from './client'

export async function getReminder(): Promise<ApiResponse<{ message: string }>> {
  const { data } = await client.get<ApiResponse<{ message: string }>>('/reminder')
  return data
}

export function createReminderStream(): EventSource {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
  const token = getAccessToken()
  const url = token
    ? `${baseUrl}/reminder/stream?token=${encodeURIComponent(token)}`
    : `${baseUrl}/reminder/stream`
  return new EventSource(url, { withCredentials: true })
}
