'use client'

import { useState, useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { ChevronLeft, Navigation2, CheckCircle2, XCircle, MapPin, Clock, AlertTriangle, Car, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { TripData, TripStopData } from '@/lib/trips/types'
import { toUtcDate } from '@/lib/dates'

interface Props {
  trip: TripData
  onBack: () => void
  onStopComplete: (stopId: string, lat?: number, lng?: number) => Promise<void>
  onStopMissed: (stopId: string, reason: string) => Promise<void>
  onStopArrived: (stopId: string) => Promise<void>
  onTripRefresh: () => void
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function fetchOsrmRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<{ coords: [number, number][]; minutes: number }> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error('OSRM unavailable')
    const data = await res.json()
    if (!data.routes?.length) throw new Error('No route found')
    const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng],
    )
    const minutes = Math.ceil(data.routes[0].duration / 60)
    return { coords, minutes }
  } catch {
    // Straight-line fallback
    return { coords: [[from.lat, from.lng], [to.lat, to.lng]], minutes: 0 }
  }
}

function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
}

/** Returns the ring border style for a stop marker based on its paymentStatus. */
function paymentBorder(paymentStatus?: 'PAID' | 'OVERDUE'): string {
  if (paymentStatus === 'PAID') return '4px solid #22C55E'
  if (paymentStatus === 'OVERDUE') return '4px solid #EF4444'
  return '3px solid white'
}

// Grace period = 3 minutes, rate = R5/min (500 cents/min)
const GRACE_SECONDS = 180
const RATE_CENTS_PER_MIN = 500

/** Format elapsed seconds as M:SS */
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Client-side waiting charge estimate (mirrors lib/trips/waiting-charge.ts) */
function estimateChargeCents(elapsedSec: number): number {
  if (elapsedSec <= GRACE_SECONDS) return 0
  return Math.ceil((elapsedSec - GRACE_SECONDS) / 60) * RATE_CENTS_PER_MIN
}

/** Live timer card shown while driver has arrived but not yet confirmed */
function WaitingTimerCard({ arrivedAt }: { arrivedAt: string }) {
  const [elapsedSec, setElapsedSec] = useState(0)

  useEffect(() => {
    const arrivedMs = toUtcDate(arrivedAt).getTime()

    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - arrivedMs) / 1000))
      setElapsedSec(elapsed)
    }

    tick() // immediate first tick
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [arrivedAt]) // reset when stop changes

  const inGrace = elapsedSec <= GRACE_SECONDS
  const remainingGrace = Math.max(0, GRACE_SECONDS - elapsedSec)
  const chargeCents = estimateChargeCents(elapsedSec)
  const chargeRands = (chargeCents / 100).toFixed(2)

  return (
    <div className={`rounded-2xl px-4 py-3 border flex items-center gap-3 ${
      inGrace
        ? 'bg-[#0F6E56]/08 border-[#0F6E56]/25'
        : 'bg-[#fdc73e]/12 border-[#fdc73e]/40'
    }`}>
      <Timer className={`w-5 h-5 shrink-0 ${inGrace ? 'text-[#0F6E56]' : 'text-[#fdc73e]'}`} />
      <div className="flex-1 min-w-0">
        {inGrace ? (
          <>
            <p className="text-sm font-semibold text-[#0F6E56]">
              Grace period — {formatElapsed(elapsedSec)}
            </p>
            <p className="text-xs text-[#5A6474]">
              Free waiting ends in {formatElapsed(remainingGrace)}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-[#fdc73e]">
              Waiting — {formatElapsed(elapsedSec)}
            </p>
            <p className="text-xs text-[#5A6474]">
              Estimated charge: R{chargeRands}
            </p>
          </>
        )}
      </div>
      {/* Large elapsed display */}
      <span className={`text-lg font-bold tabular-nums shrink-0 ${
        inGrace ? 'text-[#0F6E56]' : 'text-[#E24B4A]'
      }`}>
        {formatElapsed(elapsedSec)}
      </span>
    </div>
  )
}

export function ActiveTripNavigation({ trip, onBack, onStopComplete, onStopMissed, onStopArrived, onTripRefresh }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const driverMarkerRef = useRef<any>(null)
  const routeLayerRef = useRef<any>(null)
  const stopMarkersRef = useRef<any>(null)
  const lastRoutePos = useRef<{ lat: number; lng: number } | null>(null)

  const [mounted, setMounted] = useState(false)
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null)
  const [eta, setEta] = useState<number | null>(null)
  const [nearStop, setNearStop] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [arriving, setArriving] = useState(false)    // loading state for the "Arrived" button
  const [showMissed, setShowMissed] = useState(false)
  const [missedReason, setMissedReason] = useState('')
  const [sheetExpanded, setSheetExpanded] = useState(false)

  const pendingStops = trip.stops.filter(s => s.status === 'PENDING')
  const nextStop: TripStopData | null = pendingStops[0] ?? null

  // Stop semantics depend on direction: MORNING pickup=home/dropoff=school,
  // AFTERNOON pickup=school/dropoff=home.
  const isSchoolStop = (s: TripStopData) =>
    trip.type === 'MORNING' ? s.type === 'DROPOFF' : s.type === 'PICKUP'
  const stopActionLabel = (s: TripStopData) =>
    s.type === 'PICKUP'
      ? (isSchoolStop(s) ? 'Collect at school' : 'Pick up')
      : (isSchoolStop(s) ? 'Drop at school' : 'Drop home')
  const completedCount = trip.stops.filter(s => s.status === 'COMPLETED').length
  const totalStops = trip.stops.length
  const progressPct = totalStops > 0 ? (completedCount / totalStops) * 100 : 0
  const allDone = pendingStops.length === 0

  // Whether the driver has arrived at the current stop (stage 2 of the flow)
  const hasArrived = !!(nextStop?.arrivedAt)

  useEffect(() => { setMounted(true) }, [])

  // ── Initialise Leaflet map ────────────────────────────────
  useEffect(() => {
    if (!mounted || !mapContainerRef.current || mapRef.current) return

    let cancelled = false
    const init = async () => {
      await new Promise(r => requestAnimationFrame(r))
      if (cancelled || !mapContainerRef.current) return

      const L = await import('leaflet')
      if (cancelled) return

      leafletRef.current = L

      const center: [number, number] = nextStop?.lat && nextStop?.lng
        ? [nextStop.lat, nextStop.lng]
        : [-26.2041, 28.0473]

      const map = L.map(mapContainerRef.current!, {
        center,
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      L.control.zoom({ position: 'topright' }).addTo(map)
      L.control.attribution({ position: 'bottomleft', prefix: '© OSM' }).addTo(map)

      // Route layer (below markers)
      const routeLayer = L.featureGroup().addTo(map)
      routeLayerRef.current = routeLayer

      // Stop markers layer
      const stopsLayer = L.featureGroup().addTo(map)
      stopMarkersRef.current = stopsLayer

      // Build stop markers — fill = stop status, ring = payment status
      trip.stops.forEach((stop, i) => {
        if (!stop.lat || !stop.lng) return
        const isNext = stop.id === nextStop?.id
        const isDone = stop.status === 'COMPLETED'
        const isMissed = stop.status === 'MISSED'
        const bg = isDone ? '#0F6E56' : isMissed ? '#E24B4A' : isNext ? '#ec3d3a' : '#94A3B8'
        const scale = isNext ? '1.25' : '1'
        const border = paymentBorder(stop.paymentStatus)
        const icon = L.divIcon({
          className: '',
          html: `
            <div style="
              width:40px;height:40px;border-radius:50%;
              background:${bg};color:white;
              display:flex;align-items:center;justify-content:center;
              font-size:14px;font-weight:800;
              border:${border};
              box-shadow:0 3px 12px rgba(0,0,0,0.35);
              transform:scale(${scale});
              transition:transform .2s;
            ">
              ${isDone ? '✓' : isMissed ? '✕' : i + 1}
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        })
        // Append overdue line to popup if relevant
        const overdueHtml = stop.paymentStatus === 'OVERDUE'
          ? `<div style="font-size:11px;color:#EF4444;font-weight:600;margin-top:4px;">Fees overdue</div>`
          : ''
        L.marker([stop.lat, stop.lng], { icon })
          .bindPopup(`
            <div style="font-family:system-ui;min-width:160px">
              <b style="font-size:13px">${stop.child?.name ?? 'Child'}</b>
              <div style="font-size:11px;color:#666;margin-top:2px">${isSchoolStop(stop) ? '🏫' : '🏠'} ${stopActionLabel(stop)}</div>
              <div style="font-size:11px;color:#444;margin-top:4px">${stop.address}</div>
              ${overdueHtml}
            </div>
          `)
          .addTo(stopsLayer)
      })

      // Driver position marker (pulsing blue dot)
      const driverIcon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:28px;height:28px">
            <div style="
              position:absolute;inset:-6px;border-radius:50%;
              background:rgba(66,133,244,0.2);
              animation:gps-pulse 2s ease-in-out infinite;
            "></div>
            <div style="
              position:absolute;inset:0;border-radius:50%;
              background:#4285F4;border:3px solid white;
              box-shadow:0 2px 8px rgba(0,0,0,0.3);
            "></div>
          </div>
          <style>
            @keyframes gps-pulse {
              0%,100% { transform:scale(1); opacity:.3 }
              50% { transform:scale(1.6); opacity:0 }
            }
          </style>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })
      driverMarkerRef.current = L.marker(center, { icon: driverIcon, zIndexOffset: 1000 }).addTo(map)

      mapRef.current = map
      map.invalidateSize()
    }

    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      leafletRef.current = null
    }
  }, [mounted])

  // ── GPS watch ─────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      pos => setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => console.warn('[GPS] watchPosition error:', err.code, err.message),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // ── Update map as driver moves ────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L || !driverPos) return

    // Move driver dot
    driverMarkerRef.current?.setLatLng([driverPos.lat, driverPos.lng])
    map.setView([driverPos.lat, driverPos.lng], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.8,
    })

    if (!nextStop?.lat || !nextStop?.lng) return

    // Check arrival proximity
    const dist = haversineMeters(driverPos.lat, driverPos.lng, nextStop.lat, nextStop.lng)
    setNearStop(dist < 200)

    // Only re-fetch route if moved >40 m from last fetch
    const last = lastRoutePos.current
    if (last && haversineMeters(driverPos.lat, driverPos.lng, last.lat, last.lng) < 40) return
    lastRoutePos.current = driverPos

    fetchOsrmRoute(driverPos, { lat: nextStop.lat, lng: nextStop.lng }).then(({ coords, minutes }) => {
      const routeLayer = routeLayerRef.current
      if (!routeLayer || !L) return
      routeLayer.clearLayers()
      if (coords.length >= 2) {
        // Shadow line
        L.polyline(coords, { color: 'rgba(0,0,0,0.15)', weight: 8, lineCap: 'round' }).addTo(routeLayer)
        // Main route line
        L.polyline(coords, { color: '#ec3d3a', weight: 5, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayer)
        // Animated dash on top
        L.polyline(coords, {
          color: 'white',
          weight: 2,
          lineCap: 'round',
          dashArray: '8 14',
          opacity: 0.7,
        }).addTo(routeLayer)
      }
      if (minutes > 0) setEta(minutes)
    })
  }, [driverPos, nextStop])

  // ── Actions ───────────────────────────────────────────────

  /** Stage 1: driver taps "Arrived" — stamps arrivedAt server-side */
  async function handleArrived() {
    if (!nextStop || arriving) return
    setArriving(true)
    try {
      await onStopArrived(nextStop.id)
      // arrivedAt will be set on the stop after parent refetches; timer renders automatically
    } catch {
      toast.error('Could not record arrival')
    } finally {
      setArriving(false)
    }
  }

  /** Stage 2: driver confirms pickup/dropoff — marks stop COMPLETED (waiting charge computed server-side) */
  async function handleConfirm() {
    if (!nextStop || completing) return
    setCompleting(true)
    try {
      await onStopComplete(nextStop.id, driverPos?.lat, driverPos?.lng)
      setNearStop(false)
      lastRoutePos.current = null
      routeLayerRef.current?.clearLayers()
      toast.success(`Stop marked complete`)
    } catch {
      toast.error('Failed to mark stop')
    } finally {
      setCompleting(false)
    }
  }

  async function handleMissed() {
    if (!nextStop || !missedReason.trim()) return
    setCompleting(true)
    try {
      await onStopMissed(nextStop.id, missedReason.trim())
      setShowMissed(false)
      setMissedReason('')
      routeLayerRef.current?.clearLayers()
    } catch {
      toast.error('Failed to mark stop')
    } finally {
      setCompleting(false)
    }
  }

  if (!mounted) return <div className="flex-1 bg-[#F8F9FB] animate-pulse" />

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">

      {/* ── Top bar — floats over map ─────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-[600] flex items-center gap-3 px-4 pt-safe pb-3 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 w-full">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-tight truncate">
            {trip.type === 'MORNING' ? '🌅 Morning run' : '🌆 Afternoon run'}
          </p>
          <p className="text-white/70 text-xs">
            {completedCount}/{totalStops} stops · {allDone ? 'Complete' : `${Math.round(100 - progressPct)}% remaining`}
          </p>
        </div>
        {/* Progress pill */}
        <div className="shrink-0 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
          <p className="text-white text-xs font-semibold">{completedCount}/{totalStops}</p>
        </div>
        </div>{/* end pointer-events-auto */}
      </div>{/* end top bar */}

      {/* ── Map — flex-1 with min-h-0 so it doesn't overflow into sheet ── */}
      <div ref={mapContainerRef} className="flex-1 min-h-0 w-full" style={{ zIndex: 0 }} />

      {/* ── Bottom sheet — in normal flex flow, NOT absolute ────────────── */}
      {/* z-[600] keeps it above Leaflet panes (max z-index ~500) */}
      <div className={`
        relative z-[600] shrink-0
        bg-white rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.2)]
        transition-all duration-300
        ${sheetExpanded ? 'max-h-[70vh] overflow-y-auto' : ''}
      `}>

        {/* Drag handle */}
        <button
          onClick={() => setSheetExpanded(e => !e)}
          className="w-full flex justify-center pt-3 pb-1"
        >
          <div className="w-10 h-1 rounded-full bg-[#D0D3D8]" />
        </button>

        {allDone ? (
          // ── Trip complete state ─────────────────────────
          <div className="px-5 pb-8 pt-2 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#0F6E56]/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-[#0F6E56]" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#0F1923]">Trip complete!</p>
              <p className="text-sm text-[#5A6474] mt-1">All {totalStops} stops done</p>
            </div>
            <Button
              onClick={onBack}
              className="w-full h-12 bg-[#0F6E56] hover:bg-[#0F6E56]/90 text-white font-semibold rounded-xl"
            >
              Back to trips
            </Button>
          </div>
        ) : nextStop ? (
          // ── Active stop ─────────────────────────────────
          <div className="px-5 pb-8 pt-2 space-y-4">

            {/* Arrival proximity alert (only before driver has tapped Arrived) */}
            {nearStop && !hasArrived && (
              <div className="flex items-center gap-2 bg-[#fdc73e]/15 border border-[#fdc73e]/40 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-[#fdc73e] shrink-0" />
                <p className="text-sm font-semibold text-[#0F1923]">You're nearby — ready to mark arrived?</p>
              </div>
            )}

            {/* Live waiting timer — shown once driver has tapped "Arrived" */}
            {hasArrived && nextStop.arrivedAt && (
              <WaitingTimerCard arrivedAt={nextStop.arrivedAt} />
            )}

            {/* Stop info */}
            <div className="flex items-start gap-3">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                nextStop.type === 'PICKUP' ? 'bg-[#ec3d3a]/10' : 'bg-[#0F6E56]/10'
              }`}>
                {nextStop.type === 'PICKUP'
                  ? <Car className="w-5 h-5 text-[#ec3d3a]" />
                  : <CheckCircle2 className="w-5 h-5 text-[#0F6E56]" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    nextStop.type === 'PICKUP'
                      ? 'bg-[#ec3d3a]/10 text-[#ec3d3a]'
                      : 'bg-[#0F6E56]/10 text-[#0F6E56]'
                  }`}>
                    {stopActionLabel(nextStop)}
                  </span>
                  {eta !== null && !hasArrived && (
                    <span className="flex items-center gap-1 text-xs text-[#5A6474]">
                      <Clock className="w-3 h-3" />
                      ~{eta} min
                    </span>
                  )}
                  {!driverPos && (
                    <span className="text-xs text-[#fdc73e]">Getting location…</span>
                  )}
                </div>
                <p className="font-bold text-[#0F1923] text-base mt-0.5">{nextStop.child?.name ?? 'Child'}</p>
                <p className="text-sm text-[#5A6474] mt-0.5 leading-snug">{nextStop.address}</p>
                {nextStop.notes && (
                  <p className="text-xs text-[#fdc73e] mt-1">⚠ {nextStop.notes}</p>
                )}
                {/* Payment chip — only when paymentStatus is defined */}
                {nextStop.paymentStatus === 'OVERDUE' && (
                  <span className="inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E24B4A]/10 text-[#E24B4A]">
                    Overdue — fees outstanding
                  </span>
                )}
                {nextStop.paymentStatus === 'PAID' && (
                  <span className="inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#0F6E56]/10 text-[#0F6E56]">
                    Paid
                  </span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[#5A6474]">
                <span>Stop {completedCount + 1} of {totalStops}</span>
                <span>{pendingStops.length} remaining</span>
              </div>
              <div className="h-2 bg-[#E8EAED] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ec3d3a] rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Action buttons */}
            {!showMissed ? (
              <div className="flex gap-3">
                {/* Navigate button — always visible */}
                <a
                  href={nextStop.lat && nextStop.lng ? googleMapsUrl(nextStop.lat, nextStop.lng) : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-12 rounded-xl border-2 border-[#ec3d3a] text-[#ec3d3a] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#ec3d3a]/05"
                >
                  <Navigation2 className="w-4 h-4" />
                  Navigate
                </a>

                {!hasArrived ? (
                  // Stage 1 — driver has not yet arrived
                  <Button
                    onClick={handleArrived}
                    disabled={arriving}
                    className="flex-[1.5] h-12 bg-[#0F6E56] hover:bg-[#0F6E56]/90 text-white font-semibold rounded-xl text-sm"
                  >
                    <MapPin className="w-4 h-4 mr-1.5" />
                    {arriving ? 'Marking…' : 'Arrived'}
                  </Button>
                ) : (
                  // Stage 2 — driver has arrived, waiting for child
                  <Button
                    onClick={handleConfirm}
                    disabled={completing}
                    className="flex-[1.5] h-12 bg-[#ec3d3a] hover:bg-[#ec3d3a]/90 text-white font-semibold rounded-xl text-sm"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {completing
                      ? 'Confirming…'
                      : nextStop.type === 'PICKUP'
                        ? (isSchoolStop(nextStop) ? 'Confirm collected' : 'Confirm pickup')
                        : (isSchoolStop(nextStop) ? 'Confirm dropped at school' : 'Confirm dropped home')
                    }
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Reason for missing this stop"
                  value={missedReason}
                  onChange={e => setMissedReason(e.target.value)}
                  className="w-full h-11 text-sm border border-[rgba(236,61,58,0.2)] rounded-xl px-3 outline-none focus:border-[#E24B4A]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowMissed(false); setMissedReason('') }}
                    className="flex-1 h-11 text-sm text-[#5A6474] border border-[rgba(236,61,58,0.15)] rounded-xl"
                  >
                    Cancel
                  </button>
                  <Button
                    onClick={handleMissed}
                    disabled={!missedReason.trim() || completing}
                    className="flex-1 h-11 bg-[#E24B4A] hover:bg-[#E24B4A]/90 text-white font-semibold rounded-xl text-sm"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Mark missed
                  </Button>
                </div>
              </div>
            )}

            {/* Miss stop toggle */}
            {!showMissed && (
              <button
                onClick={() => setShowMissed(true)}
                className="w-full text-xs text-[#5A6474] text-center hover:text-[#E24B4A] transition-colors"
              >
                Child not available? Mark as missed
              </button>
            )}

            {/* Expanded: remaining stops list */}
            {sheetExpanded && pendingStops.length > 1 && (
              <div className="border-t border-[rgba(236,61,58,0.08)] pt-4 space-y-3">
                <p className="text-xs font-semibold text-[#5A6474] uppercase tracking-wide">Upcoming stops</p>
                {pendingStops.slice(1).map((stop, i) => (
                  <div key={stop.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#E8EAED] flex items-center justify-center text-xs font-semibold text-[#5A6474] shrink-0">
                      {completedCount + i + 2}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-[#0F1923] truncate">{stop.child?.name}</p>
                        {/* Payment dot — green for PAID, red for OVERDUE, hidden if undefined */}
                        {stop.paymentStatus === 'PAID' && (
                          <span className="w-2 h-2 rounded-full bg-[#22C55E] shrink-0" title="Paid" />
                        )}
                        {stop.paymentStatus === 'OVERDUE' && (
                          <span className="w-2 h-2 rounded-full bg-[#EF4444] shrink-0" title="Overdue" />
                        )}
                      </div>
                      <p className="text-xs text-[#5A6474] truncate">{stop.address}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      stop.type === 'PICKUP' ? 'bg-[#ec3d3a]/08 text-[#ec3d3a]' : 'bg-[#0F6E56]/08 text-[#0F6E56]'
                    }`}>
                      {isSchoolStop(stop) ? '🏫' : '🏠'} {stop.type === 'PICKUP' ? 'Pick' : 'Drop'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
