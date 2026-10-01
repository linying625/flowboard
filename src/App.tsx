import { lazy, Suspense } from 'react'
import { AuthForm } from './components/AuthForm'
import { useAuth } from './hooks/useAuth'

const Board = lazy(() =>
  import('./components/Board').then((m) => ({ default: m.Board })),
)

export default function App() {
  const { session, loading, signIn, signUp, signOut } = useAuth()

  if (loading) return (
      <main id="main" className="page-status" role="status">
        Loading...
      </main>
    )

  if (!session) return <AuthForm onSignIn={signIn} onSignUp={signUp} />

  return (
    <Suspense
      fallback={
        <main id="main" className="page-status" role="status">
          Loading...
        </main>
      }
    >
      <Board
        key={session.user.id}
        email={session.user.email ?? ''}
        onSignOut={signOut}
      />
    </Suspense>
  )
}
