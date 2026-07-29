'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { ParentTopBar } from '@/components/parent/ParentTopBar'
import { TripStopCard } from '@/components/trips/TripStopCard'
import { TripProgressBar } from '@/components/trips/TripProgressBar'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, Navigation, Sun, Moon } from 'lucide-react'
import type { TripData } from '@/lib/trips/types'

export default function ParentTripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const { tripId } = use(params)
  const router = useRouter()
  const [trip, setTrip] = useState<TripData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
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
        setTrip(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tripId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB]">
        <ParentTopBar title="Trip" showBack />
        <div className="px-4 pt-4 animate-pulse">
          <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-5">
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
        <ParentTopBar title="Trip" showBack />
        <div className="px-4 pt-4 text-center text-sm text-[#5A6474]">Trip not found.</div>
      </div>
    )
  }

  const completedStops = trip.stops.filter(s => s.status === 'COMPLETED').length

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <ParentTopBar title={trip.type === 'MORNING' ? 'Morning trip' : 'Afternoon trip'} showBack />
      <div className="px-4 pt-4 pb-24 space-y-4">

        {/* Back */}
        <button onClick={() => router.push('/parent-app/trips')} className="flex items-center gap-1 text-sm text-[#ec3d3a] font-medium hover:underline">
          <ChevronLeft className="w-4 h-4" /> All trips
        </button>

        {/* Trip info */}
        <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                trip.type === 'MORNING' ? 'bg-[#fdc73e]/10' : 'bg-[#ec3d3a]/10'
              }`}>
                {trip.type === 'MORNING'
                  ? <Sun className="w-5 h-5 text-[#fdc73e]" />
                  : <Moon className="w-5 h-5 text-[#ec3d3a]" />}
              </div>
              <div>
                <p className="font-semibold text-sm text-[#0F1923]">
                  {trip.type === 'MORNING' ? 'Morning school run' : 'Afternoon school run'}
                </p>
                <p className="text-xs text-[#5A6474]">
                  {trip.date} · {new Date(trip.date + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'long' })}
                </p>
              </div>
              <span className={`ml-auto text-xs font-semibold px-2 py-1 rounded-full ${
                trip.status === 'COMPLETED' ? 'bg-[#0F6E56]/10 text-[#0F6E56]' :
                trip.status === 'IN_PROGRESS' ? 'bg-[#ec3d3a]/10 text-[#ec3d3a]' :
                trip.status === 'CANCELLED' ? 'bg-[#E24B4A]/10 text-[#E24B4A]' :
                'bg-[#F8F9FB] text-[#5A6474]'
              }`}>
                {trip.status === 'COMPLETED' ? 'Completed' :
                 trip.status === 'IN_PROGRESS' ? 'In progress' :
                 trip.status === 'CANCELLED' ? 'Cancelled' : 'Scheduled'}
              </span>
            </div>

            <TripProgressBar
              completedStops={completedStops}
              totalStops={trip.stops.length}
              status={trip.status}
            />
          </CardContent>
        </Card>

        {/* Stop list (read-only for parent) */}
        <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Navigation className="w-4 h-4 text-[#ec3d3a]" />
            <p className="font-semibold text-sm text-[#0F1923]">Route</p>
          </div>
          {trip.stops.map((stop, i) => (
            <TripStopCard
              key={stop.id}
              stop={stop}
              isFirst={i === 0}
              isLast={i === trip.stops.length - 1}
              tripType={trip.type}
              tripStatus={trip.status}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
