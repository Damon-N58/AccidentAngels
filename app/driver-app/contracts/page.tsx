import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { DriverTopBar } from '@/components/driver/DriverTopBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils/formatters'
import { formatZAR } from '@/lib/utils/cents'

export default async function ContractsPage() {
  const cookieStore = await cookies()
  const session = await getSession(cookieStore.toString())
  if (!session) redirect('/driver-app/login')
  if (session.role !== 'DRIVER') redirect('/driver-app/login')

  const { data: driver } = await supabase.from('Driver').select('id').eq('userId', session.userId).maybeSingle()
  if (!driver) redirect('/driver-app/onboarding')

  const { data: contracts } = await supabase
    .from('Contract')
    .select('*, child:Child(*), parent:Parent(user:User(*))')
    .eq('driverId', driver.id)
    .order('createdAt', { ascending: false })

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar title="Contracts" />
      <div className="px-4 py-4 space-y-3">
        {(contracts ?? []).length === 0 ? (
          <EmptyState icon={<FileText />} title="No contracts yet" description="Contracts are created when you add a child." />
        ) : (
          (contracts ?? []).map((contract: any) => (
            <Link key={contract.id} href={`/driver-app/contracts/${contract.id}`}>
              <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#0F1923]">{contract.child.name}</p>
                    <p className="text-xs text-[#5A6474] mt-0.5">{contract.parent.user.name}</p>
                    <p className="text-xs text-[#5A6474] mt-0.5">
                      From {formatDate(new Date(contract.startDate))} · {formatZAR(contract.monthlyAmountCents)}/mo
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={contract.status} />
                    <ChevronRight className="w-4 h-4 text-[#5A6474]" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
