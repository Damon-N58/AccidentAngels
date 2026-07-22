'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerLabel,
  MapRoute,
  MapControls,
  type MapRef,
} from '@/components/ui/map'
import { cn } from '@/lib/utils'
import type { TripStopData } from '@/lib/trips/types'

interface TripMapProps {
  stops: TripStopData[]
  tripStatus: string
  isDriverView?: boolean
}

/** Returns the ring border classes based on paymentStatus. */
function paymentBorderClass(paymentStatus?: 'PAID' | 'OVERDUE'): string {
  if (paymentStatus === 'PAID') return 'border-4 border-[#22C55E]'
  if (paymentStatus === 'OVERDUE') return 'border-4 border-[#EF4444]'
  return 'border-2 border-white'
}

const DEFAULT_CENTER: [number, number] = [28.0473, -26.2041]

export function TripMap({ stops, tripStatus, isDriverView = false }: TripMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)

  const validStops = useMemo(
    () => stops.filter((s): s is TripStopData & { lat: number; lng: number } => s.lat != null && s.lng != null),
    [stops],
  )

  const initialCenter = useMemo<[number, number]>(
    () => (validStops[0] ? [validStops[0].lng, validStops[0].lat] : DEFAULT_CENTER),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const routeCoords = useMemo<[number, number][]>(
    () => validStops.map((s) => [s.lng, s.lat]),
    [validStops],
  )

  const routeColor =
    tripStatus === 'IN_PROGRESS' ? '#1A3F7A' : tripStatus === 'COMPLETED' ? '#0F6E56' : '#5A6474'

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  // Fit the camera to all stops once they're known.
  useEffect(() => {
    const map = mapRef.current
    if (!map || validStops.length === 0) return

    if (validStops.length === 1) {
      map.jumpTo({ center: [validStops[0].lng, validStops[0].lat], zoom: 14 })
      return
    }

    let minLng = Infinity
    let minLat = Infinity
    let maxLng = -Infinity
    let maxLat = -Infinity
    for (const s of validStops) {
      minLng = Math.min(minLng, s.lng)
      maxLng = Math.max(maxLng, s.lng)
      minLat = Math.min(minLat, s.lat)
      maxLat = Math.max(maxLat, s.lat)
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 60, maxZoom: 15, duration: 0 },
    )
  }, [validStops])

  return (
    <div className="rounded-2xl overflow-hidden border border-[rgba(26,63,122,0.10)] shadow-sm">
      <div className="w-full h-64">
        <Map ref={mapRef} center={initialCenter} zoom={13}>
          <MapControls showZoom />

          {routeCoords.length >= 2 && (
            <MapRoute
              coordinates={routeCoords}
              color={routeColor}
              width={3}
              opacity={0.7}
              dashArray={tripStatus === 'SCHEDULED' ? [10, 10] : undefined}
            />
          )}

          {validStops.map((stop, i) => {
            const bg =
              stop.status === 'COMPLETED'
                ? '#0F6E56'
                : stop.status === 'MISSED'
                  ? '#E24B4A'
                  : stop.type === 'PICKUP'
                    ? '#1A3F7A'
                    : '#0F6E56'
            const glyph =
              stop.status === 'COMPLETED' ? '✓' : stop.status === 'MISSED' ? '✕' : stop.type === 'PICKUP' ? 'P' : 'D'

            return (
              <MapMarker key={stop.id} longitude={stop.lng} latitude={stop.lat}>
                <MarkerContent>
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg',
                      paymentBorderClass(stop.paymentStatus),
                    )}
                    style={{ background: bg }}
                  >
                    {glyph}
                  </div>
                </MarkerContent>
                {i === 0 && routeCoords.length >= 2 && (
                  <MarkerLabel
                    position="top"
                    className="bg-[#F5A623] text-[#0F1923] px-1.5 py-0.5 rounded border border-white shadow"
                  >
                    START
                  </MarkerLabel>
                )}
                <MarkerPopup>
                  <p className="font-bold text-sm">
                    {stop.child?.name ?? 'Child'} – {stop.type === 'PICKUP' ? 'Pickup' : 'Dropoff'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{stop.address}</p>
                  {stop.paymentStatus === 'OVERDUE' && (
                    <p className="text-xs font-semibold text-[#EF4444] mt-1">Fees overdue</p>
                  )}
                </MarkerPopup>
              </MapMarker>
            )
          })}

          {userPos && (
            <MapMarker longitude={userPos.lng} latitude={userPos.lat}>
              <MarkerContent>
                <div className="w-5 h-5 rounded-full bg-[#4285F4] border-[3px] border-white shadow-[0_0_0_2px_#4285F4]" />
              </MarkerContent>
              <MarkerPopup>
                <p className="font-bold text-sm">Your location</p>
              </MarkerPopup>
            </MapMarker>
          )}
        </Map>
      </div>
      <div className="flex flex-wrap items-center gap-4 px-3 py-2 bg-white text-xs text-[#5A6474] border-t border-[rgba(26,63,122,0.06)]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#1A3F7A] inline-block" /> Pickup
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#0F6E56] inline-block" /> Dropoff
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#4285F4] border border-white shadow-sm inline-block" /> Your location
        </span>
        {/* Payment ring legend — only shown in driver view when at least one stop has paymentStatus */}
        {isDriverView && stops.some((s) => s.paymentStatus) && (
          <>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-transparent border-2 border-[#22C55E] inline-block" /> Paid
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-transparent border-2 border-[#EF4444] inline-block" /> Overdue
            </span>
          </>
        )}
      </div>
    </div>
  )
}
