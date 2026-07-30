import { supabase } from '@/lib/supabase'

/**
 * Guard against loading a driver past their vehicle's licensed capacity.
 * Counts the driver's currently-active children (optionally excluding one child
 * being re-checked during a reassignment) and compares to vehicleCapacity.
 *
 * Returns ok=true when no capacity is configured (null) — we don't block on
 * unknown limits, but a configured limit is enforced.
 */
export async function checkDriverCapacity(
  driverId: string,
  vehicleCapacity: number | null | undefined,
  excludeChildId?: string,
): Promise<{ ok: boolean; capacity: number | null; current: number }> {
  if (vehicleCapacity == null) return { ok: true, capacity: null, current: 0 }

  let query = supabase
    .from('Child')
    .select('id', { count: 'exact', head: true })
    .eq('driverId', driverId)
    .eq('isActive', true)
  if (excludeChildId) query = query.neq('id', excludeChildId)

  const { count } = await query
  const current = count ?? 0
  return { ok: current < vehicleCapacity, capacity: vehicleCapacity, current }
}
