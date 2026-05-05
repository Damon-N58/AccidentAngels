'use client'

import { useEffect, useRef, useState } from 'react'
import type { TripStopData } from '@/lib/trips/types'

interface TripMapProps {
  stops: TripStopData[]
  tripStatus: string
}

export function TripMap({ stops, tripStatus }: TripMapProps) {
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
      await import('leaflet/dist/leaflet.css')

      const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png'
      const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png'
      const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

      // Custom icons for pickup vs dropoff
      const pickupIcon = L.divIcon({
        className: '',
        html: `<div style="width:32px;height:32px;border-radius:50%;background:#1A3F7A;color:white;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">P</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      const dropoffIcon = L.divIcon({
        className: '',
        html: `<div style="width:32px;height:32px;border-radius:50%;background:#0F6E56;color:white;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">D</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      const completedIcon = L.divIcon({
        className: '',
        html: `<div style="width:32px;height:32px;border-radius:50%;background:#0F6E56;color:white;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">✓</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      const missedIcon = L.divIcon({
        className: '',
        html: `<div style="width:32px;height:32px;border-radius:50%;background:#E24B4A;color:white;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">✕</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

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

        let icon = stop.type === 'PICKUP' ? pickupIcon : dropoffIcon
        if (stop.status === 'COMPLETED') icon = completedIcon
        else if (stop.status === 'MISSED') icon = missedIcon

        const label = `${stop.child?.name ?? 'Child'} – ${stop.type === 'PICKUP' ? 'Pickup' : 'Dropoff'}`
        L.marker(latLng, { icon })
          .bindPopup(`<b>${label}</b><br/>${stop.address ?? ''}`)
          .addTo(featureGroup)
      })

      // Draw route polyline
      if (latLngs.length >= 2) {
        const routeColor = tripStatus === 'IN_PROGRESS' ? '#1A3F7A' : tripStatus === 'COMPLETED' ? '#0F6E56' : '#5A6474'
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
            html: '<div style="background:#F5A623;color:#0F1923;font-size:10px;font-weight:bold;padding:2px 6px;border-radius:4px;border:1px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);white-space:nowrap;">START</div>',
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
    <div className="rounded-2xl overflow-hidden border border-[rgba(26,63,122,0.10)] shadow-sm">
      <div ref={mapRef} className="w-full h-64" />
      <div className="flex items-center gap-4 px-3 py-2 bg-white text-xs text-[#5A6474] border-t border-[rgba(26,63,122,0.06)]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#1A3F7A] inline-block" /> Pickup
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#0F6E56] inline-block" /> Dropoff
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#4285F4] border border-white shadow-sm inline-block" /> Your location
        </span>
      </div>
    </div>
  )
}
