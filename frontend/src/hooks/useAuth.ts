import { useMutation, useQueryClient } from '@tanstack/react-query'
import { login, logout, register } from '@/api/auth'
import { setAccessToken } from '@/api/client'
import type { LoginPayload, RegisterPayload } from '@/types/auth'

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (response) => {
      if (response.success && response.data) {
        setAccessToken(response.data.access_token)
        void queryClient.invalidateQueries()
      }
    },
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) => register(payload),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => logout(),
    onSettled: () => {
      setAccessToken(null)
      queryClient.clear()
      window.location.href = '/login'
    },
  })
}
