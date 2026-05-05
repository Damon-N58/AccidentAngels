import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AlertTriangle, Search } from 'lucide-react'

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:             'bg-[#0F6E56]/10 text-[#0F6E56]',
  PENDING_COMPLIANCE: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  SUSPENDED:          'bg-[#E24B4A]/10 text-[#E24B4A]',
  INACTIVE:           'bg-[#5A6474]/10 text-[#5A6474]',
}

export default async function AdminDriversPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q, status } = await searchParams

  let query = supabase
    .from('Driver')
    .select('*, user:User(*), association:Association(*), complianceDocs:ComplianceDocument(status)')
    .order('createdAt', { ascending: false })
    .limit(500)

  if (status) query = query.eq('status', status)

  const { data: allDrivers } = await query

  // Client-side filter for search (PostgREST ilike on relations requires joins — easier here)
  const drivers = (allDrivers ?? []).filter((d: any) => {
    if (!q) return true
    const ql = q.toLowerCase()
    return (
      d.user.name?.toLowerCase().includes(ql) ||
      d.user.phone?.includes(q) ||
      d.vehicleRegistration?.toLowerCase().includes(ql)
    )
  })

  const { count: pendingCount } = await supabase
    .from('ComplianceDocument')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'UNDER_REVIEW')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1923]">Drivers</h1>
          <p className="text-sm text-[#5A6474]">{drivers.length} result{drivers.length !== 1 ? 's' : ''}</p>
        </div>
        {(pendingCount ?? 0) > 0 && (
          <div className="flex items-center gap-2 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-sm font-medium text-[#0F1923]">{pendingCount} doc{pendingCount !== 1 ? 's' : ''} awaiting review</span>
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-6">
        <form className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A6474]" />
            <Input name="q" defaultValue={q ?? ''} placeholder="Search by name, phone, or registration…" className="pl-9 h-10" />
          </div>
        </form>
        <div className="flex gap-2">
          {['', 'ACTIVE', 'PENDING_COMPLIANCE', 'SUSPENDED'].map(s => (
            <Link
              key={s}
              href={s ? `/admin/drivers?status=${s}` : '/admin/drivers'}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                (status ?? '') === s
                  ? 'bg-[#1A3F7A] text-white'
                  : 'bg-white border border-[rgba(26,63,122,0.15)] text-[#5A6474] hover:border-[#1A3F7A]/30'
              }`}
            >
              {s || 'All'}
            </Link>
          ))}
        </div>
      </div>

      <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(26,63,122,0.08)]">
                {['Driver', 'Phone', 'Association', 'Vehicle', 'Docs', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-[#5A6474] px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 && (
                <tr><td colSpan={7} className="text-center text-[#5A6474] py-12 text-sm">No drivers found</td></tr>
              )}
              {drivers.map((d: any) => {
                const approved = (d.complianceDocs ?? []).filter((c: any) => c.status === 'APPROVED').length
                const review   = (d.complianceDocs ?? []).filter((c: any) => c.status === 'UNDER_REVIEW').length
                return (
                  <tr key={d.id} className="border-b border-[rgba(26,63,122,0.05)] hover:bg-[#F8F9FB]">
                    <td className="px-4 py-3 font-medium text-[#0F1923]">{d.user.name || '—'}</td>
                    <td className="px-4 py-3 text-[#5A6474]">{d.user.phone}</td>
                    <td className="px-4 py-3 text-[#5A6474]">{d.association?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-[#5A6474]">{d.vehicleRegistration ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-[#0F6E56]">{approved}/6 approved</span>
                      {review > 0 && <span className="ml-1.5 text-xs text-[#F59E0B]">· {review} pending</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[d.status] ?? ''}`}>
                        {d.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/drivers/${d.id}`} className="text-xs font-semibold text-[#1A3F7A] hover:underline">
                        Review →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
