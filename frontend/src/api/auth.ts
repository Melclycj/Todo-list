import client from './client'
import type { ApiResponse } from '@/types/api'
import type { AuthTokens, LoginPayload, RegisterPayload } from '@/types/auth'

export async function login(payload: LoginPayload): Promise<ApiResponse<AuthTokens>> {
  const { data } = await client.post<ApiResponse<AuthTokens>>('/auth/login', payload)
  return data
}

export async function register(payload: RegisterPayload): Promise<ApiResponse<null>> {
  const { data } = await client.post<ApiResponse<null>>('/auth/register', payload)
  return data
}

export async function logout(): Promise<void> {
  await client.post('/auth/logout')
}

export async function refreshToken(): Promise<ApiResponse<AuthTokens>> {
  const { data } = await client.post<ApiResponse<AuthTokens>>('/auth/refresh')
  return data
}
