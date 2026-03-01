import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRegister } from '@/hooks/useAuth'

export function RegisterPage() {
  const navigate = useNavigate()
  const { mutate: register, isPending, error } = useRegister()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    if (!email.trim()) {
      setFieldError('Email is required.')
      return
    }
    if (password.length < 8) {
      setFieldError('Password must be at least 8 characters.')
      return
    }

    register(
      { email: email.trim(), password },
      {
        onSuccess: (res) => {
          if (res.success) {
            navigate('/login')
          } else {
            setFieldError(res.error ?? 'Registration failed.')
          }
        },
        onError: () => {
          setFieldError('Something went wrong. Please try again.')
        },
      }
    )
  }

  const displayError = fieldError ?? (error ? 'Something went wrong. Please try again.' : null)

  return (
    <AuthLayout>
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-1">Create account</h2>
        <p className="text-sm text-muted-foreground mb-5">Get started for free</p>

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
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>

          {displayError && (
            <p className="text-sm text-destructive">{displayError}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
