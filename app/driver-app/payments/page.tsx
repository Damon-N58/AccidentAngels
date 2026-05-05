import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { DriverTopBar } from '@/components/driver/DriverTopBar'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatZAR } from '@/lib/utils/cents'
import { decrypt } from '@/lib/auth/encryption'
import { CreditCard, Building2, TrendingUp } from 'lucide-react'

export default async function DriverPaymentsPage() {
  const cookieStore = await cookies()
  const session = await getSession(cookieStore.toString())
  if (!session) redirect('/login')

  const { data: driver } = await supabase.from('Driver').select('*').eq('userId', session.userId).maybeSingle()
  if (!driver) redirect('/onboarding')

  const { data: children } = await supabase
    .from('Child').select('id, name, monthlyFee').eq('driverId', driver.id).eq('isActive', true)

  // Batch check contracts for all children at once
  const childIds = (children ?? []).map((c: any) => c.id)
  const { data: signedContracts } = childIds.length > 0
    ? await supabase
        .from('Contract')
        .select('childId')
        .in('childId', childIds)
        .eq('status', 'FULLY_SIGNED')
    : { data: [] }

  const signedChildIds = new Set((signedContracts ?? []).map((c: any) => c.childId))
  const activeChildren = (children ?? []).filter((c: any) => signedChildIds.has(c.id))

  const totalGross = activeChildren.reduce((sum: number, c: any) => sum + (c.monthlyFee ?? 0), 0)

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar title="Payments" />
      <div className="px-4 py-4 space-y-4">
        <div className="bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-xl p-3">
          <p className="text-sm text-[#0F1923] font-medium">Payments not yet live</p>
          <p className="text-xs text-[#5A6474] mt-0.5">Your earnings below are a preview. Actual payouts will begin once payments go live.</p>
        </div>

        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-[#1A3F7A]" />
              <span className="font-semibold text-sm text-[#0F1923]">Banking details (for payouts)</span>
            </div>
            <Separator className="mb-3" />
            {driver.bankName ? (
              <div className="space-y-2">
                {(() => {
                  let accountName = driver.bankAccountName || '—'
                  let branchCode = driver.bankBranchCode || '—'
                  let maskedNumber = '—'
                  try {
                    if (driver.bankAccountName && driver.bankAccountName.includes(':')) accountName = decrypt(driver.bankAccountName)
                    if (driver.bankBranchCode && driver.bankBranchCode.includes(':')) branchCode = decrypt(driver.bankBranchCode)
                    if (driver.bankAccountNumber && driver.bankAccountNumber.includes(':')) {
                      const decrypted = decrypt(driver.bankAccountNumber)
                      maskedNumber = `****${decrypted.slice(-4)}`
                    } else if (driver.bankAccountNumber) {
                      maskedNumber = `****${driver.bankAccountNumber.slice(-4)}`
                    }
                  } catch { /* show raw values if decryption fails */ }
                  return ([
                    ['Bank', driver.bankName],
                    ['Account name', accountName],
                    ['Account number', maskedNumber],
                    ['Branch code', branchCode],
                  ] as [string, string][]).map(([label, val]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-[#5A6474]">{label}</span>
                      <span className="font-medium text-[#0F1923]">{val}</span>
                    </div>
                  ))
                })()}
              </div>
            ) : (
              <p className="text-sm text-[#5A6474]">No banking details on file. Go to Profile to update.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#1A3F7A]" />
              <span className="font-semibold text-sm text-[#0F1923]">Earnings preview</span>
            </div>
            <Separator className="mb-3" />
            {activeChildren.length === 0 ? (
              <p className="text-sm text-[#5A6474]">No active contracts yet.</p>
            ) : (
              <>
                <div className="space-y-2 mb-3">
                  {activeChildren.map((c: any) => (
                    <div key={c.id} className="flex justify-between text-sm">
                      <span className="text-[#5A6474] truncate max-w-[60%]">{c.name}</span>
                      <span className="font-medium">{c.monthlyFee ? formatZAR(c.monthlyFee) : '—'}</span>
                    </div>
                  ))}
                </div>
                <Separator className="mb-3" />
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-[#0F1923]">Gross total</span>
                  <span className="text-[#1A3F7A]">{formatZAR(totalGross)}</span>
                </div>
                <p className="text-xs text-[#5A6474] mt-3 italic">Fee splits will be confirmed before payments go live.</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardContent className="p-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#5A6474]" />
            <p className="text-sm text-[#5A6474]">Your first payout will appear here once payments go live.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
