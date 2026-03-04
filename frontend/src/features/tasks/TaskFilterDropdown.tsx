import { ChevronDown } from 'lucide-react'
import type { TaskFilterWindow } from '@/types/task'

const FILTER_OPTIONS: { label: string; value: TaskFilterWindow }[] = [
  { label: 'All Tasks', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Within 3 Days', value: '3days' },
  { label: 'Within a Week', value: 'week' },
]

interface TaskFilterDropdownProps {
  value: TaskFilterWindow
  onChange: (value: TaskFilterWindow) => void
}

export function TaskFilterDropdown({ value, onChange }: TaskFilterDropdownProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TaskFilterWindow)}
        className="appearance-none pl-3 pr-7 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
        aria-label="Filter tasks"
      >
        {FILTER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
    </div>
  )
}
