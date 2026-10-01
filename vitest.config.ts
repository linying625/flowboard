import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Tests must never reach a real Supabase project, whatever .env.local says.
    env: {
      VITE_SUPABASE_URL: 'http://supabase.test.invalid',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    },
  },
})
