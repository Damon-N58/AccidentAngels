import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, ShieldCheck, FileText } from 'lucide-react'

export default async function AdminDashboardPage() {
  const [
    { count: totalDrivers },
    { count: activeDrivers },
    { count: totalChildren },
    { count: totalContracts },
    { count: pendingReview },
  ] = await Promise.all([
    supabase.from('Driver').select('*', { count: 'exact', head: true }),
    supabase.from('Driver').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    supabase.from('Child').select('*', { count: 'exact', head: true }).eq('isActive', true),
    supabase.from('Contract').select('*', { count: 'exact', head: true }).eq('status', 'FULLY_SIGNED'),
    supabase.from('ComplianceDocument').select('*', { count: 'exact', head: true }).eq('status', 'UNDER_REVIEW'),
  ])

  const { data: recentDrivers } = await supabase
    .from('Driver')
    .select('*, user:User(*), association:Association(*)')
    .order('createdAt', { ascending: false })
    .limit(10)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F1923]">Dashboard</h1>
        <p className="text-[#5A6474] text-sm">Platform overview</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total drivers',      value: totalDrivers ?? 0,   icon: <Users className="w-5 h-5 text-[#ec3d3a]" /> },
          { label: 'Active / compliant', value: activeDrivers ?? 0,  icon: <ShieldCheck className="w-5 h-5 text-[#0F6E56]" /> },
          { label: 'Children enrolled',  value: totalChildren ?? 0,  icon: <Users className="w-5 h-5 text-[#fdc73e]" /> },
          { label: 'Active contracts',   value: totalContracts ?? 0, icon: <FileText className="w-5 h-5 text-[#ec3d3a]" /> },
        ].map(({ label, value, icon }) => (
          <Card key={label} className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">{icon}<span /></div>
              <p className="text-3xl font-bold text-[#0F1923]">{value}</p>
              <p className="text-xs text-[#5A6474]">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(pendingReview ?? 0) > 0 && (
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-3 mb-6 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[#F59E0B]" />
          <p className="text-sm font-medium text-[#0F1923]">
            {pendingReview} compliance document{pendingReview !== 1 ? 's' : ''} awaiting review
          </p>
          <a href="/admin/drivers" className="text-sm font-semibold text-[#ec3d3a] ml-auto">Review →</a>
        </div>
      )}

      <Card className="rounded-2xl border-[rgba(236,61,58,0.10)] shadow-none">
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold text-[#0F1923]">Recent drivers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(236,61,58,0.08)]">
                {['Name', 'Association', 'Status', 'Joined'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-[#5A6474] px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(recentDrivers ?? []).map((d: any) => (
                <tr key={d.id} className="border-b border-[rgba(236,61,58,0.05)] hover:bg-[#F8F9FB]">
                  <td className="px-4 py-3">
                    <a href={`/admin/drivers/${d.id}`} className="font-medium text-[#ec3d3a] hover:underline">{d.user.name}</a>
                    <p className="text-xs text-[#5A6474]">{d.user.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-[#5A6474]">{d.association?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      d.status === 'ACTIVE' ? 'bg-[#0F6E56]/10 text-[#0F6E56]' :
                      d.status === 'SUSPENDED' ? 'bg-[#E24B4A]/10 text-[#E24B4A]' :
                      'bg-[#F59E0B]/10 text-[#F59E0B]'
                    }`}>{d.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-[#5A6474]">{new Date(d.createdAt).toLocaleDateString('en-ZA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
