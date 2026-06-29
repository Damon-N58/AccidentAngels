'use client'

interface TimeWindowPickerProps {
  label: string
  earliest: string
  latest: string
  onChange: (earliest: string, latest: string) => void
}

export function TimeWindowPicker({ label, earliest, latest, onChange }: TimeWindowPickerProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-[#5A6474]">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={earliest}
          onChange={e => onChange(e.target.value, latest)}
          className="flex-1 h-9 text-sm border border-[rgba(236,61,58,0.15)] rounded-lg px-3 outline-none focus:border-[#ec3d3a]"
        />
        <span className="text-xs text-[#5A6474]">to</span>
        <input
          type="time"
          value={latest}
          onChange={e => onChange(earliest, e.target.value)}
          className="flex-1 h-9 text-sm border border-[rgba(236,61,58,0.15)] rounded-lg px-3 outline-none focus:border-[#ec3d3a]"
        />
      </div>
    </div>
  )
}
