'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface Notification {
  id: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

/** Returns a simple relative-time string (e.g. "2 hours ago") */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/**
 * Self-contained notification bell. Works for any logged-in user —
 * the /api/notifications endpoint scopes results by session cookie.
 * Can be rendered by either a server or client parent component.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // silently ignore — bell badge just stays at 0
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      // Optimistically update locally, then refresh for accuracy
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      // fallback: refresh from server
      fetchNotifications()
    }
  }

  /** Badge label capped at "9+" */
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Bell button with unread badge */}
      <button
        onClick={() => setOpen(true)}
        className="relative p-1.5 rounded-full hover:bg-black/10 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-[#E24B4A] text-white text-[9px] font-bold flex items-center justify-center leading-none"
            aria-label={`${unreadCount} unread notifications`}
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {/* Slide-in sheet from the right */}
      <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col">
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-[rgba(236,61,58,0.10)]">
          <SheetTitle className="text-[#0F1923] font-bold text-base">
            Notifications
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-[#5A6474]">No notifications</p>
            </div>
          ) : (
            <ul className="divide-y divide-[rgba(236,61,58,0.08)]">
              {notifications.map(n => (
                <li
                  key={n.id}
                  onClick={() => !n.isRead && handleMarkRead(n.id)}
                  className={`px-4 py-3.5 cursor-pointer transition-colors ${
                    n.isRead
                      ? 'bg-white hover:bg-[#F8F9FB]'
                      : 'bg-[#ec3d3a]/[0.06] border-l-2 border-l-[#ec3d3a] hover:bg-[#ec3d3a]/[0.10]'
                  }`}
                >
                  <p className="text-sm font-semibold text-[#0F1923] leading-snug">
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-[#5A6474] mt-0.5 leading-relaxed">
                      {n.body}
                    </p>
                  )}
                  <p className="text-[10px] text-[#5A6474]/70 mt-1">
                    {relativeTime(n.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
