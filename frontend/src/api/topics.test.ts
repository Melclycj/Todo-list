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
import { getTopics, createTopic, renameTopic, deleteTopic } from './topics'

const mockTopic = { id: '1', name: 'Work' }
const mockResponse = { success: true, data: mockTopic, error: null }

describe('topics api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getTopics calls GET /topics', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { success: true, data: [] } })
    await getTopics()
    expect(client.get).toHaveBeenCalledWith('/topics')
  })

  it('createTopic calls POST /topics', async () => {
    vi.mocked(client.post).mockResolvedValue({ data: mockResponse })
    await createTopic({ name: 'Work' })
    expect(client.post).toHaveBeenCalledWith('/topics', { name: 'Work' })
  })

  it('renameTopic calls PATCH /topics/:id', async () => {
    vi.mocked(client.patch).mockResolvedValue({ data: mockResponse })
    await renameTopic('1', { name: 'Personal' })
    expect(client.patch).toHaveBeenCalledWith('/topics/1', { name: 'Personal' })
  })

  it('deleteTopic calls DELETE /topics/:id', async () => {
    vi.mocked(client.delete).mockResolvedValue({ data: { success: true, data: null } })
    await deleteTopic('1')
    expect(client.delete).toHaveBeenCalledWith('/topics/1')
  })
})
