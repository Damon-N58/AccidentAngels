'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { AddressPicker } from '@/components/shared/AddressPicker'
import { MapPin } from 'lucide-react'

interface BaseLocationCardProps {
  initialAddress: string | null
  initialLat: number | null
  initialLng: number | null
}

export function BaseLocationCard({ initialAddress, initialLat, initialLng }: BaseLocationCardProps) {
  const [display, setDisplay] = useState({
    address: initialAddress ?? '', lat: initialLat, lng: initialLng,
  })
  const [draft, setDraft] = useState(display)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (draft.lat == null || draft.lng == null || !draft.address.trim()) {
      toast.error('Please pick a location first')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/driver/base-location', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: draft.address, lat: draft.lat, lng: draft.lng }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      setDisplay(draft)
      setEditing(false)
      toast.success('Start location updated')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#ec3d3a]" />
            <span className="font-semibold text-sm text-[#0F1923]">Start location</span>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => { setDraft(display); setEditing(true) }}
              className="text-xs font-medium text-[#ec3d3a] hover:underline"
            >
              Edit
            </button>
          )}
        </div>
        <Separator className="mb-3" />

        {editing ? (
          <div className="space-y-3">
            <AddressPicker
              label="Where does your day start?"
              placeholder="Search your home or depot address"
              value={draft.address}
              lat={draft.lat}
              lng={draft.lng}
              onChange={(address, lat, lng) => setDraft({ address, lat, lng })}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 h-10 bg-[#ec3d3a] text-white hover:bg-[#ec3d3a]/90"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#0F1923]">
            {display.address || <span className="text-[#5A6474]">Not set — used to plan your first stop</span>}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
