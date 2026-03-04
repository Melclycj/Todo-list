import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface TaskSearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function TaskSearchBar({ value, onChange, placeholder = 'Search tasks…' }: TaskSearchBarProps) {
  return (
    <div className="relative">
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-8"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
