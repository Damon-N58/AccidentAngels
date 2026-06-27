'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

interface MapPickerProps {
  initialLat?: number
  initialLng?: number
  onConfirm: (address: string, lat: number, lng: number) => void
  onCancel: () => void
}

export function MapPicker({ initialLat, initialLng, onConfirm, onCancel }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    mapInstanceRef.current = null
    markerRef.current = null

    const init = async () => {
      // Wait for the next animation frame so the container has layout
      await new Promise(r => requestAnimationFrame(r))

      if (!mapRef.current || cancelled) return
      const container = mapRef.current

      // Container must have non-zero dimensions
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        await new Promise(r => setTimeout(r, 100))
        if (!mapRef.current || cancelled) return
        if (mapRef.current.offsetWidth === 0 || mapRef.current.offsetHeight === 0) return
      }

      const L = await import('leaflet')

      if (cancelled || !mapRef.current) return

      // Wipe stale state
      mapRef.current.innerHTML = ''
      ;(mapRef.current as any)._leaflet_id = undefined

      const startLat = initialLat ?? -26.2041
      const startLng = initialLng ?? 28.0473

      const map = L.map(mapRef.current, {
        center: [startLat, startLng],
        zoom: 15,
        zoomControl: true,
      })

      map.invalidateSize()

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="
          width: 32px; height: 32px;
          background: #1A3F7A;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 2px #1A3F7A;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; color: white; font-weight: bold;
        ">P</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      const marker = L.marker([startLat, startLng], { draggable: true, icon: pinIcon }).addTo(map)
      markerRef.current = marker

      if (initialLat == null && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const c: [number, number] = [pos.coords.latitude, pos.coords.longitude]
            map.setView(c, 15)
            marker.setLatLng(c)
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000 }
        )
      }

      mapInstanceRef.current = map
      setReady(true)
    }

    init()

    return () => {
      cancelled = true
      try { mapInstanceRef.current?.remove() } catch {}
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [initialLat, initialLng])

  async function handleConfirm() {
    const pos = markerRef.current?.getLatLng()
    if (!pos) return

    const { lat, lng } = pos
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        { headers: { 'User-Agent': 'AccidentAngels/1.0' } }
      )
      const data = await res.json()
      onConfirm(data.display_name ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng)
    } catch {
      onConfirm(`${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng)
    }
  }

  return (
    <div className="space-y-3">
      <div
        ref={mapRef}
        className="w-full h-64 rounded-xl border border-[rgba(26,63,122,0.15)]"
        style={{ minHeight: '16rem' }}
      />
      {!ready && (
        <div className="text-xs text-[#5A6474] text-center">Initialising map…</div>
      )}
      <p className="text-xs text-[#5A6474] text-center">
        Drag the pin to your exact location, then tap Confirm
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-11 border border-[rgba(26,63,122,0.15)] text-[#5A6474] font-medium rounded-xl text-sm hover:bg-[#F8F9FB]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="flex-1 h-11 bg-[#1A3F7A] text-white font-semibold rounded-xl text-sm hover:bg-[#1A3F7A]/90"
        >
          Confirm pin location
        </button>
      </div>
    </div>
  )
}
