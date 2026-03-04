import type { Topic } from './topic'

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface Task {
  id: string
  title: string
  description: string | null
  due_date: string | null
  status: TaskStatus
  result_note: string | null
  archived: boolean
  done_at: string | null
  archived_at: string | null
  manual_order: number | null
  created_at: string
  updated_at: string
  topics: Topic[]
}

export interface TaskCreatePayload {
  title: string
  description?: string | null
  due_date?: string | null
  status?: TaskStatus
  topic_ids?: string[]
}

export interface TaskUpdatePayload {
  title?: string
  description?: string | null
  due_date?: string | null
  result_note?: string | null
  topic_ids?: string[]
}

export interface TaskStatusUpdatePayload {
  status: TaskStatus
  result_note?: string | null
}

export interface TaskOrderUpdatePayload {
  manual_order: number
}

export type TaskFilterWindow = 'today' | '3days' | 'week' | 'all'

export interface TaskFilterParams {
  window?: TaskFilterWindow
  topic_id?: string
  q?: string
  page?: number
  limit?: number
}
