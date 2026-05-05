'use client'

import { usePathname } from 'next/navigation'
import { ParentBottomNav } from '@/components/parent/ParentBottomNav'

const NO_NAV = ['/login', '/verify', '/onboarding', '/children/add']

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showNav = !NO_NAV.some(p => pathname.endsWith(p))

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FB]">
      <main className={showNav ? 'flex-1 pb-[72px]' : 'flex-1'}>
        {children}
      </main>
      {showNav && <ParentBottomNav />}
    </div>
  )
}
