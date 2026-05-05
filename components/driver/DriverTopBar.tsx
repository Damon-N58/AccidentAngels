interface DriverTopBarProps {
  title?: string
  showLogo?: boolean
  rightSlot?: React.ReactNode
}

export function DriverTopBar({ title, showLogo = false, rightSlot }: DriverTopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#1A3F7A] text-white px-4 pt-safe">
      <div className="flex items-center justify-between h-14">
        {showLogo ? (
          <div className="flex items-center gap-2">
            <img src="/logos/wings-icon.svg" alt="Accident Angels" className="w-7 h-7" />
            <span className="font-bold text-base tracking-tight">Angels Driver</span>
          </div>
        ) : (
          <h1 className="font-semibold text-base">{title}</h1>
        )}
        {rightSlot && <div>{rightSlot}</div>}
      </div>
    </header>
  )
}
