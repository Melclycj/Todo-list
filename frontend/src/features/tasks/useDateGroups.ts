import { useMemo } from 'react'
import type { Task } from '@/types/task'

const NO_DATE_KEY = '__no_date__'

export interface DateGroup {
  key: string
  tasks: Task[]
}

/**
 * Groups tasks by due_date (date-only string).
 * Tasks are assumed to already be sorted by due_date ASC, manual_order ASC from the backend.
 * Returns an ordered array of groups: dated groups first (ascending), then the no-date group.
 */
export function useDateGroups(tasks: Task[]): DateGroup[] {
  return useMemo(() => {
    const map = new Map<string, Task[]>()

    for (const task of tasks) {
      const key = task.due_date ? task.due_date.slice(0, 10) : NO_DATE_KEY
      const group = map.get(key)
      if (group) group.push(task)
      else map.set(key, [task])
    }

    const dated: DateGroup[] = []
    let noDate: DateGroup | null = null

    for (const [key, groupTasks] of map) {
      if (key === NO_DATE_KEY) noDate = { key, tasks: groupTasks }
      else dated.push({ key, tasks: groupTasks })
    }

    // dated groups are already in order (backend sorts by due_date ASC)
    if (noDate) dated.push(noDate)
    return dated
  }, [tasks])
}
