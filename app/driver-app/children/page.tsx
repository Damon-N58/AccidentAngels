import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { DriverTopBar } from '@/components/driver/DriverTopBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Users, ChevronRight } from 'lucide-react'
import { formatZAR } from '@/lib/utils/cents'

export default async function ChildrenPage() {
  const cookieStore = await cookies()
  const session = await getSession(cookieStore.toString())
  if (!session) redirect('/driver-app/login')
  if (session.role !== 'DRIVER') redirect('/driver-app/login')

  const { data: driver } = await supabase.from('Driver').select('id').eq('userId', session.userId).maybeSingle()
  if (!driver) redirect('/driver-app/onboarding')

  const { data: childrenRaw } = await supabase
    .from('Child')
    .select('*, parent:Parent(user:User(*))')
    .eq('driverId', driver.id)
    .eq('isActive', true)
    .order('createdAt', { ascending: false })

  const childrenIds = (childrenRaw ?? []).map((c: any) => c.id)
  const { data: allContracts } = childrenIds.length > 0
    ? await supabase
        .from('Contract')
        .select('childId, status')
        .in('childId', childrenIds)
        .order('createdAt', { ascending: false })
    : { data: [] }

  // Keep only the latest contract per child
  const latestByChild = new Map<string, { status: string }>()
  for (const c of allContracts ?? []) {
    if (!latestByChild.has(c.childId)) latestByChild.set(c.childId, c)
  }

  const children = (childrenRaw ?? []).map((child: any) => ({
    ...child,
    contracts: latestByChild.has(child.id) ? [latestByChild.get(child.id)] : [],
  }))

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar title="Children" />
      <div className="px-4 py-4 space-y-3">
        <div className="flex justify-end">
          <Link href="/driver-app/children/add">
            <Button className="h-10 bg-[#ec3d3a] text-white text-sm">+ Add child</Button>
          </Link>
        </div>

        {children.length === 0 ? (
          <EmptyState icon={<Users />} title="No children yet" description="Add a child to start the contract and payment setup process." />
        ) : (
          children.map((child: any) => {
            const contract = child.contracts[0]
            return (
              <Link key={child.id} href={`/driver-app/children/${child.id}`}>
                <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[#0F1923]">{child.name}</p>
                      <p className="text-xs text-[#5A6474] mt-0.5">{child.schoolName}</p>
                      <p className="text-xs text-[#5A6474] mt-0.5">{child.parent.user.name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {child.monthlyFee && <span className="text-sm font-bold text-[#ec3d3a]">{formatZAR(child.monthlyFee)}/mo</span>}
                      {contract && <StatusBadge status={contract.status} />}
                      <ChevronRight className="w-4 h-4 text-[#5A6474]" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
