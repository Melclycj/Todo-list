import type { Topic } from './topic'

export type RecurringFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly'

export interface RecurringTemplate {
  id: string
  title: string
  description: string | null
  frequency: RecurringFrequency
  is_active: boolean
  next_run_at: string
  due_date: string | null
  created_at: string
  topics: Topic[]
}

export interface RecurringCreatePayload {
  title: string
  description?: string | null
  frequency: RecurringFrequency
  due_date?: string | null
  topic_ids?: string[]
}

export interface RecurringUpdatePayload {
  title?: string
  description?: string | null
  frequency?: RecurringFrequency
  next_run_at?: string
  topic_ids?: string[]
}
