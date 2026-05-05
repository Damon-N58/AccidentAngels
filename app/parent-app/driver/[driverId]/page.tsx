import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { ParentTopBar } from '@/components/parent/ParentTopBar'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, XCircle, AlertTriangle, Shield, Car, User } from 'lucide-react'
import { format } from 'date-fns'

const DOC_LABELS: Record<string, string> = {
  PDP:                    'Professional Driving Permit',
  POLICE_CLEARANCE:       'Police Clearance',
  PASSENGER_LIABILITY:    'Passenger Insurance',
  ROADWORTHY_CERTIFICATE: 'Roadworthy',
  VEHICLE_PHOTOS:         'Vehicle Photos',
  DRIVER_LICENSE:         "Driver's License",
}

export default async function DriverTrustPage({ params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = await params
  const cookieStore = await cookies()
  const session = await getSession(cookieStore.toString())
  if (!session) redirect('/parent-app/login')

  const { data: driver } = await supabase
    .from('Driver')
    .select('*, user:User(*), association:Association(*)')
    .eq('id', driverId)
    .maybeSingle()
  if (!driver) notFound()

  const { data: complianceDocs } = await supabase
    .from('ComplianceDocument').select('*').eq('driverId', driverId).order('createdAt', { ascending: false })

  const docMap = new Map<string, any>()
  for (const doc of complianceDocs ?? []) {
    if (!docMap.has(doc.type)) docMap.set(doc.type, doc)
  }

  const allApproved = Object.keys(DOC_LABELS).every(t => docMap.get(t)?.status === 'APPROVED')
  const latestApproval = driver.verifiedAt ? format(new Date(driver.verifiedAt), 'd MMMM yyyy') : null

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <ParentTopBar title="Your Driver" />
      <div className="px-4 py-5 space-y-4">
        <div className="flex flex-col items-center py-4">
          <div className="w-20 h-20 rounded-full bg-[#1A3F7A]/10 flex items-center justify-center mb-3">
            {driver.profilePhotoUrl ? (
              <img src={driver.profilePhotoUrl} alt={driver.user.name} className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <User className="w-9 h-9 text-[#1A3F7A]" />
            )}
          </div>
          <h2 className="text-xl font-bold text-[#0F1923]">{driver.user.name}</h2>
          {driver.getsRegistrationNumber && (
            <span className="mt-1 text-xs bg-[#1A3F7A]/10 text-[#1A3F7A] px-2.5 py-0.5 rounded-full font-medium">
              GETS: {driver.getsRegistrationNumber}
            </span>
          )}
          {driver.association && <p className="text-xs text-[#5A6474] mt-1">{driver.association.name}</p>}
        </div>

        {allApproved && (
          <div className="bg-[#0F6E56] rounded-2xl p-4 flex items-center gap-3">
            <Shield className="w-6 h-6 text-white shrink-0" />
            <div>
              <p className="font-bold text-white text-sm">Your driver is fully verified by GETS</p>
              {latestApproval && <p className="text-white/70 text-xs mt-0.5">Last verified: {latestApproval}</p>}
            </div>
          </div>
        )}

        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Car className="w-4 h-4 text-[#1A3F7A]" />
              <span className="font-semibold text-sm text-[#0F1923]">Vehicle</span>
            </div>
            <div className="space-y-1.5">
              {[
                ['Make / Model', [driver.vehicleMake, driver.vehicleModel].filter(Boolean).join(' ') || '—'],
                ['Colour', driver.vehicleColour || '—'],
                ['Registration', driver.vehicleRegistration || '—'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-[#5A6474]">{label}</span>
                  <span className="font-medium text-[#0F1923]">{val}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardContent className="p-4">
            <p className="font-semibold text-sm text-[#0F1923] mb-3">Compliance verification</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(DOC_LABELS).map(([type, label]) => {
                const doc = docMap.get(type)
                const approved = doc?.status === 'APPROVED'
                const expiring = doc?.expiryDate
                  ? new Date(doc.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  : false
                return (
                  <div key={type} className={`rounded-xl p-3 flex items-start gap-2 ${
                    approved && !expiring ? 'bg-[#0F6E56]/08 border border-[#0F6E56]/20' :
                    approved && expiring  ? 'bg-[#F59E0B]/08 border border-[#F59E0B]/20' :
                    'bg-[#E24B4A]/06 border border-[#E24B4A]/15'
                  }`}>
                    {approved && !expiring ? <CheckCircle2 className="w-4 h-4 text-[#0F6E56] shrink-0 mt-0.5" /> :
                     approved && expiring  ? <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" /> :
                     <XCircle className="w-4 h-4 text-[#E24B4A] shrink-0 mt-0.5" />}
                    <p className="text-xs font-medium text-[#0F1923] leading-tight">{label}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
