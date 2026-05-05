'use client'

import Link from 'next/link'
import { ChevronRight, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ComplianceBadge } from './ComplianceBadge'
import { formatDate, daysUntilExpiry, expiryColor } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'

const DOC_LABELS: Record<string, string> = {
  PDP:                    'Professional Driving Permit (PDP)',
  POLICE_CLEARANCE:       'Police Clearance Certificate',
  PASSENGER_LIABILITY:    'Passenger Liability Insurance',
  ROADWORTHY_CERTIFICATE: 'Roadworthy Certificate',
  VEHICLE_PHOTOS:         'Vehicle Photos',
  DRIVER_LICENSE:         "Driver's License",
}

const DOC_DESC: Record<string, string> = {
  PDP:                    'Valid PDP for passenger transport',
  POLICE_CLEARANCE:       'Not older than 6 months',
  PASSENGER_LIABILITY:    'Must cover all passengers',
  ROADWORTHY_CERTIFICATE: 'Current roadworthy certificate',
  VEHICLE_PHOTOS:         'Clear photos of all 4 sides',
  DRIVER_LICENSE:         "Valid SA driver's license",
}

interface DocumentUploadCardProps {
  docType: string
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXPIRING' | null
  expiryDate?: Date | null
  documentNumber?: string | null
}

export function DocumentUploadCard({ docType, status, expiryDate, documentNumber }: DocumentUploadCardProps) {
  const effectiveStatus = status ?? 'PENDING'
  const days = expiryDate ? daysUntilExpiry(expiryDate) : null
  const expiryCol = expiryDate ? expiryColor(expiryDate) : null

  return (
    <Link href={`/compliance/${docType}`}>
      <Card className="rounded-2xl border border-[rgba(26,63,122,0.10)] shadow-none active:scale-[0.98] transition-transform">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[#0F1923]">{DOC_LABELS[docType] ?? docType}</p>
              <p className="text-xs text-[#5A6474] mt-0.5">{DOC_DESC[docType]}</p>
              {documentNumber && (
                <p className="text-xs text-[#5A6474] mt-1 font-mono">{documentNumber}</p>
              )}
              {expiryDate && (
                <div className="flex items-center gap-1 mt-1.5">
                  <Calendar className="w-3 h-3 text-[#5A6474]" />
                  <span className={cn(
                    'text-xs font-medium',
                    expiryCol === 'green' ? 'text-[#0F6E56]' :
                    expiryCol === 'amber' ? 'text-[#F59E0B]' : 'text-[#E24B4A]'
                  )}>
                    Expires {formatDate(expiryDate)}
                    {days !== null && days <= 30 && ` · ${days}d`}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ComplianceBadge status={effectiveStatus} size="sm" />
              <ChevronRight className="w-4 h-4 text-[#5A6474]" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
