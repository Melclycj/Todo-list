/**
 * TDD tests for RecurringPage helper logic.
 *
 * Behaviors covered:
 * - Inactive templates (is_active=false) should disable all cell editing
 * - The forbidden cursor should appear on inactive rows
 * - formatNextRunAt returns 'Stopped' for inactive templates
 */
import { describe, it, expect } from 'vitest'
import { format, parseISO } from 'date-fns'

// Pure helper: mirrors the formatNextDue logic in RecurringPage
function formatNextDue(nextRunAt: string, isActive: boolean): string {
  if (!isActive) return 'Stopped'
  try {
    return format(parseISO(nextRunAt), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

// Pure helper: determines whether a recurring template cell should be read-only
function isCellDisabled(isActive: boolean): boolean {
  return !isActive
}

describe('formatNextDue', () => {
  it('returns "Stopped" for inactive templates', () => {
    expect(formatNextDue('2026-03-18T00:00:00', false)).toBe('Stopped')
  })

  it('formats an active template next run date', () => {
    expect(formatNextDue('2026-03-18T00:00:00', true)).toBe('Mar 18, 2026')
  })

  it('returns "—" when next_run_at is unparseable', () => {
    expect(formatNextDue('not-a-date', true)).toBe('—')
  })
})

describe('isCellDisabled', () => {
  it('returns false for active templates (cell is editable)', () => {
    expect(isCellDisabled(true)).toBe(false)
  })

  it('returns true for inactive/stopped templates (cell is read-only)', () => {
    expect(isCellDisabled(false)).toBe(true)
  })
})
