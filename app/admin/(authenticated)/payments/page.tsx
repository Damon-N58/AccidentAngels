import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { isPaymentsLive } from '@/lib/config'

// Admin never sees rand amounts (see maskAmountForAdmin policy). This page shows
// operational STATUS and links to configuration only — counts, not money.
export const dynamic = 'force-dynamic'

async function count(table: string, apply?: (q: any) => any): Promise<number> {
  let q = supabase.from(table).select('id', { count: 'exact', head: true })
  if (apply) q = apply(q)
  const { count } = await q
  return count ?? 0
}

export default async function AdminPaymentsPage() {
  const [
    live, parents, setupParents,
    txPending, txSuccess, txFailed, txRetry, txRefunded,
    assocTotal, assocWithSub,
  ] = await Promise.all([
    isPaymentsLive(),
    count('Parent'),
    count('Parent', q => q.eq('isPaymentSetup', true)),
    count('Transaction', q => q.eq('status', 'PENDING')),
    count('Transaction', q => q.eq('status', 'SUCCESS')),
    count('Transaction', q => q.eq('status', 'FAILED')),
    count('Transaction', q => q.eq('status', 'RETRY_SCHEDULED')),
    count('Transaction', q => q.eq('status', 'REFUNDED')),
    count('Association'),
    count('Association', q => q.not('paystackSubAccountCode', 'is', null)),
  ])

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#0F1923]">Payments</h1>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${live ? 'bg-[#0F6E56]/10 text-[#0F6E56]' : 'bg-[#b8860b]/10 text-[#b8860b]'}`}>
          {live ? 'LIVE — cards are being charged' : 'NOT LIVE — no charges (test mode)'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat label="Parents" value={parents} sub={`${setupParents} with payment set up`} />
        <Stat label="Charged (success)" value={txSuccess} />
        <Stat label="Pending" value={txPending} />
        <Stat label="Failed" value={txFailed} />
        <Stat label="Retry scheduled" value={txRetry} />
        <Stat label="Refunded" value={txRefunded} />
      </div>

      <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
        <CardContent className="p-5 space-y-3">
          <p className="font-semibold text-[#0F1923]">Payout routing</p>
          <p className="text-sm text-[#5A6474]">
            {assocWithSub}/{assocTotal} associations have a payout account.{' '}
            {assocWithSub < assocTotal && (
              <Link href="/admin/associations" className="text-[#c1272d] font-medium">Set the rest up →</Link>
            )}
          </p>
          <div className="pt-2 flex flex-wrap gap-2">
            <Link href="/admin/settings/splits" className="text-sm font-medium bg-[#c1272d] text-white rounded-xl px-4 py-2">Split configuration</Link>
            <Link href="/admin/associations" className="text-sm font-medium bg-white border border-[#c1272d] text-[#c1272d] rounded-xl px-4 py-2">Associations &amp; payout accounts</Link>
            <Link href="/admin/settings" className="text-sm font-medium bg-white border border-input text-[#5A6474] rounded-xl px-4 py-2">Fees &amp; go-live switch</Link>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-[#5A6474]">
        Amounts are intentionally hidden from admin. Configure how each payment is split on the
        {' '}<Link href="/admin/settings/splits" className="text-[#c1272d]">Split configuration</Link>{' '}screen; the go-live switch is under Settings.
      </p>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
      <CardContent className="p-4">
        <p className="text-2xl font-bold text-[#0F1923]">{value}</p>
        <p className="text-xs text-[#5A6474]">{label}</p>
        {sub && <p className="text-[10px] text-[#5A6474] mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}
