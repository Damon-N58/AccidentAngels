'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { DriverTopBar } from '@/components/driver/DriverTopBar'
import { TripStopCard } from '@/components/trips/TripStopCard'
import { TripProgressBar } from '@/components/trips/TripProgressBar'
import { Button } from '@/components/ui/button'
import { TripMap } from '@/components/trips/TripMap'
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
      if (!res.ok) throw new Error('Failed to start')
      toast.success('Trip started!')
      await fetchTrip()
    } catch {
      toast.error('Failed to start trip')
    } finally {
      setStarting(false)
    }
  }

  const handleComplete = async (stopId: string, lat?: number, lng?: number) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/stops`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopId, status: 'COMPLETED', lat, lng }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Stop completed')
      await fetchTrip()
    } catch {
      toast.error('Failed to update stop')
    }
  }

  const handleMissed = async (stopId: string, reason: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/stops`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopId, status: 'MISSED', missedReason: reason }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Stop marked as missed')
      await fetchTrip()
    } catch {
      toast.error('Failed to update stop')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB]">
        <DriverTopBar title="Trip" />
        <div className="px-4 pt-4 pb-24">
          <div className="bg-white rounded-2xl border border-[rgba(26,63,122,0.10)] p-5 animate-pulse">
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

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar title={trip.type === 'MORNING' ? 'Morning school run' : 'Afternoon school run'} />
      <div className="px-4 pt-4 pb-24 space-y-4">

        {/* Back */}
        <button onClick={() => router.push('/trips')} className="flex items-center gap-1 text-sm text-[#1A3F7A] font-medium hover:underline">
          <ChevronLeft className="w-4 h-4" /> All trips
        </button>

        {/* Progress */}
        <div className="bg-white rounded-2xl border border-[rgba(26,63,122,0.10)] p-4">
          <TripProgressBar
            completedStops={completedStops}
            totalStops={trip.stops.length}
            status={trip.status}
          />
          <div className="flex items-center justify-between mt-2 text-xs text-[#5A6474]">
            <span>{trip.stops.filter(s => s.type === 'PICKUP').length} pickups</span>
            <span>{trip.stops.filter(s => s.type === 'DROPOFF').length} dropoffs</span>
          </div>
        </div>

        {/* Map */}
        {trip.stops.some(s => s.lat && s.lng) && (
          <TripMap stops={trip.stops} tripStatus={trip.status} />
        )}

        {/* Start button */}
        {trip.status === 'SCHEDULED' && (
          <Button
            onClick={handleStart}
            disabled={starting}
            className="w-full h-12 bg-[#1A3F7A] hover:bg-[#1A3F7A]/90 text-white font-semibold rounded-xl text-base"
          >
            <Play className="w-5 h-5 mr-2" />
            {starting ? 'Starting…' : 'Start trip'}
          </Button>
        )}

        {/* Stop list */}
        <div className="bg-white rounded-2xl border border-[rgba(26,63,122,0.10)] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Navigation className="w-4 h-4 text-[#1A3F7A]" />
            <p className="font-semibold text-sm text-[#0F1923]">Route</p>
          </div>
          {trip.stops.map((stop, i) => (
            <TripStopCard
              key={stop.id}
              stop={stop}
              isFirst={i === 0}
              isLast={i === trip.stops.length - 1}
              isDriverView
              tripStatus={trip.status}
              onComplete={handleComplete}
              onMissed={handleMissed}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
