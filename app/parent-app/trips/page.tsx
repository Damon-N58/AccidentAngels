'use client'

import { useState, useEffect, useCallback } from 'react'
import { ParentTopBar } from '@/components/parent/ParentTopBar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarDays, ChevronLeft, ChevronRight, Sun, Moon, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { TripData } from '@/lib/trips/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function ParentTripsPage() {
  const router = useRouter()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [tripsByDate, setTripsByDate] = useState<Map<string, TripData[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [selectedTrips, setSelectedTrips] = useState<TripData[]>([])

  const year = currentMonth.getFullYear()
  const monthIndex = currentMonth.getMonth()
  const firstDay = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  const fetchMonth = useCallback(async () => {
    setLoading(true)
    try {
      const start = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
      const end = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

      // ONE request for the whole month (was one request per day → ~30 on mobile)
      const res = await fetch(`/api/trips?from=${start}&to=${end}`)
      const allTrips: TripData[] = res.ok ? await res.json() : []

      const map = new Map<string, TripData[]>()
      for (const trip of allTrips) {
        const key = trip.date
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(trip)
      }
      setTripsByDate(map)
      setSelectedTrips(map.get(selectedDate) ?? [])
    } catch {
      // silently handle — trips are optional
    } finally {
      setLoading(false)
    }
  }, [year, monthIndex, daysInMonth, selectedDate])

  useEffect(() => { fetchMonth() }, [fetchMonth])

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr)
    setSelectedTrips(tripsByDate.get(dateStr) ?? [])
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const completedStops = (t: TripData) => t.stops.filter(s => s.status === 'COMPLETED').length

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <ParentTopBar title="Trips" />
      <div className="px-4 pt-4 pb-24 space-y-4">

        {/* Calendar nav */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => {
              const d = new Date(currentMonth)
              d.setMonth(d.getMonth() - 1)
              setCurrentMonth(d)
            }}
            className="p-1 hover:bg-[#F8F9FB] rounded-lg"
          >
            <ChevronLeft className="w-4 h-4 text-[#5A6474]" />
          </button>
          <span className="text-sm font-semibold text-[#0F1923]">
            {MONTHS[monthIndex]} {year}
          </span>
          <button
            onClick={() => {
              const d = new Date(currentMonth)
              d.setMonth(d.getMonth() + 1)
              setCurrentMonth(d)
            }}
            className="p-1 hover:bg-[#F8F9FB] rounded-lg"
          >
            <ChevronRight className="w-4 h-4 text-[#5A6474]" />
          </button>
        </div>

        {/* Calendar grid */}
        <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
          <CardContent className="p-3">
            <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Calendar">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-xs font-medium text-[#5A6474] py-1">{d}</div>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} />
                const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isToday = dateStr === todayStr
                const isSelected = dateStr === selectedDate
                const hasTrips = tripsByDate.has(dateStr)
                return (
                  <button
                    key={dateStr}
                    onClick={() => handleSelectDate(dateStr)}
                    className={`relative h-11 min-h-[44px] text-sm rounded-lg transition-colors flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#ec3d3a] text-white'
                        : isToday
                          ? 'ring-2 ring-[#ec3d3a] ring-offset-1 bg-white text-[#0F1923]'
                          : 'text-[#5A6474] hover:bg-[#F8F9FB]'
                    }`}
                  >
                    {day}
                    {hasTrips && !isSelected && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#fdc73e]" />
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Book a trip button */}
        <Button
          onClick={() => router.push('/parent-app/trips/book')}
          variant="outline"
          className="w-full h-11 border border-[rgba(236,61,58,0.15)] text-[#ec3d3a] font-semibold rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" />
          Book a one-off trip
        </Button>

        {/* Selected date trips */}
        <div>
          <p className="text-sm font-semibold text-[#0F1923] mb-3">
            {selectedDate === todayStr ? 'Today' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-4 animate-pulse">
                  <div className="h-4 bg-[#E8EAED] rounded w-1/3 mb-2" />
                  <div className="h-3 bg-[#E8EAED] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : selectedTrips.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-6 text-center">
              <CalendarDays className="w-8 h-8 text-[#5A6474] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#0F1923]">No trips</p>
              <p className="text-xs text-[#5A6474] mt-1">No trips scheduled for this day.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedTrips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => router.push(`/parent-app/trips/${trip.id}`)}
                  className="w-full text-left"
                >
                  <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          trip.type === 'MORNING' ? 'bg-[#fdc73e]/10' : 'bg-[#ec3d3a]/10'
                        }`}>
                          {trip.type === 'MORNING'
                            ? <Sun className="w-4 h-4 text-[#fdc73e]" />
                            : <Moon className="w-4 h-4 text-[#ec3d3a]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-[#0F1923]">
                            {trip.type === 'MORNING' ? 'Morning' : 'Afternoon'} trip
                            {trip.driverName ? ` · ${trip.driverName}` : ''}
                          </p>
                          <p className="text-xs text-[#5A6474]">
                            {completedStops(trip)} of {trip.stops.length} stops completed
                          </p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          trip.status === 'COMPLETED' ? 'bg-[#0F6E56]/10 text-[#0F6E56]' :
                          trip.status === 'IN_PROGRESS' ? 'bg-[#ec3d3a]/10 text-[#ec3d3a]' :
                          trip.status === 'CANCELLED' ? 'bg-[#E24B4A]/10 text-[#E24B4A]' :
                          'bg-[#F8F9FB] text-[#5A6474]'
                        }`}>
                          {trip.status === 'COMPLETED' ? 'Done' :
                           trip.status === 'IN_PROGRESS' ? 'Live' :
                           trip.status === 'CANCELLED' ? 'Cancelled' : 'Scheduled'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
