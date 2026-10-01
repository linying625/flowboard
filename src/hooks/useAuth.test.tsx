import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../test/supabaseMock'
import { useAuth } from './useAuth'

vi.mock('../lib/supabase', async () => await import('../test/supabaseMock'))

beforeEach(() => vi.clearAllMocks())

describe('useAuth', () => {
  it('finishes loading with no session and unsubscribes on unmount', async () => {
    const unsubscribe = vi.fn()
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValueOnce({
      data: { subscription: { unsubscribe } },
    } as never)
    const { result, unmount } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('returns the provider error message on failed sign-in', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    } as never)
    const { result } = renderHook(() => useAuth())
    let res
    await act(async () => {
      res = await result.current.signIn('a@b.co', 'x')
    })
    expect(res).toEqual({ error: 'Invalid login credentials' })
  })

  it('flags confirmation as needed when sign-up returns no session', async () => {
    const { result } = renderHook(() => useAuth())
    let res
    await act(async () => {
      res = await result.current.signUp('a@b.co', 'password1')
    })
    expect(res).toEqual({ error: null, needsConfirmation: true })
  })
})
