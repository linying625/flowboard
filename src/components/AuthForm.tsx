import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthResult } from '../hooks/useAuth'
import logoLarge from '../assets/icons/logo-lg.svg'

type Mode = 'signin' | 'signup'

interface AuthFormProps {
  onSignIn: (email: string, password: string) => Promise<AuthResult>
  onSignUp: (email: string, password: string) => Promise<AuthResult>
}

export function AuthForm({ onSignIn, onSignUp }: AuthFormProps) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    const result =
      mode === 'signin'
        ? await onSignIn(email.trim(), password)
        : await onSignUp(email.trim(), password)
    setBusy(false)
    if (result.error) {
      setError(result.error)
    } else if (result.needsConfirmation) {
      setNotice('Check your email to confirm your account, then sign in.')
      setMode('signin')
      setPassword('')
    }
  }

  return (
    <main id="main" className="auth-page">
      <div className="auth-brand">
        <span className="auth-brand__logo">
          <img src={logoLarge} width={24} height={24} alt="" />
        </span>
        <h1 className="auth-brand__name">FlowBoard</h1>
        <p className="auth-brand__tagline">Sign in to manage your boards</p>
      </div>

      <div className="auth-card">
        <div className="tabs" role="group" aria-label="Authentication mode">
          <button
            type="button"
            aria-pressed={mode === 'signin'}
            className="tabs__tab"
            onClick={() => switchMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            aria-pressed={mode === 'signup'}
            className="tabs__tab"
            onClick={() => switchMode('signup')}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field field--primary">
            <label htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field field--primary">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
              required
              minLength={8}
              aria-describedby={mode === 'signup' ? 'auth-password-hint' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'signup' && (
              <p id="auth-password-hint" className="field__hint">
                Use at least 8 characters.
              </p>
            )}
          </div>

          {error && (
            <p className="auth-message auth-message--error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="auth-message auth-message--notice" role="status">
              {notice}
            </p>
          )}

          <button type="submit" className="btn btn--primary auth-submit" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  )
}
