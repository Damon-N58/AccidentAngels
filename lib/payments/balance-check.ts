import { supabase } from '@/lib/supabase'

/**
 * Returns whether a parent has an overdue unpaid balance with a specific driver.
 * "Overdue" = a Transaction with status PENDING/FAILED/RETRY_SCHEDULED whose
 * billing period (billingYear + billingMonth) is strictly before the current month.
 */
export async function hasOutstandingBalance(
  parentId: string,
  driverId: string
): Promise<{ blocked: boolean; driverName: string | null }> {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // getMonth() is 0-indexed

  const { data: transactions, error } = await supabase
    .from('Transaction')
    .select('id, billingYear, billingMonth, driverId')
    .eq('parentId', parentId)
    .eq('driverId', driverId)
    .in('status', ['PENDING', 'FAILED', 'RETRY_SCHEDULED'])
    .order('billingYear', { ascending: true })
    .order('billingMonth', { ascending: true })

  if (error) throw new Error(`Balance check failed: ${error.message}`)

  if (!transactions || transactions.length === 0) {
    return { blocked: false, driverName: null }
  }

  // Check if any transaction's billing period is before the current month
  const hasOverdue = transactions.some(
    (t) =>
      t.billingYear < currentYear ||
      (t.billingYear === currentYear && t.billingMonth < currentMonth)
  )

  if (!hasOverdue) {
    return { blocked: false, driverName: null }
  }

  // Fetch driver name via Driver → User join
  const { data: driver } = await supabase
    .from('Driver')
    .select('user:User(name)')
    .eq('id', driverId)
    .maybeSingle()

  const driverName = (driver?.user as any)?.name ?? null

  return { blocked: true, driverName }
}
