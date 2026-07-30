import { supabase } from '@/lib/supabase'
import { formatZAR } from '@/lib/utils/cents'
import { Card, CardContent } from '@/components/ui/card'

// NOTE: This view intentionally shows real rand amounts + split breakdowns to
// admin, reversing the maskAmountForAdmin policy elsewhere — per explicit product
// request (needed to investigate billing/payout disputes). Keep it admin-only.
export const dynamic = 'force-dynamic'

const STATUS_STYLE: Record<string, string> = {
  SUCCESS:         'bg-[#0F6E56]/10 text-[#0F6E56]',
  PENDING:         'bg-[#5A6474]/10 text-[#5A6474]',
  RETRY_SCHEDULED: 'bg-[#F59E0B]/10 text-[#b8860b]',
  FAILED:          'bg-[#E24B4A]/10 text-[#E24B4A]',
  REFUNDED:        'bg-[#7c3aed]/10 text-[#7c3aed]',
  CANCELLED:       'bg-[#5A6474]/10 text-[#5A6474]',
}

export default async function AdminTransactionsPage() {
  const { data: txs } = await supabase
    .from('Transaction')
    .select('id, status, billingMonth, billingYear, grossAmountCents, gatewayFeeCents, providerReference, createdAt, parent:Parent(user:User(name)), driver:Driver(user:User(name)), child:Child(name), splits:TransactionSplit(partyLabel, partyKind, amountCents, resolvedSubAccountCode)')
    .order('createdAt', { ascending: false })
    .limit(200)

  const rows = txs ?? []

  return (
    <div className="p-6 max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#0F1923]">Transactions</h1>
        <p className="text-sm text-[#5A6474]">Most recent {rows.length} charges, with amounts and how each was split.</p>
      </div>

      {rows.length === 0 ? (
        <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
          <CardContent className="p-6 text-center text-[#5A6474]">No transactions yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((t: any) => {
            const splits = (t.splits ?? []) as any[]
            const period = `${String(t.billingMonth).padStart(2, '0')}/${t.billingYear}`
            return (
              <Card key={t.id} className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0F1923]">
                        {t.parent?.user?.name ?? 'Parent'} · {t.child?.name ?? 'Child'}
                        <span className="text-xs text-[#5A6474] font-normal"> → {t.driver?.user?.name ?? 'Driver'}</span>
                      </p>
                      <p className="text-xs text-[#5A6474]">{period} · ref {t.providerReference ?? '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-[#0F1923]">{formatZAR(t.grossAmountCents ?? 0)}</p>
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status] ?? 'bg-[#5A6474]/10 text-[#5A6474]'}`}>{t.status}</span>
                    </div>
                  </div>

                  {/* Split breakdown */}
                  <div className="mt-3 pt-3 border-t border-[rgba(236,61,58,0.08)] space-y-1">
                    <div className="flex justify-between text-xs text-[#5A6474]">
                      <span>Gateway fee</span><span>{formatZAR(t.gatewayFeeCents ?? 0)}</span>
                    </div>
                    {splits.length === 0 ? (
                      <p className="text-xs text-[#5A6474] italic">No split ledger (legacy/settled to main account).</p>
                    ) : (
                      splits.map((s, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-[#0F1923]">
                            {s.partyLabel} <span className="text-[#5A6474]">({s.partyKind.toLowerCase()})</span>
                            {s.resolvedSubAccountCode && <span className="text-[#0F6E56] ml-1">↳ routed</span>}
                          </span>
                          <span className="font-medium text-[#0F1923]">{formatZAR(s.amountCents ?? 0)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
