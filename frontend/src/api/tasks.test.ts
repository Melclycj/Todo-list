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
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskOrder,
} from './tasks'

const mockTask = { id: '1', title: 'Test', status: 'todo', archived: false, topics: [], created_at: '' }
const mockResponse = { success: true, data: mockTask, error: null }

describe('tasks api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getTasks calls GET /tasks', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { success: true, data: [] } })
    await getTasks()
    expect(client.get).toHaveBeenCalledWith('/tasks', { params: undefined })
  })

  it('getTasks passes filter params', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { success: true, data: [] } })
    await getTasks({ q: 'hello' })
    expect(client.get).toHaveBeenCalledWith('/tasks', { params: { q: 'hello' } })
  })

  it('getTask calls GET /tasks/:id', async () => {
    vi.mocked(client.get).mockResolvedValue({ data: mockResponse })
    await getTask('1')
    expect(client.get).toHaveBeenCalledWith('/tasks/1')
  })

  it('createTask calls POST /tasks', async () => {
    vi.mocked(client.post).mockResolvedValue({ data: mockResponse })
    await createTask({ title: 'New task' })
    expect(client.post).toHaveBeenCalledWith('/tasks', { title: 'New task' })
  })

  it('updateTask calls PATCH /tasks/:id', async () => {
    vi.mocked(client.patch).mockResolvedValue({ data: mockResponse })
    await updateTask('1', { title: 'Updated' })
    expect(client.patch).toHaveBeenCalledWith('/tasks/1', { title: 'Updated' })
  })

  it('deleteTask calls DELETE /tasks/:id', async () => {
    vi.mocked(client.delete).mockResolvedValue({ data: { success: true, data: null } })
    await deleteTask('1')
    expect(client.delete).toHaveBeenCalledWith('/tasks/1')
  })

  it('updateTaskStatus calls PATCH /tasks/:id/status', async () => {
    vi.mocked(client.patch).mockResolvedValue({ data: mockResponse })
    await updateTaskStatus('1', { status: 'in_progress' })
    expect(client.patch).toHaveBeenCalledWith('/tasks/1/status', { status: 'in_progress' })
  })

  it('updateTaskOrder calls PATCH /tasks/:id/order', async () => {
    vi.mocked(client.patch).mockResolvedValue({ data: mockResponse })
    await updateTaskOrder('1', { manual_order: 2 })
    expect(client.patch).toHaveBeenCalledWith('/tasks/1/order', { manual_order: 2 })
  })
})
