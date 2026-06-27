import { supabase } from '@/lib/supabase'

/** Read a PlatformConfig value by key. Returns null if unset. */
export async function getConfig(key: string): Promise<string | null> {
  const { data } = await supabase.from('PlatformConfig').select('value').eq('key', key).maybeSingle()
  return data?.value ?? null
}

/** True only when PAYMENTS_LIVE config is exactly 'true'. */
export async function isPaymentsLive(): Promise<boolean> {
  return (await getConfig('PAYMENTS_LIVE')) === 'true'
}
