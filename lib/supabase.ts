import { createClient, SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any

const globalForSupabase = globalThis as unknown as { supabase: SupabaseClient<AnyDB> }

export const supabase: SupabaseClient<AnyDB> =
  globalForSupabase.supabase ??
  createClient<AnyDB>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

if (process.env.NODE_ENV !== 'production') globalForSupabase.supabase = supabase
