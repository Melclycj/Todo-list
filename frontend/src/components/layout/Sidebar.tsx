import { Link, NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { CheckSquare, Repeat, Archive, LogOut } from 'lucide-react'
import { ReminderBanner } from '@/features/reminder/ReminderBanner'
import { SidebarTopicList } from '@/features/topics/SidebarTopicList'
import { useLogout } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface NavItemProps {
  to: string
  icon: React.ReactNode
  label: string
  end?: boolean
}

function NavItem({ to, icon, label, end }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer',
          isActive
            ? 'bg-accent text-accent-foreground font-medium border-l-2 border-primary rounded-l-none'
            : 'text-foreground hover:bg-muted'
        )
      }
    >
      <span className="w-4 h-4 flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {children}
    </p>
  )
}

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { mutate: logout } = useLogout()

  function handleNavClick() {
    onClose?.()
  }

  return (
    <div className="flex flex-col h-full w-full bg-muted border-r border-border">
      {/* App name */}
      <div className="px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-base font-bold text-foreground">
          Todo
        </Link>
      </div>

      <Separator />

      {/* Reminder banner */}
      <ReminderBanner />

      {/* Scrollable nav area */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-1" onClick={handleNavClick}>
        <NavItem to="/" icon={<CheckSquare size={14} />} label="Active Tasks" end />

        <SectionLabel>Topics</SectionLabel>
        <SidebarTopicList onNavigate={handleNavClick} />

        <div className="mt-2">
          <NavItem to="/recurring" icon={<Repeat size={14} />} label="Recurring Tasks" />
          <NavItem to="/archive" icon={<Archive size={14} />} label="Archive" />
        </div>
      </nav>

      <Separator />

      {/* Logout */}
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 text-muted-foreground"
          onClick={() => logout()}
        >
          <LogOut size={14} />
          Sign out
        </Button>
      </div>
    </div>
  )
}

// Placeholder — SidebarTopicList is built in Phase 4
// For now we export a stub so Phase 2 compiles
