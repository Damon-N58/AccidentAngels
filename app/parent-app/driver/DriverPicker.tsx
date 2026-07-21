'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { User, Car, CheckCircle2, ChevronDown, ChevronUp, Star } from 'lucide-react'
import { StarRating } from '@/components/ratings/StarRating'

type Driver = {
  id: string
  user: { name: string }
  vehicleMake: string | null
  vehicleModel: string | null
  vehicleColour: string | null
  vehicleCapacity: number | null
  approvedDocsCount: number
  association: { name: string; region: string } | null
  profilePhotoUrl: string | null
  // Recommendation-endpoint additions
  ratingAvg: number | null
  ratingCount: number
  distanceKm: number | null
}

export function ParentDriverPicker({
  childId,
  childName,
}: {
  childId: string
  childName: string
}) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open && drivers.length === 0) {
      loadDrivers()
    }
  }, [open])

  async function loadDrivers() {
    setLoading(true)
    try {
      // Use recommendation endpoint so results are ranked by distance/rating
      const res = await fetch('/api/drivers/recommend?childId=' + childId)
      const data = await res.json()
      setDrivers(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Could not load drivers')
    } finally {
      setLoading(false)
    }
  }

  async function assignDriver(driverId: string) {
    setAssigning(driverId)
    try {
      const res = await fetch(`/api/children/${childId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      })
      if (!res.ok) {
        const data = await res.json()
        // P1-C: surface outstanding-balance error with specific message
        if (res.status === 402 && data.code === 'BALANCE_OUTSTANDING') {
          toast.error(data.error)
          return
        }
        throw new Error(data.error ?? 'Failed to assign driver')
      }
      toast.success('Driver assigned!')
      setOpen(false)
      // Small delay to let user see the toast before page re-renders
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setAssigning(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div>
          <p className="font-semibold text-sm text-[#0F1923]">{childName}</p>
          <p className="text-xs text-[#F59E0B] mt-0.5">No driver assigned — tap to choose one</p>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-[#5A6474] shrink-0" />
          : <ChevronDown className="w-4 h-4 text-[#5A6474] shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[rgba(236,61,58,0.06)] pt-3 space-y-2">
          {loading ? (
            <div className="text-center py-6 text-sm text-[#5A6474]">Loading drivers…</div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-6 text-sm text-[#5A6474]">No active drivers available</div>
          ) : (
            drivers.map((d, idx) => {
              const vehicle = [d.vehicleColour, d.vehicleMake, d.vehicleModel].filter(Boolean).join(' ')
              // Show "Recommended" badge on first card when it has ≥4 avg rating from ≥3 parents
              const showRecommended = idx === 0 && d.ratingAvg != null && d.ratingAvg >= 4 && d.ratingCount >= 3
              return (
                <button
                  key={d.id}
                  onClick={() => assignDriver(d.id)}
                  disabled={assigning !== null}
                  className="w-full text-left rounded-xl border border-[rgba(236,61,58,0.12)] p-3 hover:border-[#ec3d3a]/30 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#ec3d3a]/10 flex items-center justify-center shrink-0">
                      {d.profilePhotoUrl
                        ? <img src={d.profilePhotoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                        : <User className="w-4 h-4 text-[#ec3d3a]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm text-[#0F1923] truncate">{d.user.name}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Amber "Recommended" badge on top-ranked qualifying driver */}
                          {showRecommended && (
                            <span className="inline-flex items-center gap-0.5 bg-[#fdc73e]/15 text-[#B97A00] text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                              <Star className="w-2.5 h-2.5 fill-[#fdc73e] stroke-[#fdc73e]" />
                              Recommended
                            </span>
                          )}
                          {assigning === d.id && <span className="text-xs text-[#ec3d3a]">Assigning…</span>}
                        </div>
                      </div>
                      {vehicle && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Car className="w-3 h-3 text-[#5A6474]" />
                          <span className="text-xs text-[#5A6474]">{vehicle}</span>
                        </div>
                      )}
                      {/* Rating row with distance chip */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <div className="flex items-center gap-1">
                          <StarRating value={d.ratingAvg} readonly size="sm" />
                          <span className="text-xs text-[#5A6474]">({d.ratingCount})</span>
                        </div>
                        {d.distanceKm != null && (
                          <span className="text-[10px] bg-[#ec3d3a]/08 text-[#ec3d3a] px-1.5 py-0.5 rounded-full font-medium">
                            ~{d.distanceKm} km
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-[#0F6E56]" />
                        <span className="text-xs text-[#0F6E56]">{d.approvedDocsCount}/6 docs verified</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
