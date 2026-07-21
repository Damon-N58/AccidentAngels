import { ParentTopBar } from '@/components/parent/ParentTopBar'
import { MapPin, Lock } from 'lucide-react'

export default function TrackingPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <ParentTopBar title="Live Tracking" />
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-[#ec3d3a]/10 flex items-center justify-center mb-6 relative">
          <MapPin className="w-9 h-9 text-[#ec3d3a]/40" />
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#F59E0B] rounded-full flex items-center justify-center">
            <Lock className="w-3 h-3 text-white" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-[#0F1923] mb-2">Live tracking coming soon</h2>
        <p className="text-sm text-[#5A6474] max-w-xs">
          You&apos;ll be able to see exactly where your driver is in real time. We&apos;ll notify you when this feature launches.
        </p>
      </div>
    </div>
  )
}
