import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface AuthResult {
  error: string | null
  /** True when sign-up succeeded but the user must confirm their email first. */
  needsConfirmation?: boolean
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error?.message ?? null }
    },
    [],
  )

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) return { error: error.message }
      return { error: null, needsConfirmation: !data.session }
    },
    [],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return { session, loading, signIn, signUp, signOut }
}
