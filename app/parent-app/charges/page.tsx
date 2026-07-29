import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { isPaymentsLive } from '@/lib/config'
import { ParentTopBar } from '@/components/parent/ParentTopBar'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { Timer } from 'lucide-react'

/** Format seconds as "Xm Ys" */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export default async function ParentChargesPage() {
  const cookieStore = await cookies()
  const session = await getSession(cookieStore.toString())
  if (!session) redirect('/parent-app/login')
  if (session.role !== 'PARENT') redirect('/parent-app/login')

  // Resolve parent record
  const { data: parent } = await supabase
    .from('Parent')
    .select('id')
    .eq('userId', session.userId)
    .maybeSingle()
  if (!parent) redirect('/parent-app/login')

  // Fetch live waiting charges for this parent, newest first.
  // isLive=true keeps pre-billing (dormant) charges out of the parent-facing view,
  // consistent with the dashboard callout and the /api/waiting-charges endpoint.
  const [chargesResult, paymentsLive] = await Promise.all([
    supabase
      .from('WaitingCharge')
      .select('*, child:Child(name)')
      .eq('parentId', parent.id)
      .eq('isLive', true)
      .order('createdAt', { ascending: false }),
    isPaymentsLive(),
  ])

  const charges = chargesResult.data ?? []

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <ParentTopBar title="Waiting Charges" showBack />

      <div className="px-4 pb-24 pt-5 space-y-3">
        {charges.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center pt-24 text-center">
            <div className="w-14 h-14 rounded-full bg-[#5A6474]/10 flex items-center justify-center mb-4">
              <Timer className="w-7 h-7 text-[#5A6474]" />
            </div>
            <p className="text-sm font-semibold text-[#5A6474]">No waiting charges</p>
            <p className="text-xs text-[#5A6474]/70 mt-1">Charges appear here when a driver waits at pickup.</p>
          </div>
        ) : (
          charges.map((charge: any) => {
            // Determine pill status
            let pillLabel: string
            let pillClass: string
            if (charge.billedAt) {
              pillLabel = 'Billed'
              pillClass = 'bg-[#5A6474]/10 text-[#5A6474]'
            } else if (paymentsLive) {
              pillLabel = 'Pending invoice'
              pillClass = 'bg-[#fdc73e]/15 text-[#9A6A00]'
            } else {
              pillLabel = 'Recorded'
              pillClass = 'bg-[#5A6474]/10 text-[#5A6474]'
            }

            const childName: string = charge.child?.name ?? 'Unknown child'
            const createdAt: string = charge.createdAt
              ? format(new Date(charge.createdAt), 'd MMM yyyy')
              : '—'
            const duration: string = typeof charge.waitingSeconds === 'number'
              ? formatDuration(charge.waitingSeconds)
              : '—'
            const billableMinutes: number = charge.billableMinutes ?? 0
            const amount = ((charge.chargeCents ?? 0) / 100).toFixed(2)

            return (
              <Card
                key={charge.id}
                className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none"
              >
                <CardContent className="p-4">
                  {/* Header row: child name + status pill */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-sm font-bold text-[#0F1923]">{childName}</p>
                      <p className="text-xs text-[#5A6474] mt-0.5">{createdAt}</p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${pillClass}`}
                    >
                      {pillLabel}
                    </span>
                  </div>

                  {/* Detail rows */}
                  <div className="space-y-1.5 border-t border-[rgba(236,61,58,0.06)] pt-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#5A6474]">Waiting duration</span>
                      <span className="font-medium text-[#0F1923]">{duration}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#5A6474]">Billable minutes</span>
                      <span className="font-medium text-[#0F1923]">{billableMinutes} min</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#5A6474]">Amount</span>
                      <span className="font-bold text-[#ec3d3a]">R{amount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
