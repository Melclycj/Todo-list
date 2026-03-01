import type { Topic } from './topic'

export type RecurringFrequency = 'weekly' | 'fortnightly' | 'monthly'

export interface RecurringTemplate {
  id: string
  title: string
  description: string | null
  frequency: RecurringFrequency
  is_active: boolean
  next_run_at: string
  created_at: string
  topics: Topic[]
}

export interface RecurringCreatePayload {
  title: string
  description?: string | null
  frequency: RecurringFrequency
  topic_ids?: string[]
}

export interface RecurringUpdatePayload {
  title?: string
  description?: string | null
  frequency?: RecurringFrequency
  topic_ids?: string[]
}
