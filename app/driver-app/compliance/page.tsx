import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { DriverTopBar } from '@/components/driver/DriverTopBar'
import { DocumentUploadCard } from '@/components/driver/DocumentUploadCard'
import { Progress } from '@/components/ui/progress'

const DOC_TYPES = [
  'PDP', 'POLICE_CLEARANCE', 'PASSENGER_LIABILITY',
  'ROADWORTHY_CERTIFICATE', 'VEHICLE_PHOTOS', 'DRIVER_LICENSE',
] as const

export default async function DriverCompliancePage() {
  const cookieStore = await cookies()
  const session = await getSession(cookieStore.toString())
  if (!session) redirect('/driver-app/login')

  const { data: driver } = await supabase.from('Driver').select('id').eq('userId', session.userId).maybeSingle()
  if (!driver) redirect('/driver-app/onboarding')

  const { data: docs } = await supabase
    .from('ComplianceDocument')
    .select('*')
    .eq('driverId', driver.id)
    .order('createdAt', { ascending: false })

  const docMap = new Map<string, any>()
  for (const doc of docs ?? []) {
    if (!docMap.has(doc.type)) docMap.set(doc.type, doc)
  }

  const approved = [...docMap.values()].filter(d => d.status === 'APPROVED').length
  const pct = Math.round((approved / DOC_TYPES.length) * 100)

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar title="Compliance" />
      <div className="px-4 py-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 border border-[rgba(26,63,122,0.10)]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-[#0F1923]">Documents approved</span>
            <span className="text-sm font-bold text-[#1A3F7A]">{approved} / {DOC_TYPES.length}</span>
          </div>
          <Progress value={pct} className="h-2" />
          {approved === DOC_TYPES.length && (
            <p className="text-xs text-[#0F6E56] font-medium mt-2">✓ All documents approved — you&apos;re compliant</p>
          )}
        </div>

        <div className="space-y-2">
          {DOC_TYPES.map(type => {
            const doc = docMap.get(type)
            return (
              <DocumentUploadCard
                key={type}
                docType={type}
                status={doc?.status ?? null}
                expiryDate={doc?.expiryDate}
                documentNumber={doc?.documentNumber}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
