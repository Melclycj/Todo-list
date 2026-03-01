import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLogin } from '@/hooks/useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const { mutate: login, isPending, error } = useLogin()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    if (!email.trim() || !password) {
      setFieldError('Please enter your email and password.')
      return
    }

    login(
      { email: email.trim(), password },
      {
        onSuccess: (res) => {
          if (res.success) {
            navigate('/')
          } else {
            setFieldError(res.error ?? 'Invalid credentials.')
          }
        },
        onError: () => {
          setFieldError('Invalid credentials.')
        },
      }
    )
  }

  const displayError = fieldError ?? (error ? 'Something went wrong. Please try again.' : null)

  return (
    <AuthLayout>
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-1">Sign in</h2>
        <p className="text-sm text-muted-foreground mb-5">Welcome back</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {displayError && (
            <p className="text-sm text-destructive">{displayError}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground mt-4">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-primary hover:underline">
            Register
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
