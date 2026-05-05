interface ParentTopBarProps {
  title?: string
  showLogo?: boolean
  showBack?: boolean
  rightSlot?: React.ReactNode
}

export function ParentTopBar({ title, showLogo = false, showBack, rightSlot }: ParentTopBarProps) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[rgba(26,63,122,0.08)] px-4 pt-safe">
      <div className="flex items-center justify-between h-14">
        {showLogo ? (
          <div className="flex items-center gap-2">
            <img src="/logos/wings-icon.svg" alt="Angels" className="w-7 h-7" />
            <span className="font-bold text-[#1A3F7A] text-base tracking-tight">Angels</span>
          </div>
        ) : (
          <h1 className="font-semibold text-base text-[#0F1923]">{title}</h1>
        )}
        {rightSlot && <div>{rightSlot}</div>}
      </div>
    </header>
  )
}
