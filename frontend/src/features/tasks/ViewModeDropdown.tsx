import { ChevronDown } from 'lucide-react'
import type { ViewMode } from '@/types/task'

const VIEW_OPTIONS: { label: string; value: ViewMode }[] = [
  { label: 'Table', value: 'table' },
  { label: 'Task Board', value: 'board' },
]

interface ViewModeDropdownProps {
  value: ViewMode
  onChange: (value: ViewMode) => void
}

export function ViewModeDropdown({ value, onChange }: ViewModeDropdownProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ViewMode)}
        className="appearance-none pl-3 pr-7 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
        aria-label="View mode"
      >
        {VIEW_OPTIONS.map((opt) => (
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
