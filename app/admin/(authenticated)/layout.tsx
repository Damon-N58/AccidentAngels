import Link from 'next/link'
import { LayoutDashboard, Users, Building2, CreditCard, ShieldCheck, Settings, Flag } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { Logo } from '@/components/ui/Logo'

const NAV = [
  { href: '/admin/dashboard',      label: 'Dashboard',     Icon: LayoutDashboard },
  { href: '/admin/drivers',        label: 'Drivers',       Icon: ShieldCheck },
  { href: '/admin/associations',   label: 'Associations',  Icon: Building2 },
  { href: '/admin/payments',       label: 'Payments',      Icon: CreditCard },
  { href: '/admin/reports',        label: 'Reports',       Icon: Flag },
  { href: '/admin/settings',       label: 'Settings',      Icon: Settings },
]

export default async function AdminAuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()

  return (
    <div className="flex min-h-screen bg-[#F8F9FB]">
      {/* Sidebar */}
      <aside className="w-60 bg-[#1A3F7A] flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-white/10">
          <Logo size={32} className="rounded-lg object-contain bg-white p-0.5" />
          <div>
            <p className="text-white font-bold text-sm leading-tight">Accident Angels</p>
            <p className="text-white/50 text-xs">Admin</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 space-y-2">
          <p className="text-white/40 text-xs truncate">{session.role.toLowerCase()} · {session.userId.slice(0, 8)}</p>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="text-xs text-white/50 hover:text-white/80 transition-colors">Sign out</button>
          </form>
        </div>
      </aside>
      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
