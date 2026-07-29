'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { DriverTopBar } from '@/components/driver/DriverTopBar'
import { TripStopCard } from '@/components/trips/TripStopCard'
import { TripProgressBar } from '@/components/trips/TripProgressBar'
import { TripMap } from '@/components/trips/TripMap'
import { ActiveTripNavigation } from '@/components/trips/ActiveTripNavigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Navigation, Play } from 'lucide-react'
import { toast } from 'sonner'
import type { TripData } from '@/lib/trips/types'

export default function DriverTripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = use(params)
  const router = useRouter()
  const [trip, setTrip] = useState<TripData | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  const fetchTrip = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/trips/${tripId}`)
      if (!res.ok) {
        if (res.status === 404) { setTrip(null); return }
        throw new Error('Failed to load')
      }
      const data = await res.json()
      data.stops.sort((a: { stopOrder: number }, b: { stopOrder: number }) => a.stopOrder - b.stopOrder)
      setTrip(data)
    } catch {
      toast.error('Failed to load trip')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTrip() }, [tripId])

  const handleStart = async () => {
    setStarting(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/start`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Failed to start trip')
        return
      }
      toast.success('Trip started — good luck!')
      await fetchTrip()
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setStarting(false)
    }
  }

  const handleComplete = async (stopId: string, lat?: number, lng?: number) => {
    const res = await fetch(`/api/trips/${tripId}/stops`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stopId, status: 'COMPLETED', lat, lng }),
    })
    if (!res.ok) throw new Error('Failed')
    await fetchTrip()
  }

  const handleArrived = async (stopId: string) => {
    const res = await fetch(`/api/trips/${tripId}/stops/arrive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stopId }),
    })
    if (!res.ok) { toast.error('Could not record arrival'); return }
    await fetchTrip() // refetch so arrivedAt populates and timer starts
  }

  const handleMissed = async (stopId: string, reason: string) => {
    const res = await fetch(`/api/trips/${tripId}/stops`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stopId, status: 'MISSED', missedReason: reason }),
    })
    if (!res.ok) throw new Error('Failed')
    await fetchTrip()
  }

  // ── Active navigation (full-screen Uber-style) ────────────
  if (trip?.status === 'IN_PROGRESS') {
    return (
      <ActiveTripNavigation
        trip={trip}
        onBack={() => router.push('/driver-app/trips')}
        onStopComplete={handleComplete}
        onStopMissed={handleMissed}
        onStopArrived={handleArrived}
        onTripRefresh={fetchTrip}
      />
    )
  }

  // ── Pre-trip / completed summary view ─────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB]">
        <DriverTopBar title="Trip" />
        <div className="px-4 pt-4 pb-24">
          <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-5 animate-pulse">
            <div className="h-4 bg-[#E8EAED] rounded w-1/3 mb-3" />
            <div className="h-3 bg-[#E8EAED] rounded w-1/2 mb-6" />
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-[#E8EAED] rounded mb-3" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-[#F8F9FB]">
        <DriverTopBar title="Trip" />
        <div className="px-4 pt-4 text-center text-sm text-[#5A6474]">Trip not found.</div>
      </div>
    )
  }

  const completedStops = trip.stops.filter(s => s.status === 'COMPLETED').length
  const tripLabel = trip.type === 'MORNING' ? 'Morning school run' : 'Afternoon school run'
  const isCompleted = trip.status === 'COMPLETED'

  // Payment summary — only relevant in driver view (stops without paymentStatus are ignored)
  const paidCount = trip.stops.filter(s => s.paymentStatus === 'PAID').length
  const overdueCount = trip.stops.filter(s => s.paymentStatus === 'OVERDUE').length
  const hasPaymentInfo = trip.stops.some(s => s.paymentStatus)

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar title={tripLabel} />
      <div className="px-4 pt-4 pb-24 space-y-4">

        <button onClick={() => router.push('/driver-app/trips')} className="flex items-center gap-1 text-sm text-[#ec3d3a] font-medium hover:underline">
          <ChevronLeft className="w-4 h-4" /> All trips
        </button>

        {/* Status + progress */}
        <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-bold text-[#0F1923]">{tripLabel}</p>
              <p className="text-xs text-[#5A6474] mt-0.5">{trip.date}</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              isCompleted ? 'bg-[#0F6E56]/10 text-[#0F6E56]' :
              trip.status === 'CANCELLED' ? 'bg-[#E24B4A]/10 text-[#E24B4A]' :
              'bg-[#ec3d3a]/10 text-[#ec3d3a]'
            }`}>
              {isCompleted ? 'Completed' : trip.status === 'CANCELLED' ? 'Cancelled' : 'Scheduled'}
            </span>
          </div>
          <TripProgressBar
            completedStops={completedStops}
            totalStops={trip.stops.length}
            status={trip.status}
          />
          <div className="flex items-center justify-between mt-2 text-xs text-[#5A6474]">
            <span>{trip.stops.filter(s => s.type === 'PICKUP').length} pickups</span>
            <span>{trip.stops.filter(s => s.type === 'DROPOFF').length} dropoffs</span>
          </div>
          {/* Payment summary chips — only when the API has annotated stops with paymentStatus */}
          {hasPaymentInfo && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#0F6E56]/10 text-[#0F6E56]">
                {paidCount} paying
              </span>
              {overdueCount > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E24B4A]/10 text-[#E24B4A]">
                  {overdueCount} overdue
                </span>
              )}
            </div>
          )}
        </div>

        {/* Map overview */}
        {trip.stops.some(s => s.lat && s.lng) && (
          <TripMap stops={trip.stops} tripStatus={trip.status} isDriverView={true} />
        )}

        {/* Start button */}
        {trip.status === 'SCHEDULED' && (
          <Button
            onClick={handleStart}
            disabled={starting}
            className="w-full h-14 bg-[#ec3d3a] hover:bg-[#ec3d3a]/90 text-white font-semibold rounded-xl text-base"
          >
            <Play className="w-5 h-5 mr-2 fill-current" />
            {starting ? 'Starting…' : 'Start trip — begin navigation'}
          </Button>
        )}

        {/* Stop list (summary view for scheduled/completed) */}
        <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Navigation className="w-4 h-4 text-[#ec3d3a]" />
            <p className="font-semibold text-sm text-[#0F1923]">Route — {trip.stops.length} stops</p>
          </div>
          {trip.stops.map((stop, i) => (
            <TripStopCard
              key={stop.id}
              stop={stop}
              isFirst={i === 0}
              isLast={i === trip.stops.length - 1}
              isDriverView={false}
              tripType={trip.type}
              tripStatus={trip.status}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
