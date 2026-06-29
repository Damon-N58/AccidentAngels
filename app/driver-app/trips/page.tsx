'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DriverTopBar } from '@/components/driver/DriverTopBar'
import { TripProgressBar } from '@/components/trips/TripProgressBar'
import { Card, CardContent } from '@/components/ui/card'
import { Navigation, Sun, Moon, CalendarDays, ChevronRight, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { TripData } from '@/lib/trips/types'

export default function DriverTripsPage() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [trips, setTrips] = useState<TripData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTrips = useCallback(async (d: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/trips?date=${d}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setTrips(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTrips(date) }, [date, fetchTrips])

  const morning = trips.find(t => t.type === 'MORNING')
  const afternoon = trips.find(t => t.type === 'AFTERNOON')

  const completedStops = (t: TripData) => t.stops.filter(s => s.status === 'COMPLETED').length

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar title="Trips" />
      <div className="px-4 pt-4 pb-24 space-y-4">

        {/* Date picker */}
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full h-10 text-sm border border-[rgba(236,61,58,0.15)] rounded-xl px-3 outline-none focus:border-[#ec3d3a]"
        />

        {error && (
          <div className="flex items-center gap-2 bg-[#E24B4A]/10 border border-[#E24B4A]/30 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-[#E24B4A] shrink-0" />
            <p className="text-sm text-[#0F1923]">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-5 animate-pulse">
                <div className="h-4 bg-[#E8EAED] rounded w-1/3 mb-3" />
                <div className="h-3 bg-[#E8EAED] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : trips.length === 0 && !error ? (
          <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-6 text-center space-y-1">
            <CalendarDays className="w-8 h-8 text-[#5A6474] mx-auto mb-2" />
            <p className="text-sm font-medium text-[#0F1923]">No trips for this date</p>
            <p className="text-xs text-[#5A6474]">
              Trips are auto-generated from children&apos;s schedules.
            </p>
            <p className="text-xs text-[#fdc73e] font-medium pt-1">
              Ask the parent to set up a schedule under their child&apos;s profile, then trips will appear here automatically.
            </p>
          </div>
        ) : (
          <>
            {/* Morning trip */}
            {morning && (
              <button onClick={() => router.push(`/driver-app/trips/${morning.id}`)} className="w-full text-left">
                <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-[#fdc73e]/10 flex items-center justify-center">
                        <Sun className="w-5 h-5 text-[#fdc73e]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[#0F1923]">Morning school run</p>
                        <p className="text-xs text-[#5A6474]">
                          {morning.stops.length} stop{morning.stops.length !== 1 ? 's' : ''}
                          {morning.stops.filter(s => s.type === 'PICKUP').length > 0 && (
                            <> · {morning.stops.filter(s => s.type === 'PICKUP').length} pickup{morning.stops.filter(s => s.type === 'PICKUP').length !== 1 ? 's' : ''}</>
                          )}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#5A6474]" />
                    </div>
                    <TripProgressBar
                      completedStops={completedStops(morning)}
                      totalStops={morning.stops.length}
                      status={morning.status}
                    />
                    {/* Payment chips — only when at least one stop has paymentStatus annotated */}
                    {morning.stops.some(s => s.paymentStatus) && (() => {
                      const paid = morning.stops.filter(s => s.paymentStatus === 'PAID').length
                      const overdue = morning.stops.filter(s => s.paymentStatus === 'OVERDUE').length
                      return (
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#0F6E56]/10 text-[#0F6E56]">
                            {paid} paying
                          </span>
                          {overdue > 0 && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E24B4A]/10 text-[#E24B4A]">
                              {overdue} overdue
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>
              </button>
            )}

            {/* Afternoon trip */}
            {afternoon && (
              <button onClick={() => router.push(`/driver-app/trips/${afternoon.id}`)} className="w-full text-left">
                <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-[#ec3d3a]/10 flex items-center justify-center">
                        <Moon className="w-5 h-5 text-[#ec3d3a]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[#0F1923]">Afternoon school run</p>
                        <p className="text-xs text-[#5A6474]">
                          {afternoon.stops.length} stop{afternoon.stops.length !== 1 ? 's' : ''}
                          {afternoon.stops.filter(s => s.type === 'PICKUP').length > 0 && (
                            <> · {afternoon.stops.filter(s => s.type === 'PICKUP').length} pickup{afternoon.stops.filter(s => s.type === 'PICKUP').length !== 1 ? 's' : ''}</>
                          )}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#5A6474]" />
                    </div>
                    <TripProgressBar
                      completedStops={completedStops(afternoon)}
                      totalStops={afternoon.stops.length}
                      status={afternoon.status}
                    />
                    {/* Payment chips — only when at least one stop has paymentStatus annotated */}
                    {afternoon.stops.some(s => s.paymentStatus) && (() => {
                      const paid = afternoon.stops.filter(s => s.paymentStatus === 'PAID').length
                      const overdue = afternoon.stops.filter(s => s.paymentStatus === 'OVERDUE').length
                      return (
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#0F6E56]/10 text-[#0F6E56]">
                            {paid} paying
                          </span>
                          {overdue > 0 && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E24B4A]/10 text-[#E24B4A]">
                              {overdue} overdue
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </CardContent>
                </Card>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
