import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { TaskListPage } from '@/features/tasks/TaskListPage'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy-load less frequently visited pages to reduce initial bundle size
const TopicListPage = lazy(() =>
  import('@/features/topics/TopicListPage').then((m) => ({ default: m.TopicListPage }))
)
const RecurringPage = lazy(() =>
  import('@/features/recurring/RecurringPage').then((m) => ({ default: m.RecurringPage }))
)
const ArchivePage = lazy(() =>
  import('@/features/archive/ArchivePage').then((m) => ({ default: m.ArchivePage }))
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function PageFallback() {
  return (
    <div className="space-y-2 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full rounded-md" />
      ))}
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<TaskListPage />} />
              <Route
                path="/topics/:id"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <TopicListPage />
                  </Suspense>
                }
              />
              <Route
                path="/recurring"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <RecurringPage />
                  </Suspense>
                }
              />
              <Route
                path="/archive"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <ArchivePage />
                  </Suspense>
                }
              />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  )
}
