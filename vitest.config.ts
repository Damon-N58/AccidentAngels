import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Resolve the `@/…` path alias (matches tsconfig paths) and provide dummy
// Supabase env so modules that construct the client at import time (e.g.
// lib/supabase) can be imported by unit tests without a real connection.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    },
  },
})
