import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getAccessToken: vi.fn(() => null),
  setAccessToken: vi.fn(),
}))

import client from './client'
import { login, register, logout, refreshToken } from './auth'

describe('auth api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('login', () => {
    it('calls POST /auth/login with payload', async () => {
      vi.mocked(client.post).mockResolvedValue({ data: { success: true, data: { access_token: 'tok' } } })
      const payload = { email: 'a@b.com', password: 'pass' }
      await login(payload)
      expect(client.post).toHaveBeenCalledWith('/auth/login', payload)
    })

    it('returns the response data', async () => {
      const response = { success: true, data: { access_token: 'tok', token_type: 'bearer' } }
      vi.mocked(client.post).mockResolvedValue({ data: response })
      const result = await login({ email: 'a@b.com', password: 'pass' })
      expect(result).toEqual(response)
    })
  })

  describe('register', () => {
    it('calls POST /auth/register with payload', async () => {
      vi.mocked(client.post).mockResolvedValue({ data: { success: true, data: null } })
      const payload = { email: 'new@b.com', password: 'StrongPass1!' }
      await register(payload)
      expect(client.post).toHaveBeenCalledWith('/auth/register', payload)
    })
  })

  describe('logout', () => {
    it('calls POST /auth/logout', async () => {
      vi.mocked(client.post).mockResolvedValue({})
      await logout()
      expect(client.post).toHaveBeenCalledWith('/auth/logout')
    })
  })

  describe('refreshToken', () => {
    it('calls POST /auth/refresh', async () => {
      vi.mocked(client.post).mockResolvedValue({ data: { success: true, data: { access_token: 'new' } } })
      await refreshToken()
      expect(client.post).toHaveBeenCalledWith('/auth/refresh')
    })
  })
})
