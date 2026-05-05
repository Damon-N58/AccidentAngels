'use client'

import { useState, useRef, lazy, Suspense } from 'react'

interface AddressPickerProps {
  label: string
  placeholder?: string
  value: string
  lat?: number | null
  lng?: number | null
  onChange: (address: string, lat: number, lng: number) => void
  geocodeOnBlur?: boolean
}

const MapPicker = lazy(() => import('./MapPicker').then(m => ({ default: m.MapPicker })))

// Nominatim rate limit: 1 req/sec. This queue serializes searches globally.
let nominatimQueue = Promise.resolve()
function rateLimitedFetch(url: string): Promise<any> {
  const result = nominatimQueue.then(() =>
    new Promise<any>((resolve) => {
      setTimeout(async () => {
        try {
          const res = await fetch(url, { headers: { 'User-Agent': 'AccidentAngels/1.0' } })
          resolve(res.ok ? res.json() : [])
        } catch {
          resolve([])
        }
      }, 1100)
    })
  )
  nominatimQueue = result.then(() => {}) as any
  return result
}

export function AddressPicker({ label, placeholder, value, lat, lng, onChange, geocodeOnBlur = true }: AddressPickerProps) {
  const [search, setSearch] = useState(value || '')
  const [results, setResults] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [searchedOnce, setSearchedOnce] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [selectedFromList, setSelectedFromList] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function geocodeText(text: string): Promise<boolean> {
    setGeocoding(true)
    try {
      const data = await rateLimitedFetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text + ', South Africa')}&limit=1&addressdetails=1`
      )
      if (data && data.length > 0) {
        const r = data[0]
        onChange(r.display_name, parseFloat(r.lat), parseFloat(r.lon))
        setSearch(r.display_name)
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setGeocoding(false)
    }
  }

  async function handleSearch(query: string) {
    setSearch(query)
    setSelectedFromList(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 3) {
      setResults([])
      setSearchedOnce(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const data = await rateLimitedFetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', South Africa')}&limit=5&addressdetails=1`
      )
      setResults(data ?? [])
      setSearchedOnce(true)
      setSearching(false)
    }, 600)
  }

  function selectResult(r: { display_name: string; lat: string; lon: string }) {
    const latNum = parseFloat(r.lat)
    const lngNum = parseFloat(r.lon)
    setSearch(r.display_name)
    setResults([])
    setSelectedFromList(true)
    onChange(r.display_name, latNum, lngNum)
    setShowMap(false)
    inputRef.current?.blur()
  }

  async function selectFreeText() {
    if (!search.trim() || search === value) return
    const ok = await geocodeText(search)
    if (!ok) {
      // If geocoding fails too, let the map handle it
      setResults([])
      return
    }
    setResults([])
  }

  const hasValidCoords = lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[#5A6474]">{label}</p>

      {!showMap ? (
        <>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder ?? 'Search address or drop a pin'}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              autoComplete="off"
              className="w-full h-11 text-sm border border-[rgba(26,63,122,0.15)] rounded-xl px-3 outline-none focus:border-[#1A3F7A] bg-white"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#5A6474]">Searching…</span>
            )}
            {geocoding && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#5A6474]">Finding location…</span>
            )}
          </div>

          {results.length > 0 && (
            <div className="bg-white border border-[rgba(26,63,122,0.2)] rounded-xl overflow-hidden shadow-lg max-h-56 overflow-y-auto relative z-20">
              {results.map((r, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => { e.preventDefault(); selectResult(r) }}
                  className="w-full text-left px-3 py-3 text-sm text-[#0F1923] hover:bg-[#F0F2F5] border-b border-[rgba(26,63,122,0.06)] last:border-0 transition-colors"
                >
                  {r.display_name.split(', ').slice(0, 3).join(', ')}
                </button>
              ))}
              {search.trim().length >= 3 && (
                <button
                  onMouseDown={(e) => { e.preventDefault(); selectFreeText() }}
                  className="w-full text-left px-3 py-3 text-sm font-medium text-[#1A3F7A] hover:bg-[#F0F2F5] border-t border-[rgba(26,63,122,0.08)]"
                >
                  Use &ldquo;{search}&rdquo;
                </button>
              )}
            </div>
          )}

          {searchedOnce && results.length === 0 && search.trim().length >= 3 && (
            <div className="bg-[#F8F9FB] rounded-xl px-3 py-2.5 text-xs text-[#5A6474] text-center">
              No matching addresses. Try adding a suburb/city, or drop a pin on the map.
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="w-full h-10 text-xs font-medium text-[#1A3F7A] border border-dashed border-[rgba(26,63,122,0.25)] rounded-xl hover:bg-[#1A3F7A]/05 transition-colors"
          >
            Drop a pin on the map instead
          </button>

          {value && (
            <div className={`flex items-start gap-2 rounded-xl p-2.5 ${
              hasValidCoords ? 'bg-[#0F6E56]/08' : 'bg-[#F59E0B]/10'
            }`}>
              <span className={`text-xs leading-relaxed line-clamp-2 font-medium ${
                hasValidCoords ? 'text-[#0F6E56]' : 'text-[#F59E0B]'
              }`}>{value}</span>
              {!hasValidCoords && (
                <span className="text-[10px] text-[#F59E0B] shrink-0 mt-0.5 font-medium">Pin required</span>
              )}
            </div>
          )}
        </>
      ) : (
        <Suspense fallback={<div className="w-full h-64 rounded-xl bg-[#E8EAED] animate-pulse flex items-center justify-center text-xs text-[#5A6474]">Loading map…</div>}>
          <MapPicker
            initialLat={lat ?? undefined}
            initialLng={lng ?? undefined}
            onConfirm={handleMapConfirm}
            onCancel={() => setShowMap(false)}
          />
        </Suspense>
      )}
    </div>
  )

  function handleMapConfirm(address: string, lat: number, lng: number) {
    setSearch(address)
    setSelectedFromList(true)
    onChange(address, lat, lng)
    setShowMap(false)
  }
}
