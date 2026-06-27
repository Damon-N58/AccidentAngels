'use client'

import { Logo } from '@/components/ui/Logo'
import { NotificationBell } from '@/components/shared/NotificationBell'

interface DriverTopBarProps {
  title?: string
  showLogo?: boolean
  rightSlot?: React.ReactNode
}

export function DriverTopBar({ title, showLogo = false, rightSlot }: DriverTopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#1A3F7A] text-white px-4 pt-safe">
      <div className="flex items-center justify-between h-14">
        {/* Left: logo or title */}
        {showLogo ? (
          <div className="flex items-center gap-2">
            <Logo size={32} className="rounded-lg object-contain bg-white p-0.5" />
            <span className="font-bold text-base tracking-tight">Angels Driver</span>
          </div>
        ) : (
          <h1 className="font-semibold text-base">{title}</h1>
        )}

        {/* Right: any consumer-provided slot + notification bell */}
        <div className="flex items-center gap-2">
          {rightSlot && <div>{rightSlot}</div>}
          {/* Bell icon colour overridden to white for the navy driver bar */}
          <div className="[&_button]:hover:bg-white/10 [&_svg]:text-white">
            <NotificationBell />
          </div>
        </div>
      </div>
    </header>
  )
}
