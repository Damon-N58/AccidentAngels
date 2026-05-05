import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { ParentTopBar } from '@/components/parent/ParentTopBar'
import { PaymentMethodPicker } from '@/components/payments/PaymentMethodPicker'
import { PaymentMethodBadge } from '@/components/payments/PaymentMethodBadge'
import { Card, CardContent } from '@/components/ui/card'
import { formatZAR } from '@/lib/utils/cents'

export default async function ParentPaymentsPage() {
  const cookieStore = await cookies()
  const session = await getSession(cookieStore.toString())
  if (!session) redirect('/parent-app/login')

  const { data: parent } = await supabase
    .from('Parent')
    .select('*, children:Child(id, name, monthlyFee, isActive)')
    .eq('userId', session.userId)
    .maybeSingle()
  if (!parent) redirect('/parent-app/login')

  const activeChildren = (parent.children ?? []).filter((c: any) => c.isActive)
  const totalMonthly = activeChildren.reduce((sum: number, c: any) => sum + (c.monthlyFee ?? 0), 0)

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <ParentTopBar title="Payments" />
      <div className="px-4 py-4 space-y-4">
        <div className="bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-xl p-3">
          <p className="text-sm font-medium text-[#0F1923]">Payments not yet live</p>
          <p className="text-xs text-[#5A6474] mt-0.5">Set up your payment method now. No charges until payments go live.</p>
        </div>

        {totalMonthly > 0 && (
          <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-[#0F1923]">Monthly transport</p>
                <p className="text-xl font-bold text-[#1A3F7A]">{formatZAR(totalMonthly)}</p>
              </div>
              {activeChildren.map((c: any) => (
                <div key={c.id} className="flex justify-between text-xs text-[#5A6474] mt-1">
                  <span>{c.name}</span>
                  <span>{c.monthlyFee ? formatZAR(c.monthlyFee) : '—'}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {parent.isPaymentSetup ? (
          <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-sm text-[#0F1923]">Payment method</p>
                <PaymentMethodBadge type={parent.paymentMethodType!} />
              </div>
              {parent.paymentMethodType === 'PAYSTACK_CARD' && parent.paystackCardLast4 && (
                <p className="text-sm text-[#5A6474]">
                  {parent.paystackCardBrand} ending ****{parent.paystackCardLast4}
                  {parent.paystackCardBank && ` · ${parent.paystackCardBank}`}
                </p>
              )}
              {parent.paymentMethodType === 'CAPITEC_PAY_VRP' && parent.capitecPayPhone && (
                <p className="text-sm text-[#5A6474]">Capitec Pay · {parent.capitecPayPhone}</p>
              )}
              <button className="text-xs text-[#5A6474] font-medium mt-3 underline cursor-default">Contact support to change</button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#0F1923]">Choose how you pay</p>
            <PaymentMethodPicker />
          </div>
        )}

        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardContent className="p-4 text-center py-8">
            <p className="text-sm text-[#5A6474]">Your payment history will appear here.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
