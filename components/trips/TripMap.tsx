'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { TripStopData } from '@/lib/trips/types'

interface TripMapProps {
  stops: TripStopData[]
  tripStatus: string
  isDriverView?: boolean
}

/** Returns the ring border style string based on paymentStatus. */
function paymentBorder(paymentStatus?: 'PAID' | 'OVERDUE'): string {
  if (paymentStatus === 'PAID') return '4px solid #22C55E'
  if (paymentStatus === 'OVERDUE') return '4px solid #EF4444'
  return '2px solid white'
}

export function TripMap({ stops, tripStatus, isDriverView = false }: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerLayerRef = useRef<any>(null)
  const userMarkerRef = useRef<any>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted || !mapRef.current || mapInstanceRef.current) return

    const init = async () => {
      const L = await import('leaflet')

      const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png'
      const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png'
      const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

      // Stop icons are built per-stop (see forEach below) to incorporate payment ring colour.

      // Determine center from first stop with coords, or default Joburg
      const firstCoord = stops.find(s => s.lat && s.lng)
      const center: [number, number] = firstCoord
        ? [firstCoord.lat!, firstCoord.lng!]
        : [-26.2041, 28.0473]

      const map = L.map(mapRef.current!, {
        center,
        zoom: 13,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map)

      const featureGroup = L.featureGroup().addTo(map)
      markerLayerRef.current = featureGroup

      // Add markers for each stop
      const latLngs: [number, number][] = []
      const bounds = L.latLngBounds(center, center)

      stops.forEach((stop) => {
        if (!stop.lat || !stop.lng) return
        const latLng: [number, number] = [stop.lat, stop.lng]
        latLngs.push(latLng)
        bounds.extend(latLng)

        // Fill colour = stop status/type; ring border = payment status
        const bg =
          stop.status === 'COMPLETED' ? '#0F6E56' :
          stop.status === 'MISSED'    ? '#E24B4A' :
          stop.type === 'PICKUP'      ? '#ec3d3a' : '#0F6E56'
        const glyph =
          stop.status === 'COMPLETED' ? '✓' :
          stop.status === 'MISSED'    ? '✕' :
          stop.type === 'PICKUP'      ? 'P' : 'D'
        const border = paymentBorder(stop.paymentStatus)

        const icon = L.divIcon({
          className: '',
          html: `<div style="width:32px;height:32px;border-radius:50%;background:${bg};color:white;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;border:${border};box-shadow:0 2px 6px rgba(0,0,0,0.3);">${glyph}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })

        const label = `${stop.child?.name ?? 'Child'} – ${stop.type === 'PICKUP' ? 'Pickup' : 'Dropoff'}`
        // Append overdue warning line for driver view
        const overdueHtml = stop.paymentStatus === 'OVERDUE'
          ? `<br/><span style="color:#EF4444;font-weight:600;font-size:11px;">Fees overdue</span>`
          : ''
        L.marker(latLng, { icon })
          .bindPopup(`<b>${label}</b><br/>${stop.address ?? ''}${overdueHtml}`)
          .addTo(featureGroup)
      })

      // Draw route polyline
      if (latLngs.length >= 2) {
        const routeColor = tripStatus === 'IN_PROGRESS' ? '#ec3d3a' : tripStatus === 'COMPLETED' ? '#0F6E56' : '#5A6474'
        L.polyline(latLngs, {
          color: routeColor,
          weight: 3,
          opacity: 0.7,
          dashArray: tripStatus === 'SCHEDULED' ? '10, 10' : undefined,
        }).addTo(featureGroup)

        // Add start/end labels
        const start = latLngs[0]
        const end = latLngs[latLngs.length - 1]
        L.marker(start, {
          icon: L.divIcon({
            className: '',
            html: '<div style="background:#fdc73e;color:#0F1923;font-size:10px;font-weight:bold;padding:2px 6px;border-radius:4px;border:1px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);white-space:nowrap;">START</div>',
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
          zIndexOffset: 1000,
        }).addTo(featureGroup)
      }

      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 })
      mapInstanceRef.current = map

      // Ge locate user
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const userLatLng: [number, number] = [pos.coords.latitude, pos.coords.longitude]
            const userIcon = L.divIcon({
              className: '',
              html: `<div style="width:20px;height:20px;border-radius:50%;background:#4285F4;border:3px solid white;box-shadow:0 0 0 2px #4285F4, 0 2px 6px rgba(0,0,0,0.3);"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })
            userMarkerRef.current = L.marker(userLatLng, { icon: userIcon })
              .bindPopup('<b>Your location</b>')
              .addTo(featureGroup)
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000 }
        )
      }
    }

    init()

    return () => {
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
      markerLayerRef.current = null
      userMarkerRef.current = null
    }
  }, [mounted, stops, tripStatus])

  if (!mounted) {
    return <div className="w-full h-64 rounded-xl bg-[#E8EAED] animate-pulse" />
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-[rgba(236,61,58,0.10)] shadow-sm">
      <div ref={mapRef} className="w-full h-64" />
      <div className="flex flex-wrap items-center gap-4 px-3 py-2 bg-white text-xs text-[#5A6474] border-t border-[rgba(236,61,58,0.06)]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#ec3d3a] inline-block" /> Pickup
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#0F6E56] inline-block" /> Dropoff
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#4285F4] border border-white shadow-sm inline-block" /> Your location
        </span>
        {/* Payment ring legend — only shown in driver view when at least one stop has paymentStatus */}
        {isDriverView && stops.some(s => s.paymentStatus) && (
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
