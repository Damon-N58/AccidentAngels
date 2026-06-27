'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Flag, ChevronDown, ChevronUp } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type ReportStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED'
type ReportCategory = 'UNSAFE_VEHICLE' | 'UNSAFE_BEHAVIOUR' | 'OTHER'

interface Report {
  id: string
  category: ReportCategory
  description: string
  status: ReportStatus
  adminNotes: string | null
  createdAt: string
  parent: { name: string; phone: string }
  driver: { user: { name: string } }
}

// ── Static maps ────────────────────────────────────────────────────────────────

const CATEGORY_BADGE: Record<ReportCategory, string> = {
  UNSAFE_VEHICLE:   'bg-[#F59E0B]/10 text-[#F59E0B]',
  UNSAFE_BEHAVIOUR: 'bg-[#E24B4A]/10 text-[#E24B4A]',
  OTHER:            'bg-[#5A6474]/10 text-[#5A6474]',
}

const CATEGORY_LABEL: Record<ReportCategory, string> = {
  UNSAFE_VEHICLE:   'Unsafe Vehicle',
  UNSAFE_BEHAVIOUR: 'Unsafe Behaviour',
  OTHER:            'Other',
}

const STATUS_BADGE: Record<ReportStatus, string> = {
  OPEN:         'bg-[#E24B4A]/10 text-[#E24B4A]',
  UNDER_REVIEW: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  RESOLVED:     'bg-[#0F6E56]/10 text-[#0F6E56]',
  DISMISSED:    'bg-[#5A6474]/10 text-[#5A6474]',
}

// Filter tabs: label → query param value (empty string = no filter = All)
const TABS: { label: string; value: string }[] = [
  { label: 'All',          value: '' },
  { label: 'Open',         value: 'OPEN' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Resolved',     value: 'RESOLVED' },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const [activeTab, setActiveTab]     = useState('')           // matches TABS value
  const [reports, setReports]         = useState<Report[]>([])
  const [loading, setLoading]         = useState(true)
  // expandedId: which report card has the inline review panel open
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  // Per-report inline edit state
  const [editStatus, setEditStatus]   = useState<Record<string, ReportStatus>>({})
  const [editNotes, setEditNotes]     = useState<Record<string, string>>({})
  const [saving, setSaving]           = useState<string | null>(null)

  // Fetch whenever the active tab changes
  useEffect(() => {
    fetchReports(activeTab)
  }, [activeTab])

  async function fetchReports(statusFilter: string) {
    setLoading(true)
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/admin/reports${qs}`)
      if (!res.ok) throw new Error('Fetch failed')
      const data = await res.json()
      setReports(Array.isArray(data) ? data : (data.reports ?? []))
    } catch {
      toast.error('Failed to load reports')
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  function toggleExpand(id: string, report: Report) {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    // Pre-populate edit fields with current values so admins can just change what they want
    setEditStatus(prev => ({ ...prev, [id]: report.status }))
    setEditNotes(prev => ({ ...prev, [id]: report.adminNotes ?? '' }))
  }

  async function handleSave(id: string) {
    setSaving(id)
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status:     editStatus[id],
          adminNotes: editNotes[id] ?? '',
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Report updated')
      setExpandedId(null)
      fetchReports(activeTab) // refresh list
    } catch {
      toast.error('Failed to update report')
    } finally {
      setSaving(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Page header */}
      <div className="flex items-center gap-3 mb-1">
        <Flag className="w-5 h-5 text-[#1A3F7A]" />
        <h1 className="text-2xl font-bold text-[#0F1923]">Safety Reports</h1>
      </div>
      <p className="text-sm text-[#5A6474] mb-6">Parent-filed safety concerns</p>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-[#1A3F7A] text-white'
                : 'bg-white border border-[rgba(26,63,122,0.15)] text-[#5A6474] hover:border-[#1A3F7A]/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <p className="text-sm text-[#5A6474]">Loading…</p>
      )}

      {/* Empty state */}
      {!loading && reports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-[#5A6474]">
          <Flag className="w-8 h-8 mb-3 opacity-30" />
          <p className="text-sm">No reports</p>
        </div>
      )}

      {/* Report cards */}
      {!loading && reports.length > 0 && (
        <div className="space-y-4">
          {reports.map(report => {
            const isExpanded = expandedId === report.id
            const filed = new Date(report.createdAt).toLocaleDateString('en-ZA', {
              day: '2-digit', month: 'short', year: 'numeric',
            })

            return (
              <Card key={report.id} className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
                <CardContent className="p-5">

                  {/* Top row: category badge + status badge + date */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_BADGE[report.category]}`}>
                      {CATEGORY_LABEL[report.category]}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[report.status]}`}>
                      {report.status.replace(/_/g, ' ')}
                    </span>
                    <span className="ml-auto text-xs text-[#5A6474]">{filed}</span>
                  </div>

                  {/* Reporter + driver info */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-[#0F1923]">
                        {report.parent?.name || 'Unknown parent'}
                      </p>
                      <p className="text-xs text-[#5A6474]">{report.parent?.phone}</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-xs text-[#5A6474]">Driver</p>
                      <p className="text-sm font-medium text-[#0F1923]">
                        {report.driver?.user?.name || 'Unknown driver'}
                      </p>
                    </div>
                  </div>

                  {/* Description — clamped to 2 lines when collapsed */}
                  <p className={`text-sm text-[#5A6474] mb-4 ${isExpanded ? '' : 'line-clamp-2'}`}>
                    {report.description}
                  </p>

                  {/* Review toggle button */}
                  <button
                    onClick={() => toggleExpand(report.id, report)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A3F7A] hover:underline"
                  >
                    {isExpanded ? (
                      <><ChevronUp className="w-3.5 h-3.5" /> Close</>
                    ) : (
                      <><ChevronDown className="w-3.5 h-3.5" /> Review</>
                    )}
                  </button>

                  {/* ── Inline review panel ─────────────────────────────── */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-[rgba(26,63,122,0.08)] space-y-3">

                      {/* Full description (already unclamped above, but label helps) */}
                      <div>
                        <p className="text-xs font-semibold text-[#5A6474] mb-1">Full description</p>
                        <p className="text-sm text-[#0F1923]">{report.description}</p>
                      </div>

                      {/* Status select */}
                      <div>
                        <label className="text-xs font-semibold text-[#5A6474] block mb-1">
                          Status
                        </label>
                        <select
                          value={editStatus[report.id] ?? report.status}
                          onChange={e => setEditStatus(prev => ({
                            ...prev,
                            [report.id]: e.target.value as ReportStatus,
                          }))}
                          className="w-full text-sm border border-[rgba(26,63,122,0.20)] rounded-lg px-3 py-2 bg-white text-[#0F1923] focus:outline-none focus:ring-2 focus:ring-[#1A3F7A]/30"
                        >
                          <option value="OPEN">Open</option>
                          <option value="UNDER_REVIEW">Under Review</option>
                          <option value="RESOLVED">Resolved</option>
                          <option value="DISMISSED">Dismissed</option>
                        </select>
                      </div>

                      {/* Admin notes */}
                      <div>
                        <label className="text-xs font-semibold text-[#5A6474] block mb-1">
                          Admin notes
                        </label>
                        <Textarea
                          placeholder="Internal notes about this report…"
                          value={editNotes[report.id] ?? ''}
                          onChange={e => setEditNotes(prev => ({
                            ...prev,
                            [report.id]: e.target.value,
                          }))}
                          className="text-sm h-24 resize-none"
                        />
                      </div>

                      {/* Save button */}
                      <Button
                        size="sm"
                        disabled={saving === report.id}
                        onClick={() => handleSave(report.id)}
                        className="bg-[#1A3F7A] hover:bg-[#1A3F7A]/90 text-white h-9"
                      >
                        {saving === report.id ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  )}

                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
