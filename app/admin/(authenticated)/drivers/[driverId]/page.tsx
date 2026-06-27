'use client'

import { useState, useEffect, use } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  CheckCircle2, XCircle, Clock, FileText,
  ExternalLink, ChevronLeft, User, Car, Building2
} from 'lucide-react'

const DOC_LABELS: Record<string, string> = {
  PDP:                    'Professional Driving Permit',
  POLICE_CLEARANCE:       'Police Clearance Certificate',
  PASSENGER_LIABILITY:    'Passenger Liability Insurance',
  ROADWORTHY_CERTIFICATE: 'Roadworthy Certificate',
  VEHICLE_PHOTOS:         'Vehicle Photos',
  DRIVER_LICENSE:         "Driver's Licence",
}

const STATUS_ICON = {
  APPROVED:     <CheckCircle2 className="w-4 h-4 text-[#0F6E56]" />,
  REJECTED:     <XCircle className="w-4 h-4 text-[#E24B4A]" />,
  UNDER_REVIEW: <Clock className="w-4 h-4 text-[#F59E0B]" />,
  PENDING:      <Clock className="w-4 h-4 text-[#5A6474]" />,
  EXPIRED:      <XCircle className="w-4 h-4 text-[#E24B4A]" />,
}

const STATUS_BADGE: Record<string, string> = {
  APPROVED:     'status-approved',
  REJECTED:     'status-rejected',
  UNDER_REVIEW: 'status-review',
  PENDING:      'status-pending',
  EXPIRED:      'status-expired',
}

interface Doc {
  id: string
  type: string
  status: string
  fileUrl: string
  fileName: string
  documentNumber: string | null
  issueDate: string | null
  expiryDate: string | null
  reviewNotes: string | null
}

interface Driver {
  id: string
  status: string
  vehicleRegistration: string | null
  vehicleMake: string | null
  vehicleModel: string | null
  vehicleYear: number | null
  vehicleColour: string | null
  vehicleCapacity: number | null
  getsRegistrationNumber: string | null
  user: { name: string; phone: string; email: string | null }
  association: { name: string; region: string } | null
  complianceDocs: Doc[]
}

export default function DriverDetailPage({ params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = use(params)
  const [driver, setDriver] = useState<Driver | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/admin/drivers/${driverId}`)
      .then(r => r.json())
      .then(data => {
        // Guard: only accept well-formed driver objects
        if (data?.id && Array.isArray(data?.complianceDocs)) setDriver(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [driverId])

  async function handleReview(docId: string, action: 'APPROVED' | 'REJECTED') {
    setReviewing(docId)
    try {
      const res = await fetch(`/api/admin/compliance/${docId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: notes[docId] ?? '' }),
      })
      if (!res.ok) throw new Error('Review failed')
      toast.success(`Document ${action.toLowerCase()}`)
      // Refresh driver data
      const updated = await fetch(`/api/admin/drivers/${driverId}`).then(r => r.json())
      setDriver(updated)
    } catch {
      toast.error('Failed to submit review')
    } finally {
      setReviewing(null)
    }
  }

  if (loading) return (
    <div className="p-6 text-sm text-[#5A6474]">Loading…</div>
  )

  if (!driver) return (
    <div className="p-6 text-sm text-[#E24B4A]">Driver not found.</div>
  )

  const ALL_TYPES = Object.keys(DOC_LABELS)
  const docsMap = Object.fromEntries(driver.complianceDocs.map(d => [d.type, d]))

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <a href="/admin/drivers" className="inline-flex items-center gap-1.5 text-sm text-[#1A3F7A] font-medium hover:underline">
        <ChevronLeft className="w-4 h-4" /> All drivers
      </a>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1923]">{driver.user.name || 'Unnamed driver'}</h1>
          <p className="text-sm text-[#5A6474]">{driver.user.phone}</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
          driver.status === 'ACTIVE'     ? 'bg-[#0F6E56]/10 text-[#0F6E56]' :
          driver.status === 'SUSPENDED'  ? 'bg-[#E24B4A]/10 text-[#E24B4A]' :
                                           'bg-[#F59E0B]/10 text-[#F59E0B]'
        }`}>
          {driver.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-[#5A6474] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {[
              ['GETS #', driver.getsRegistrationNumber ?? '—'],
              ['Email', driver.user.email ?? '—'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between gap-2">
                <span className="text-[#5A6474] shrink-0">{l}</span>
                <span className="font-medium text-right truncate">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-[#5A6474] flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5" /> Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {[
              ['Reg', driver.vehicleRegistration ?? '—'],
              ['Make/Model', driver.vehicleMake && driver.vehicleModel ? `${driver.vehicleMake} ${driver.vehicleModel}` : '—'],
              ['Capacity', driver.vehicleCapacity ? `${driver.vehicleCapacity} passengers` : '—'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between gap-2">
                <span className="text-[#5A6474] shrink-0">{l}</span>
                <span className="font-medium text-right truncate">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-[#5A6474] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Association
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="font-medium">{driver.association?.name ?? 'No association'}</p>
            {driver.association?.region && (
              <p className="text-[#5A6474]">{driver.association.region}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compliance documents */}
      <div>
        <h2 className="text-base font-bold text-[#0F1923] mb-4">Compliance Documents</h2>
        <div className="space-y-4">
          {ALL_TYPES.map(type => {
            const doc = docsMap[type]
            return (
              <Card key={type} className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Status icon */}
                    <div className="mt-0.5">
                      {doc ? (STATUS_ICON[doc.status as keyof typeof STATUS_ICON] ?? STATUS_ICON.PENDING) : (
                        <div className="w-4 h-4 rounded-full border-2 border-[rgba(26,63,122,0.20)]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-[#0F1923]">{DOC_LABELS[type]}</span>
                        {doc && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[doc.status] ?? ''}`}>
                            {doc.status.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>

                      {!doc && (
                        <p className="text-sm text-[#5A6474]">Not uploaded yet</p>
                      )}

                      {doc && (
                        <>
                          <div className="flex flex-wrap gap-4 text-xs text-[#5A6474] mb-3">
                            {doc.documentNumber && <span>Doc #{doc.documentNumber}</span>}
                            {doc.issueDate && <span>Issued: {new Date(doc.issueDate).toLocaleDateString('en-ZA')}</span>}
                            {doc.expiryDate && <span>Expires: {new Date(doc.expiryDate).toLocaleDateString('en-ZA')}</span>}
                          </div>

                          <div className="flex items-center gap-2 mb-3">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1A3F7A] hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              View document
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>

                          {doc.reviewNotes && (
                            <p className="text-xs text-[#5A6474] bg-[#F8F9FB] rounded-lg p-2 mb-3">
                              Notes: {doc.reviewNotes}
                            </p>
                          )}

                          {doc.status === 'UNDER_REVIEW' && (
                            <div className="space-y-2">
                              <Textarea
                                placeholder="Review notes (optional — required for rejection)"
                                value={notes[doc.id] ?? ''}
                                onChange={e => setNotes(prev => ({ ...prev, [doc.id]: e.target.value }))}
                                className="text-sm h-20 resize-none"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={reviewing === doc.id}
                                  onClick={() => handleReview(doc.id, 'APPROVED')}
                                  className="bg-[#0F6E56] hover:bg-[#0F6E56]/90 text-white h-9"
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={reviewing === doc.id || !notes[doc.id]}
                                  onClick={() => handleReview(doc.id, 'REJECTED')}
                                  className="border-[#E24B4A] text-[#E24B4A] hover:bg-[#E24B4A]/05 h-9"
                                >
                                  <XCircle className="w-4 h-4 mr-1.5" />
                                  Reject
                                </Button>
                              </div>
                              <p className="text-xs text-[#5A6474]">Rejection requires a note.</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
