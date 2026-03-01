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
import {
  getRecurringTemplates,
  createRecurringTemplate,
  updateRecurringTemplate,
  stopRecurringTemplate,
} from './recurring'

describe('recurring api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getRecurringTemplates calls GET /recurring', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { success: true, data: [] } })
    await getRecurringTemplates()
    expect(client.get).toHaveBeenCalledWith('/recurring')
  })

  it('createRecurringTemplate calls POST /recurring', async () => {
    vi.mocked(client.post).mockResolvedValue({ data: { success: true, data: {} } })
    const payload = { title: 'Weekly review', frequency: 'weekly' as const, topic_ids: [] }
    await createRecurringTemplate(payload)
    expect(client.post).toHaveBeenCalledWith('/recurring', payload)
  })

  it('updateRecurringTemplate calls PATCH /recurring/:id', async () => {
    vi.mocked(client.patch).mockResolvedValue({ data: { success: true, data: {} } })
    await updateRecurringTemplate('1', { title: 'Updated' })
    expect(client.patch).toHaveBeenCalledWith('/recurring/1', { title: 'Updated' })
  })

  it('stopRecurringTemplate calls DELETE /recurring/:id', async () => {
    vi.mocked(client.delete).mockResolvedValue({ data: { success: true, data: null } })
    await stopRecurringTemplate('1')
    expect(client.delete).toHaveBeenCalledWith('/recurring/1')
  })
})
