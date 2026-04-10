import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sidebar } from './Sidebar'
import { Button } from '@/components/ui/button'
import { useSidebarResize } from '@/hooks/useSidebarResize'

export function AppLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const { width: sidebarWidth, startDrag } = useSidebarResize()

  // Animated mobile sidebar state
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (mobileSidebarOpen) {
      setMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
    }
  }, [mobileSidebarOpen])

  function handleTransitionEnd() {
    if (!visible) setMounted(false)
  }

  function closeMobile() {
    setMobileSidebarOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-shrink-0" style={{ width: sidebarWidth }}>
        <Sidebar />
      </aside>

      {/* Drag handle — always visible, desktop only */}
      <div
        className="hidden lg:block w-0.5 flex-shrink-0 cursor-col-resize bg-border hover:bg-primary transition-colors"
        onMouseDown={startDrag}
      />

      {/* Mobile sidebar overlay */}
      {mounted && (
        <>
          <div
            className={cn(
              'fixed inset-0 z-40 bg-black/40 lg:hidden transition-opacity duration-200',
              visible ? 'opacity-100' : 'opacity-0'
            )}
            onClick={closeMobile}
          />
          <aside
            className={cn(
              'fixed inset-y-0 left-0 z-50 w-[260px] lg:hidden transition-transform duration-200 ease-out',
              visible ? 'translate-x-0' : '-translate-x-full'
            )}
            onTransitionEnd={handleTransitionEnd}
          >
            <Sidebar onClose={closeMobile} />
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </Button>
          <span className="font-semibold text-foreground">Todo</span>
        </header>

        {/* Page content fills remaining space */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
