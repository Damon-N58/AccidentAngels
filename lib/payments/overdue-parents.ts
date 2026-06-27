import { supabase } from '@/lib/supabase'

/** Returns the set of parentIds that have an OVERDUE balance with this driver.
 * Overdue = Transaction status in (PENDING,FAILED,RETRY_SCHEDULED) with billing period before current month. */
export async function getOverdueParentIds(driverId: string): Promise<Set<string>> {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // getMonth() is 0-indexed

  const { data, error } = await supabase
    .from('Transaction')
    .select('parentId, billingYear, billingMonth')
    .eq('driverId', driverId)
    .in('status', ['PENDING', 'FAILED', 'RETRY_SCHEDULED'])

  if (error) throw new Error('Overdue check failed: ' + error.message)

  const overdue = new Set<string>()
  for (const t of data ?? []) {
    // Only flag transactions whose billing period is strictly before the current month
    if (
      t.billingYear < currentYear ||
      (t.billingYear === currentYear && t.billingMonth < currentMonth)
    ) {
      if (t.parentId) overdue.add(t.parentId)
    }
  }
  return overdue
}
