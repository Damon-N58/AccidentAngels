import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { ParentTopBar } from '@/components/parent/ParentTopBar'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CheckCircle2, AlertTriangle, ChevronRight, Clock, Plus, Sun, Moon, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

export default async function ParentDashboardPage() {
  const cookieStore = await cookies()
  const session = await getSession(cookieStore.toString())
  if (!session) redirect('/parent-app/login')

  const { data: parent, error: parentErr } = await supabase
    .from('Parent').select('*').eq('userId', session.userId).maybeSingle()

  if (parentErr) {
    console.error('[dashboard] Failed to fetch parent:', parentErr)
    return (
      <div className="min-h-screen bg-[#F8F9FB] px-4 pt-20 text-center">
        <p className="text-[#E24B4A] font-semibold mb-1">Something went wrong</p>
        <p className="text-sm text-[#5A6474]">Could not load your account. Try refreshing.</p>
      </div>
    )
  }

  if (!parent) redirect('/parent-app/onboarding')

  const { data: user, error: userErr } = await supabase
    .from('User').select('*').eq('id', session.userId).maybeSingle()

  if (userErr) {
    console.error('[dashboard] Failed to fetch user:', userErr)
    return (
      <div className="min-h-screen bg-[#F8F9FB] px-4 pt-20 text-center">
        <p className="text-[#E24B4A] font-semibold mb-1">Something went wrong</p>
        <p className="text-sm text-[#5A6474]">Could not load your profile. Try refreshing.</p>
      </div>
    )
  }

  if (!user) redirect('/parent-app/onboarding')

  const { data: childrenRaw } = await supabase
    .from('Child').select('*').eq('parentId', parent.id).eq('isActive', true)

  // Batch fetch drivers and contracts for all children at once
  const childDriverIds = [...new Set((childrenRaw ?? []).map((c: any) => c.driverId).filter(Boolean))]
  const { data: allDrivers } = childDriverIds.length > 0
    ? await supabase
        .from('Driver')
        .select('*, user:User(*), complianceDocs:ComplianceDocument(status)')
        .in('id', childDriverIds)
    : { data: [] }
  const driversById = new Map((allDrivers ?? []).map((d: any) => [d.id, d]))

  const childIds = (childrenRaw ?? []).map((c: any) => c.id)
  const { data: allContracts } = childIds.length > 0
    ? await supabase
        .from('Contract')
        .select('*')
        .in('childId', childIds)
        .order('createdAt', { ascending: false })
    : { data: [] }
  const contractsByChildId = new Map<string, any[]>()
  for (const c of allContracts ?? []) {
    if (!contractsByChildId.has(c.childId)) contractsByChildId.set(c.childId, [])
    contractsByChildId.get(c.childId)!.push(c)
  }

  const children = (childrenRaw ?? []).map((child: any) => ({
    ...child,
    driver: child.driverId ? driversById.get(child.driverId) ?? null : null,
    contracts: contractsByChildId.get(child.id) ?? [],
  }))

  const todayStr = new Date().toISOString().split('T')[0]
  const { data: todayTripsData } = childDriverIds.length > 0
    ? await supabase
        .from('Trip')
        .select('*, stops:TripStop(*, child:Child(name, schoolName))')
        .in('driverId', childDriverIds)
        .eq('date', todayStr)
        .order('createdAt', { ascending: true })
    : { data: [] }
  const todayTrips = (todayTripsData ?? []).map((t: any) => ({
    ...t,
    stops: (t.stops ?? []).sort((a: any, b: any) => a.stopOrder - b.stopOrder),
  }))

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const today = format(new Date(), 'EEEE, d MMMM')

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <ParentTopBar showLogo />
      <div className="px-4 pb-24 pt-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#0F1923]">{greeting}, {user.name.split(' ')[0]}</h2>
            <p className="text-sm text-[#5A6474]">{today}</p>
          </div>
          <Link href="/parent-app/children/add">
            <Button size="sm" className="h-8 bg-[#F5A623] hover:bg-[#F5A623]/90 text-[#0F1923] text-xs font-semibold gap-1">
              <Plus className="w-3.5 h-3.5" /> Add child
            </Button>
          </Link>
        </div>

        {/* Today's trips */}
        {todayTrips.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Navigation className="w-4 h-4 text-[#1A3F7A]" />
              <h3 className="text-sm font-semibold text-[#0F1923]">Today&apos;s trips</h3>
            </div>
            <div className="space-y-2">
              {todayTrips.map((trip: any) => {
                const completed = trip.stops.filter((s: any) => s.status === 'COMPLETED').length
                return (
                  <Link key={trip.id} href={`/parent-app/trips/${trip.id}`}>
                    <Card className="rounded-xl border-[rgba(26,63,122,0.10)] shadow-none hover:shadow-sm transition-shadow">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          trip.type === 'MORNING' ? 'bg-[#F5A623]/10' : 'bg-[#1A3F7A]/10'
                        }`}>
                          {trip.type === 'MORNING'
                            ? <Sun className="w-4 h-4 text-[#F5A623]" />
                            : <Moon className="w-4 h-4 text-[#1A3F7A]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#0F1923]">
                            {trip.type === 'MORNING' ? 'Morning' : 'Afternoon'} school run
                          </p>
                          <p className="text-xs text-[#5A6474]">{completed} of {trip.stops.length} stops</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#5A6474] shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {children.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-[rgba(26,63,122,0.10)]">
            <img src="/logos/wings-icon.svg" alt="" className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="text-base font-semibold text-[#0F1923]">No children added yet</p>
            <p className="text-sm text-[#5A6474] mt-2 mb-5 max-w-xs mx-auto">
              Add your child and choose a verified driver to get started.
            </p>
            <Link href="/parent-app/children/add">
              <Button className="bg-[#F5A623] hover:bg-[#F5A623]/90 text-[#0F1923] font-semibold h-11 px-6">
                Add your first child →
              </Button>
            </Link>
          </div>
        ) : (
          children.map((child: any) => {
            const driver = child.driver
            const contract = child.contracts[0]
            const approvedDocs = (driver?.complianceDocs ?? []).filter((d: any) => d.status === 'APPROVED').length
            const isVerified = approvedDocs === 6 && driver?.status === 'ACTIVE'
            const awaitingDriver = contract?.status === 'PENDING_DRIVER_SIGNATURE'

            return (
              <Card key={child.id} className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-base text-[#0F1923]">{child.name}</p>
                      <p className="text-xs text-[#5A6474]">{child.schoolName}</p>
                    </div>
                    {contract && <StatusBadge status={contract.status} />}
                  </div>

                  {awaitingDriver && (
                    <div className="flex items-center gap-2 bg-[#F59E0B]/10 rounded-xl p-3 mb-3">
                      <Clock className="w-4 h-4 text-[#F59E0B] shrink-0" />
                      <p className="text-xs text-[#0F1923] font-medium">Waiting for driver to accept</p>
                    </div>
                  )}

                  {driver ? (
                    <Link href={`/parent-app/driver/${driver.id}`} className="flex items-center justify-between bg-[#F8F9FB] rounded-xl p-3">
                      <div className="flex items-center gap-2">
                        {isVerified
                          ? <CheckCircle2 className="w-5 h-5 text-[#0F6E56]" />
                          : <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />}
                        <div>
                          <p className="text-sm font-semibold text-[#0F1923]">{driver.user.name}</p>
                          <p className={`text-xs font-medium ${isVerified ? 'text-[#0F6E56]' : 'text-[#F59E0B]'}`}>
                            {isVerified ? 'Driver verified ✓' : 'Compliance pending'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#5A6474]" />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2 bg-[#F8F9FB] rounded-xl p-3">
                      <Clock className="w-5 h-5 text-[#5A6474]" />
                      <p className="text-xs text-[#5A6474]">No driver assigned</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-[#5A6474] mt-3 pt-3 border-t border-[rgba(26,63,122,0.06)]">
                    <div className="flex gap-3">
                      <Link href={`/parent-app/schedule/${child.id}`} className="font-medium text-[#1A3F7A] hover:underline">
                        Schedule
                      </Link>
                      <Link href={`/parent-app/children/${child.id}`} className="font-medium text-[#1A3F7A] hover:underline">
                        Edit
                      </Link>
                    </div>
                    {driver && (
                      <span className="font-medium text-[#0F1923]">Next payment: —</span>
                    )}
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
