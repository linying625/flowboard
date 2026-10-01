import { afterEach, describe, expect, it, vi } from 'vitest'

// Exercises the real module (the rest of the suite mocks it).
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('supabase client config', () => {
  it('fails fast with setup instructions when env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    await expect(import('./supabase')).rejects.toThrow(/Missing Supabase config.*\.env\.example/)
  })

  it('creates a client when configured', async () => {
    const { supabase } = await import('./supabase')
    expect(typeof supabase.from).toBe('function')
  })
})
