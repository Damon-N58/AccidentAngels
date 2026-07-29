'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, User, CreditCard, Navigation } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/parent-app/dashboard', label: 'Home',      Icon: Home,       phase2: false },
  { href: '/parent-app/driver',    label: 'My Driver',  Icon: User,       phase2: false },
  { href: '/parent-app/payments',  label: 'Payments',   Icon: CreditCard, phase2: false },
  { href: '/parent-app/trips',     label: 'Trips',      Icon: Navigation, phase2: false },
]

export function ParentBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[rgba(236,61,58,0.08)] pb-safe">
      <div className="flex">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] gap-0.5 transition-colors',
                active ? 'text-[#fdc73e]' : 'text-[#5A6474]'
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
              <span className={cn('text-[10px] font-medium', active && 'font-semibold')}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
