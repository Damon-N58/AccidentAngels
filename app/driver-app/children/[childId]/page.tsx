import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { DriverTopBar } from '@/components/driver/DriverTopBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatZAR } from '@/lib/utils/cents'
import { formatDate } from '@/lib/utils/formatters'
import { Phone, FileText, CreditCard } from 'lucide-react'

export default async function ChildDetailPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params
  const cookieStore = await cookies()
  const session = await getSession(cookieStore.toString())
  if (!session) redirect('/driver-app/login')

  const { data: child } = await supabase
    .from('Child')
    .select('*, parent:Parent(*, user:User(*))')
    .eq('id', childId)
    .maybeSingle()

  if (!child) notFound()

  const { data: contracts } = await supabase
    .from('Contract').select('*').eq('childId', childId)
    .order('createdAt', { ascending: false }).limit(1)
  const contract = contracts?.[0]

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar title={child.name} />
      <div className="px-4 py-4 space-y-4">

        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardContent className="p-4 space-y-3">
            <p className="font-bold text-base text-[#0F1923]">{child.name}</p>
            <Separator />
            {([
              ['School', child.schoolName],
              ['Grade', child.grade || '—'],
              ['Pickup', child.pickupAddress],
              ['Dropoff', child.dropoffAddress],
              ['Monthly fee', child.monthlyFee ? formatZAR(child.monthlyFee) + '/month' : '—'],
              child.startDate ? ['Start date', formatDate(new Date(child.startDate))] : null,
            ] as Array<[string, string] | null>).filter(Boolean).map((row) => { const [label, val] = row as [string, string]; return (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-[#5A6474]">{label}</span>
                <span className="font-medium text-[#0F1923] text-right">{val}</span>
              </div>
            )})}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardContent className="p-4">
            <p className="font-semibold text-sm text-[#0F1923] mb-3">Parent / Guardian</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-[#0F1923]">{child.parent.user.name}</p>
                <p className="text-xs text-[#5A6474]">{child.parent.user.phone}</p>
              </div>
              <a href={`tel:${child.parent.user.phone}`}>
                <Button size="sm" variant="outline" className="h-10 gap-2">
                  <Phone className="w-4 h-4" /> Call
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1A3F7A]" />
                <span className="font-semibold text-sm text-[#0F1923]">Contract</span>
              </div>
              {contract && <StatusBadge status={contract.status} />}
            </div>
            {contract ? (
              <Link href={`/driver-app/contracts/${contract.id}`}>
                <Button variant="outline" className="w-full h-10 text-[#1A3F7A] border-[#1A3F7A]/30">
                  {contract.status === 'PENDING_DRIVER_SIGNATURE' ? 'Sign contract →' : 'View contract →'}
                </Button>
              </Link>
            ) : (
              <p className="text-sm text-[#5A6474]">No contract yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-[#1A3F7A]" />
              <span className="font-semibold text-sm text-[#0F1923]">Payment</span>
            </div>
            <p className="text-sm text-[#5A6474]">
              {child.parent.isPaymentSetup
                ? `Payment method set up (${child.parent.paymentMethodType?.replace(/_/g, ' ')})`
                : 'Parent has not set up a payment method yet.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
