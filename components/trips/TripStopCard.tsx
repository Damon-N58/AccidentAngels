'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MapPin, Home, School, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react'
import type { TripStopData } from '@/lib/trips/types'

interface TripStopCardProps {
  stop: TripStopData
  isFirst: boolean
  isLast: boolean
  isDriverView?: boolean
  tripStatus?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  onComplete?: (stopId: string, lat?: number, lng?: number) => void
  onMissed?: (stopId: string, reason: string) => void
}

const STATUS_ICON = {
  PENDING: Clock,
  COMPLETED: CheckCircle2,
  MISSED: XCircle,
}

const STATUS_COLOR = {
  PENDING: 'text-[#5A6474] border-[#5A6474]/30',
  COMPLETED: 'text-[#0F6E56] border-[#0F6E56]',
  MISSED: 'text-[#E24B4A] border-[#E24B4A]',
}

const STATUS_BG = {
  PENDING: 'bg-[#5A6474]',
  COMPLETED: 'bg-[#0F6E56]',
  MISSED: 'bg-[#E24B4A]',
}

export function TripStopCard({
  stop,
  isFirst,
  isLast,
  isDriverView,
  tripStatus,
  onComplete,
  onMissed,
}: TripStopCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [missedReason, setMissedReason] = useState('')
  const Icon = STATUS_ICON[stop.status]
  const isInteractive = isDriverView && tripStatus === 'IN_PROGRESS' && stop.status === 'PENDING'

  const formatTime = (t: string | null) => {
    if (!t) return '—'
    return new Date(t).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="relative flex gap-3">
      {/* Connector line */}
      <div className="flex flex-col items-center">
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0',
          STATUS_COLOR[stop.status],
        )}>
          <Icon className="w-5 h-5" />
        </div>
        {!isLast && (
          <div className={cn(
            'w-0.5 flex-1 min-h-[2rem]',
            stop.status === 'COMPLETED' ? STATUS_BG.COMPLETED : 'bg-[#D0D3D8]',
          )} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-[#0F1923] truncate">
              {stop.child?.name ?? 'Child'}
            </p>
            <div className="flex items-center gap-1 text-xs text-[#5A6474] mt-0.5">
              {stop.type === 'PICKUP' ? <Home className="w-3 h-3" /> : <School className="w-3 h-3" />}
              <span>{stop.type === 'PICKUP' ? 'Pickup' : 'Dropoff'}</span>
              {stop.child?.schoolName && (
                <>
                  <span>·</span>
                  <span className="truncate">{stop.child.schoolName}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-medium text-[#1A3F7A]">{formatTime(stop.estimatedTime)}</p>
            {stop.actualTime && (
              <p className="text-xs text-[#0F6E56]">Actual: {formatTime(stop.actualTime)}</p>
            )}
          </div>
        </div>

        <p className="text-xs text-[#5A6474] mt-1 truncate">{stop.address}</p>

        {stop.notes && (
          <div className="flex items-center gap-1 mt-1 text-xs text-[#F5A623]">
            <AlertCircle className="w-3 h-3" />
            <span>{stop.notes}</span>
          </div>
        )}

        {stop.missedReason && (
          <div className="flex items-center gap-1 mt-1 text-xs text-[#E24B4A]">
            <span>Missed: {stop.missedReason}</span>
          </div>
        )}

        {/* Driver actions */}
        {isInteractive && (
          <div className="mt-2 space-y-2">
            {expanded ? (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Reason if missed (optional)"
                  value={missedReason}
                  onChange={e => setMissedReason(e.target.value)}
                  className="w-full text-xs border border-[rgba(26,63,122,0.15)] rounded-lg px-2 py-1.5 outline-none focus:border-[#1A3F7A]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onComplete?.(stop.id)
                      setExpanded(false)
                    }}
                    className="flex-1 text-xs font-semibold bg-[#0F6E56] text-white rounded-lg py-1.5 hover:bg-[#0F6E56]/90"
                  >
                    Mark completed
                  </button>
                  <button
                    onClick={() => {
                      if (missedReason.trim()) {
                        onMissed?.(stop.id, missedReason.trim())
                        setExpanded(false)
                        setMissedReason('')
                      }
                    }}
                    disabled={!missedReason.trim()}
                    className="flex-1 text-xs font-semibold border border-[#E24B4A] text-[#E24B4A] rounded-lg py-1.5 hover:bg-[#E24B4A]/05 disabled:opacity-40"
                  >
                    Mark missed
                  </button>
                  <button
                    onClick={() => setExpanded(false)}
                    className="text-xs text-[#5A6474] underline px-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setExpanded(true)}
                className="text-xs font-medium text-[#1A3F7A] hover:underline"
              >
                Mark stop →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
