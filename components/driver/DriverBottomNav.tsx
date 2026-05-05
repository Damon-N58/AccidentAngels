'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShieldCheck, Navigation, CreditCard, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/driver-app/dashboard',  label: 'Dashboard',  Icon: LayoutDashboard },
  { href: '/driver-app/compliance', label: 'Compliance',  Icon: ShieldCheck },
  { href: '/driver-app/trips',      label: 'Trips',       Icon: Navigation },
  { href: '/driver-app/payments',   label: 'Payments',    Icon: CreditCard },
  { href: '/driver-app/profile',    label: 'Profile',     Icon: User },
]

export function DriverBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[rgba(26,63,122,0.10)] pb-safe">
      <div className="flex">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] gap-0.5 transition-colors',
                active ? 'text-[#1A3F7A]' : 'text-[#5A6474]'
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
              <span className={cn('text-[10px] font-medium', active && 'font-semibold')}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
