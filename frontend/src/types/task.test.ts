/**
 * Tests for the Task type definition.
 * These compile-time checks ensure the interface has required fields.
 */
import { describe, it, expect } from 'vitest'
import type { Task } from './task'

describe('Task type', () => {
  it('includes recurring_template_id field', () => {
    // Construct a valid Task object — TypeScript will error at compile time
    // if the interface is missing the field.
    const task: Task = {
      id: 'abc',
      title: 'Test',
      description: null,
      due_date: null,
      status: 'todo',
      result_note: null,
      archived: false,
      done_at: null,
      archived_at: null,
      manual_order: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      topics: [],
      recurring_template_id: null,
    }
    expect(task.recurring_template_id).toBeNull()
  })

  it('accepts a UUID string for recurring_template_id', () => {
    const task: Task = {
      id: 'abc',
      title: 'Recurring task',
      description: null,
      due_date: null,
      status: 'todo',
      result_note: null,
      archived: false,
      done_at: null,
      archived_at: null,
      manual_order: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      topics: [],
      recurring_template_id: '550e8400-e29b-41d4-a716-446655440000',
    }
    expect(task.recurring_template_id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })
})
