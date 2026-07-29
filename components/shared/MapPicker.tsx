'use client'

import { useEffect, useRef, useState } from 'react'
import { Map, MapMarker, MarkerContent, type MapRef } from '@/components/ui/map'

interface MapPickerProps {
  initialLat?: number
  initialLng?: number
  onConfirm: (address: string, lat: number, lng: number) => void
  onCancel: () => void
}

export function MapPicker({ initialLat, initialLng, onConfirm, onCancel }: MapPickerProps) {
  const mapRef = useRef<MapRef>(null)
  const [position, setPosition] = useState({
    lat: initialLat ?? -26.2041,
    lng: initialLng ?? 28.0473,
  })
  const [confirming, setConfirming] = useState(false)

  // If no initial position was given, center on the user's current location once available.
  useEffect(() => {
    if (initialLat != null || initialLng != null || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPosition(next)
        mapRef.current?.flyTo({ center: [next.lng, next.lat], zoom: 15 })
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [initialLat, initialLng])

  async function handleConfirm() {
    setConfirming(true)
    const { lat, lng } = position
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        { headers: { 'User-Agent': 'GETS/1.0' } },
      )
      const data = await res.json()
      onConfirm(data.display_name ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng)
    } catch {
      onConfirm(`${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="w-full h-64 rounded-xl overflow-hidden border border-[rgba(236,61,58,0.15)]">
        <Map ref={mapRef} center={[position.lng, position.lat]} zoom={15}>
          <MapMarker
            longitude={position.lng}
            latitude={position.lat}
            draggable
            onDragEnd={(lngLat) => setPosition({ lat: lngLat.lat, lng: lngLat.lng })}
          >
            <MarkerContent>
              <div className="w-8 h-8 rounded-full bg-[#c1272d] border-[3px] border-white shadow-lg flex items-center justify-center text-white text-sm font-bold">
                P
              </div>
            </MarkerContent>
          </MapMarker>
        </Map>
      </div>
      <p className="text-xs text-[#5A6474] text-center">
        Drag the pin to your exact location, then tap Confirm
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-11 border border-[rgba(236,61,58,0.15)] text-[#5A6474] font-medium rounded-xl text-sm hover:bg-[#F8F9FB]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirming}
          className="flex-1 h-11 bg-[#c1272d] text-white font-semibold rounded-xl text-sm hover:bg-[#c1272d]/90 disabled:opacity-60"
        >
          {confirming ? 'Confirming…' : 'Confirm pin location'}
        </button>
      </div>
    </div>
  )
}
