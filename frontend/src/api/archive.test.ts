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
import { getArchivedTasks, restoreTask } from './archive'

describe('archive api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getArchivedTasks calls GET /archive', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { success: true, data: [] } })
    await getArchivedTasks()
    expect(client.get).toHaveBeenCalledWith('/archive', { params: undefined })
  })

  it('getArchivedTasks passes pagination params', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { success: true, data: [] } })
    await getArchivedTasks({ page: 2, limit: 10 })
    expect(client.get).toHaveBeenCalledWith('/archive', { params: { page: 2, limit: 10 } })
  })

  it('restoreTask calls POST /archive/:id/restore', async () => {
    vi.mocked(client.post).mockResolvedValue({ data: { success: true, data: {} } })
    await restoreTask('abc')
    expect(client.post).toHaveBeenCalledWith('/archive/abc/restore')
  })
})
