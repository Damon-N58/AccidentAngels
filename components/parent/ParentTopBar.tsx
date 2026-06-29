import { Logo } from '@/components/ui/Logo'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { BackButton } from '@/components/shared/BackButton'

interface ParentTopBarProps {
  title?: string
  showLogo?: boolean
  showBack?: boolean
  rightSlot?: React.ReactNode
}

// Server component — NotificationBell (client component) renders fine here.
export function ParentTopBar({ title, showLogo = false, showBack, rightSlot }: ParentTopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[rgba(236,61,58,0.08)] px-4 pt-safe">
      <div className="flex items-center justify-between h-14">
        <div className="flex items-center gap-1.5 min-w-0">
          {showBack && <BackButton className="-ml-1 p-1 rounded-lg text-[#0F1923] hover:bg-[#0F1923]/[0.06]" />}
          {showLogo ? (
            <div className="flex items-center gap-2">
              <Logo size={32} className="rounded-lg object-contain bg-white p-0.5" />
              <span className="font-bold text-[#ec3d3a] text-base tracking-tight">GETS</span>
            </div>
          ) : (
            <h1 className="font-semibold text-base text-[#0F1923] truncate">{title}</h1>
          )}
        </div>

        {/* Right actions: consumer slot + notification bell (always present) */}
        <div className="flex items-center gap-2">
          {rightSlot && <div>{rightSlot}</div>}
          {/* Bell icon colour uses default dark text on the white parent bar */}
          <div className="[&_svg]:text-[#0F1923] [&_button]:hover:bg-[#0F1923]/[0.06]">
            <NotificationBell />
          </div>
        </div>
      </div>
    </header>
  )
}
