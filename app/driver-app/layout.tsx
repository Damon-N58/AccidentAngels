'use client'

import { usePathname } from 'next/navigation'
import { DriverBottomNav } from '@/components/driver/DriverBottomNav'

const NO_NAV = ['/login', '/verify', '/onboarding']

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showNav = !NO_NAV.some(p => pathname.endsWith(p))

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FB]">
      <main className={showNav ? 'flex-1 pb-[72px]' : 'flex-1'}>
        {children}
      </main>
      {showNav && <DriverBottomNav />}
    </div>
  )
}
