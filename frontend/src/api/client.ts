import axios from 'axios'

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  withCredentials: true, // sends HTTP-only cookie for refresh token
})

// Attach access token to every request
client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// On 401: attempt silent refresh, then retry once
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

function subscribeToRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb)
}

function notifyRefreshSubscribers(token: string) {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribeToRefresh((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          resolve(client(originalRequest))
        })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}/auth/refresh`,
        {},
        { withCredentials: true }
      )
      const newToken: string = data.data.access_token
      setAccessToken(newToken)
      notifyRefreshSubscribers(newToken)
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      return client(originalRequest)
    } catch {
      setAccessToken(null)
      window.location.href = '/login'
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }
)

export default client
