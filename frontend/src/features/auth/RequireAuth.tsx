import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getAccessToken, setAccessToken } from '@/api/client'
import { refreshToken } from '@/api/auth'

type AuthState = 'loading' | 'authenticated' | 'unauthenticated'

export function RequireAuth() {
  const location = useLocation()
  const [authState, setAuthState] = useState<AuthState>(
    getAccessToken() ? 'authenticated' : 'loading'
  )

  useEffect(() => {
    // Token already in memory — nothing to do
    if (getAccessToken()) return

    // No token in memory (e.g. page refresh): attempt silent refresh via cookie
    refreshToken()
      .then((response) => {
        if (response.success && response.data) {
          setAccessToken(response.data.access_token)
          setAuthState('authenticated')
        } else {
          setAuthState('unauthenticated')
        }
      })
      .catch(() => setAuthState('unauthenticated'))
  }, []) // run once on mount

  if (authState === 'loading') {
    return null // brief blank while the refresh request is in flight
  }

  if (authState === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
