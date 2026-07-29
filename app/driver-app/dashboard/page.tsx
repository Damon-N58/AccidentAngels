import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { DriverTopBar } from '@/components/driver/DriverTopBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, AlertTriangle, CheckCircle2, Bell, Sun, Moon, Navigation } from 'lucide-react'
import { formatZAR } from '@/lib/utils/cents'

export default async function DriverDashboardPage() {
  const cookieStore = await cookies()
  const session = await getSession(cookieStore.toString())
  if (!session) redirect('/driver-app/login')
  if (session.role !== 'DRIVER') redirect('/driver-app/login')

  const { data: driver, error: driverErr } = await supabase
    .from('Driver').select('*').eq('userId', session.userId).maybeSingle()

  if (driverErr) {
    console.error('[dashboard] Failed to fetch driver:', driverErr)
    return (
      <div className="min-h-screen bg-[#F8F9FB] px-4 pt-20 text-center">
        <p className="text-[#E24B4A] font-semibold mb-1">Something went wrong</p>
        <p className="text-sm text-[#5A6474]">Could not load your profile. Try refreshing.</p>
      </div>
    )
  }

  if (!driver) redirect('/driver-app/onboarding')

  const todayStr = new Date().toISOString().split('T')[0]
  let { data: todayTripsData } = await supabase
    .from('Trip')
    .select('*, stops:TripStop(*, child:Child(name, schoolName))')
    .eq('driverId', driver.id)
    .eq('date', todayStr)
    .order('createdAt', { ascending: true })

  // Auto-generate trips if none exist for today
  if (!todayTripsData?.length) {
    const { generateTripsForDriver } = await import('@/lib/trips/generate')
    await generateTripsForDriver(driver.id, todayStr)
    const { data: generated } = await supabase
      .from('Trip')
      .select('*, stops:TripStop(*, child:Child(name, schoolName))')
      .eq('driverId', driver.id)
      .eq('date', todayStr)
      .order('createdAt', { ascending: true })
    todayTripsData = generated
  }

  const todayTrips = (todayTripsData ?? []).map((t: any) => ({
    ...t,
    stops: (t.stops ?? []).sort((a: any, b: any) => a.stopOrder - b.stopOrder),
  }))

  const { data: complianceDocs } = await supabase
    .from('ComplianceDocument').select('status').eq('driverId', driver.id)

  // Pending requests: contracts waiting for driver signature
  const { data: pendingContracts } = await supabase
    .from('Contract')
    .select('*, child:Child(*), parent:Parent(user:User(*))')
    .eq('driverId', driver.id)
    .eq('status', 'PENDING_DRIVER_SIGNATURE')
    .order('createdAt', { ascending: false })

  // Active children with fully-signed contracts — or any child assigned to this driver
  const { data: childrenRaw } = await supabase
    .from('Child')
    .select('*, parent:Parent(user:User(*))')
    .eq('driverId', driver.id)
    .eq('isActive', true)
    .order('createdAt', { ascending: false })

  // Batch fetch contracts for all children at once
  const activeChildIds = (childrenRaw ?? []).map((c: any) => c.id)
  const { data: allContracts } = activeChildIds.length > 0
    ? await supabase
        .from('Contract')
        .select('*')
        .in('childId', activeChildIds)
        .order('createdAt', { ascending: false })
    : { data: [] }

  const latestContractByChildId = new Map<string, any>()
  for (const c of allContracts ?? []) {
    if (!latestContractByChildId.has(c.childId)) {
      latestContractByChildId.set(c.childId, c)
    }
  }

  // "Active children" = those with a FULLY_SIGNED contract. Children whose
  // contract is still awaiting a signature appear ONLY in "Pending requests"
  // above, so they don't show in both lists at once.
  const children = (childrenRaw ?? [])
    .map((child: any) => ({
      ...child,
      contracts: latestContractByChildId.has(child.id) ? [latestContractByChildId.get(child.id)] : [],
    }))
    .filter((child: any) => child.contracts[0]?.status === 'FULLY_SIGNED')

  const totalDocs = 6
  const approvedDocs = (complianceDocs ?? []).filter((d: any) => d.status === 'APPROVED').length
  const isFullyCompliant = approvedDocs === totalDocs && driver.status === 'ACTIVE'

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar showLogo />
      <div className="px-4 pt-4 pb-8 space-y-4">

        {/* Compliance status */}
        <Link href="/driver-app/compliance">
          <div className={`rounded-2xl p-4 flex items-start gap-3 ${
            isFullyCompliant ? 'bg-[#0F6E56] text-white' : 'bg-[#F59E0B]/10 border border-[#F59E0B]/30'
          }`}>
            {isFullyCompliant
              ? <CheckCircle2 className="w-6 h-6 mt-0.5 shrink-0" />
              : <AlertTriangle className="w-6 h-6 mt-0.5 text-[#F59E0B] shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${isFullyCompliant ? 'text-white' : 'text-[#0F1923]'}`}>
                {isFullyCompliant ? "You're fully compliant ✓" : `${totalDocs - approvedDocs} document${totalDocs - approvedDocs !== 1 ? 's' : ''} need attention`}
              </p>
              <p className={`text-xs mt-0.5 ${isFullyCompliant ? 'text-white/80' : 'text-[#5A6474]'}`}>
                {approvedDocs} of {totalDocs} approved · Tap to view
              </p>
            </div>
            <ChevronRight className={`w-4 h-4 mt-1 shrink-0 ${isFullyCompliant ? 'text-white/70' : 'text-[#5A6474]'}`} />
          </div>
        </Link>

        {/* Today's trips */}
        {todayTrips.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Navigation className="w-4 h-4 text-[#ec3d3a]" />
              <h3 className="text-sm font-semibold text-[#0F1923]">Today&apos;s trips</h3>
            </div>
            <div className="space-y-2">
              {todayTrips.map((trip: any) => {
                const completed = trip.stops.filter((s: any) => s.status === 'COMPLETED').length
                return (
                  <Link key={trip.id} href={`/driver-app/trips/${trip.id}`}>
                    <Card className="rounded-xl border-[rgba(236,61,58,0.10)] shadow-none hover:shadow-sm transition-shadow">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          trip.type === 'MORNING' ? 'bg-[#fdc73e]/10' : 'bg-[#ec3d3a]/10'
                        }`}>
                          {trip.type === 'MORNING'
                            ? <Sun className="w-4 h-4 text-[#fdc73e]" />
                            : <Moon className="w-4 h-4 text-[#ec3d3a]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#0F1923]">
                            {trip.type === 'MORNING' ? 'Morning' : 'Afternoon'} school run
                          </p>
                          <p className="text-xs text-[#5A6474]">{completed} of {trip.stops.length} stops</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          trip.status === 'COMPLETED' ? 'bg-[#0F6E56]/10 text-[#0F6E56]' :
                          trip.status === 'IN_PROGRESS' ? 'bg-[#ec3d3a]/10 text-[#ec3d3a]' :
                          'bg-[#F8F9FB] text-[#5A6474]'
                        }`}>
                          {trip.status === 'COMPLETED' ? 'Done' :
                           trip.status === 'IN_PROGRESS' ? 'Live' : 'Upcoming'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#5A6474] shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Pending transport requests */}
        {(pendingContracts ?? []).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 pt-1">
              <Bell className="w-4 h-4 text-[#F59E0B]" />
              <h2 className="text-base font-bold text-[#0F1923]">Pending requests</h2>
              <span className="ml-auto text-xs font-semibold bg-[#F59E0B] text-white rounded-full px-2 py-0.5">
                {(pendingContracts ?? []).length}
              </span>
            </div>
            <div className="space-y-3">
              {(pendingContracts ?? []).map((contract: any) => (
                <Link key={contract.id} href={`/driver-app/contracts/${contract.id}`}>
                  <Card className="rounded-2xl border border-[#F59E0B]/30 bg-[#F59E0B]/05 shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0F1923] text-sm truncate">{contract.child.name}</p>
                          <p className="text-xs text-[#5A6474] mt-0.5">{contract.child.schoolName}</p>
                          <p className="text-xs text-[#5A6474] mt-0.5">
                            From {contract.parent.user.name}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {contract.monthlyAmountCents > 0 && (
                            <span className="text-sm font-bold text-[#ec3d3a]">{formatZAR(contract.monthlyAmountCents)}/mo</span>
                          )}
                          <span className="text-xs font-semibold text-[#F59E0B]">Tap to accept →</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Active children */}
        <div className="flex items-center justify-between pt-1">
          <h2 className="text-base font-bold text-[#0F1923]">Active children</h2>
        </div>

        {children.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-6 text-center">
            <p className="text-sm font-medium text-[#0F1923]">No active children yet</p>
            <p className="text-xs text-[#5A6474] mt-1">
              A parent needs to assign you as their driver first.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map((child: any) => {
              const contract = child.contracts[0]
              return (
                <Link key={child.id} href={`/driver-app/children/${child.id}`}>
                  <Card className="rounded-2xl border border-[rgba(236,61,58,0.10)] shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#0F1923] text-sm truncate">{child.name}</p>
                          <p className="text-xs text-[#5A6474] mt-0.5">{child.schoolName}</p>
                          <p className="text-xs text-[#5A6474] mt-0.5">
                            {child.parent.user.name} · {child.parent.user.phone}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {child.monthlyFee && (
                            <span className="text-sm font-bold text-[#ec3d3a]">{formatZAR(child.monthlyFee)}/mo</span>
                          )}
                          {contract && <StatusBadge status={contract.status} />}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
