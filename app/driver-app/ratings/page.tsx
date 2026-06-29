import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { DriverTopBar } from '@/components/driver/DriverTopBar'
import { HideCommentToggle } from '@/components/ratings/HideCommentToggle'
import { Star } from 'lucide-react'
import { format } from 'date-fns'

// Inline star row — renders filled (amber) / empty (grey) stars for a score 1–5
function InlineStars({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-6 h-6' : 'w-4 h-4'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cls}
          style={
            s <= Math.round(score)
              ? { fill: '#fdc73e', stroke: '#fdc73e' }
              : { fill: 'none', stroke: '#D1D5DB' }
          }
        />
      ))}
    </div>
  )
}

export default async function MyRatingsPage() {
  const cookieStore = await cookies()
  const session = await getSession(cookieStore.toString())
  if (!session) redirect('/driver-app/login')
  if (session.role !== 'DRIVER') redirect('/driver-app/login')

  const { data: driver } = await supabase
    .from('Driver')
    .select('id, ratingAvg, ratingCount')
    .eq('userId', session.userId)
    .maybeSingle()

  if (!driver) redirect('/driver-app/login')

  // Fetch ratings server-side — driver sees real comment even when hidden
  const { data: ratings } = await supabase
    .from('DriverRating')
    .select('id, score, comment, isHidden, createdAt')
    .eq('driverId', driver.id)
    .order('createdAt', { ascending: false })

  const ratingList = ratings ?? []

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar title="My Ratings" />

      <div className="px-4 pt-4 pb-8 space-y-4">

        {/* Aggregate banner */}
        <div className="bg-[#ec3d3a] rounded-2xl p-5 text-white text-center">
          <p className="text-5xl font-bold tracking-tight mb-1">
            {driver.ratingAvg != null ? Number(driver.ratingAvg).toFixed(1) : '—'}
          </p>
          <div className="flex justify-center mb-2">
            {driver.ratingAvg != null ? (
              // Inline stars for aggregate — filled up to ratingAvg (rounded)
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className="w-6 h-6"
                    style={
                      s <= Math.round(Number(driver.ratingAvg))
                        ? { fill: '#fdc73e', stroke: '#fdc73e' }
                        : { fill: 'none', stroke: 'rgba(255,255,255,0.4)' }
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-6 h-6" style={{ fill: 'none', stroke: 'rgba(255,255,255,0.4)' }} />
                ))}
              </div>
            )}
          </div>
          <p className="text-sm text-white/70">
            from {driver.ratingCount ?? 0} rating{(driver.ratingCount ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Empty state */}
        {ratingList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Star className="w-10 h-10 text-[#D1D5DB]" />
            <p className="text-sm text-[#5A6474] font-medium">No ratings yet</p>
          </div>
        )}

        {/* Rating cards */}
        {ratingList.map((r: any) => (
          <div
            key={r.id}
            className="bg-white rounded-2xl border border-[rgba(236,61,58,0.10)] p-4 space-y-2"
          >
            {/* Score row */}
            <div className="flex items-center justify-between gap-2">
              <InlineStars score={r.score} />
              <span className="text-xs text-[#5A6474]">
                {format(new Date(r.createdAt), 'd MMM yyyy')}
              </span>
            </div>

            {/* Comment block */}
            {r.comment ? (
              <div className={r.isHidden ? 'space-y-1' : ''}>
                {r.isHidden && (
                  <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#5A6474]/10 text-[#5A6474]">
                    Hidden from parents
                  </span>
                )}
                <p className={`text-sm leading-relaxed ${r.isHidden ? 'text-[#5A6474] italic' : 'text-[#0F1923]'}`}>
                  &ldquo;{r.comment}&rdquo;
                </p>
              </div>
            ) : (
              <p className="text-sm text-[#5A6474] italic">No comment</p>
            )}

            {/* Toggle — only shown when there's a comment to hide/show */}
            {r.comment && (
              <div className="pt-1">
                <HideCommentToggle
                  driverId={driver.id}
                  ratingId={r.id}
                  isHidden={r.isHidden}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
