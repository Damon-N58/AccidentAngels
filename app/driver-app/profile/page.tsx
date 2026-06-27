import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { DriverTopBar } from '@/components/driver/DriverTopBar'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { User, Car, Building2, LogOut } from 'lucide-react'

export default async function DriverProfilePage() {
  const cookieStore = await cookies()
  const session = await getSession(cookieStore.toString())
  if (!session) redirect('/driver-app/login')

  const { data: user } = await supabase.from('User').select('*').eq('id', session.userId).maybeSingle()
  const { data: driver } = await supabase
    .from('Driver')
    .select('*, association:Association(*)')
    .eq('userId', session.userId)
    .maybeSingle()

  if (!user || !driver) redirect('/driver-app/onboarding')

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar title="Profile" />
      <div className="px-4 py-4 space-y-4">
        <div className="flex flex-col items-center py-6">
          <div className="w-20 h-20 rounded-full bg-[#1A3F7A]/10 flex items-center justify-center mb-3">
            {driver.profilePhotoUrl ? (
              <img src={driver.profilePhotoUrl} alt={user.name} className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <User className="w-9 h-9 text-[#1A3F7A]" />
            )}
          </div>
          <h2 className="text-lg font-bold text-[#0F1923]">{user.name}</h2>
          <p className="text-sm text-[#5A6474]">{user.phone}</p>
          {driver.getsRegistrationNumber && (
            <span className="mt-1 text-xs bg-[#1A3F7A]/10 text-[#1A3F7A] px-2 py-0.5 rounded-full font-medium">
              GETS: {driver.getsRegistrationNumber}
            </span>
          )}
        </div>

        <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Car className="w-4 h-4 text-[#1A3F7A]" />
              <span className="font-semibold text-sm text-[#0F1923]">Vehicle</span>
            </div>
            <Separator className="mb-3" />
            <div className="space-y-2">
              {[
                ['Make / Model', [driver.vehicleMake, driver.vehicleModel].filter(Boolean).join(' ') || '—'],
                ['Year', driver.vehicleYear?.toString() || '—'],
                ['Registration', driver.vehicleRegistration || '—'],
                ['Colour', driver.vehicleColour || '—'],
                ['Capacity', driver.vehicleCapacity ? `${driver.vehicleCapacity} passengers` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-[#5A6474]">{label}</span>
                  <span className="font-medium text-[#0F1923]">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {driver.association && (
          <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-[#1A3F7A]" />
                <span className="font-semibold text-sm text-[#0F1923]">Association</span>
              </div>
              <Separator className="mb-3" />
              <div className="space-y-2">
                {[
                  ['Name', driver.association.name],
                  ['Region', driver.association.region],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[#5A6474]">{label}</span>
                    <span className="font-medium text-[#0F1923]">{val}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <form action="/api/auth/signout" method="POST">
          <Button type="submit" variant="outline" className="w-full h-12 text-[#E24B4A] border-[#E24B4A]/30 hover:bg-[#E24B4A]/5">
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </form>
      </div>
    </div>
  )
}
