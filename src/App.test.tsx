import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockDb, supabase } from './test/supabaseMock'
import App from './App'

vi.mock('./lib/supabase', async () => await import('./test/supabaseMock'))

beforeEach(() => mockDb.reset())

describe('App', () => {
  it('shows the sign-in form when there is no session', async () => {
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Sign in', pressed: true })).toBeInTheDocument()
  })

  it('shows the board for the signed-in user', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: { user: { id: 'u1', email: 'me@x.co' } } },
    } as never)
    render(<App />)
    expect(await screen.findByText('me@x.co')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Backlog' })).toBeInTheDocument()
  })
})
