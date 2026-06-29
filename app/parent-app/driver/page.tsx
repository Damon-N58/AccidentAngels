import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { ParentTopBar } from '@/components/parent/ParentTopBar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronRight, User, Car, CheckCircle2, AlertTriangle, Clock, Plus } from 'lucide-react'
import { ParentDriverPicker } from './DriverPicker'

export default async function ParentDriverPage() {
  const cookieStore = await cookies()
  const session = await getSession(cookieStore.toString())
  if (!session) redirect('/parent-app/login')

  const { data: parent } = await supabase.from('Parent').select('id').eq('userId', session.userId).maybeSingle()
  if (!parent) redirect('/parent-app/onboarding')

  const { data: children } = await supabase
    .from('Child')
    .select('driverId, name, schoolName, id, pickupLat, dropoffLat')
    .eq('parentId', parent.id)
    .eq('isActive', true)

  const driverIds = [...new Set((children ?? []).map(c => c.driverId).filter(Boolean))] as string[]
  const childrenWithoutDriver = (children ?? []).filter(c => !c.driverId)

  const { data: drivers } = driverIds.length > 0
    ? await supabase
        .from('Driver')
        .select('*, user:User(name, phone), complianceDocs:ComplianceDocument(status)')
        .in('id', driverIds)
    : { data: [] }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <ParentTopBar title="My Driver" />
      <div className="px-4 pt-4 pb-24 space-y-4">
        {drivers && drivers.length > 0 ? (
          drivers.map((d: any) => {
            const approvedDocs = (d.complianceDocs ?? []).filter((doc: any) => doc.status === 'APPROVED').length
            const isVerified = approvedDocs === 6 && d.status === 'ACTIVE'
            return (
              <Link key={d.id} href={`/parent-app/driver/${d.id}`}>
                <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#ec3d3a]/10 flex items-center justify-center shrink-0">
                        <User className="w-6 h-6 text-[#ec3d3a]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#0F1923]">{d.user.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {isVerified
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-[#0F6E56]" />
                            : <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />}
                          <span className={`text-xs font-medium ${isVerified ? 'text-[#0F6E56]' : 'text-[#F59E0B]'}`}>
                            {isVerified ? 'Verified driver' : 'Compliance pending'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#5A6474]" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })
        ) : null}

        {childrenWithoutDriver.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[#0F1923] mb-3">Choose a driver for:</h3>
            {childrenWithoutDriver.map((child: any) => (
              <ParentDriverPicker
                key={child.id}
                childId={child.id}
                childName={child.name}
              />
            ))}
          </div>
        )}

        {(!drivers || drivers.length === 0) && childrenWithoutDriver.length === 0 && (
          <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-6 text-center">
            <User className="w-10 h-10 text-[#5A6474] mx-auto mb-3" />
            <p className="text-sm font-semibold text-[#0F1923]">No driver assigned</p>
            <p className="text-xs text-[#5A6474] mt-1 mb-4">
              Add a child and choose a driver to get started.
            </p>
            <Link href="/parent-app/children/add">
              <Button className="bg-[#fdc73e] hover:bg-[#fdc73e]/90 text-[#0F1923] font-semibold h-11 px-6">
                Add a child
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
