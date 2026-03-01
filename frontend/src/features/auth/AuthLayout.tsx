import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Todo</h1>
          <p className="text-sm text-muted-foreground mt-1">Stay on top of your day</p>
        </div>
        {children}
      </div>
    </div>
  )
}
