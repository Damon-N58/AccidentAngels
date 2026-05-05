'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertTriangle, CheckCircle2, Save } from 'lucide-react'

interface Config {
  key: string
  value: string
  description: string | null
}

const EDITABLE_KEYS = [
  'PAYMENTS_LIVE',
  'PLATFORM_FEE_CENTS',
  'TCC_SPLIT_CENTS',
  'RETRY_DAY_1',
  'RETRY_DAY_2',
  'DEBICHECK_ENABLED',
  'CAPITEC_VRP_ENABLED',
]

export default function AdminSettingsPage() {
  const [configs, setConfigs]   = useState<Config[]>([])
  const [values, setValues]     = useState<Record<string, string>>({})
  const [saving, setSaving]     = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/admin/config')
      .then(r => r.json())
      .then((data: Config[]) => {
        setConfigs(data)
        setValues(Object.fromEntries(data.map(c => [c.key, c.value])))
        setLoading(false)
      })
  }, [])

  async function save(key: string) {
    setSaving(key)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: values[key] }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${key} updated`)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(null)
    }
  }

  const paymentsLive = values['PAYMENTS_LIVE'] === 'true'

  if (loading) return <div className="p-6 text-sm text-[#5A6474]">Loading…</div>

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F1923]">Platform Settings</h1>
        <p className="text-sm text-[#5A6474]">Changes take effect immediately.</p>
      </div>

      {/* Payments live banner */}
      <div className={`rounded-xl p-4 flex items-start gap-3 ${
        paymentsLive
          ? 'bg-[#0F6E56]/10 border border-[#0F6E56]/30'
          : 'bg-[#F5A623]/10 border border-[#F5A623]/30'
      }`}>
        {paymentsLive
          ? <CheckCircle2 className="w-5 h-5 text-[#0F6E56] mt-0.5 shrink-0" />
          : <AlertTriangle className="w-5 h-5 text-[#F5A623] mt-0.5 shrink-0" />}
        <div>
          <p className="font-semibold text-sm text-[#0F1923]">
            {paymentsLive ? 'Payments are LIVE — parents are being charged' : 'Payments are OFF — no charges firing'}
          </p>
          <p className="text-xs text-[#5A6474] mt-0.5">
            {paymentsLive
              ? 'Set PAYMENTS_LIVE to false below to halt all billing immediately.'
              : 'Set PAYMENTS_LIVE to true when ready to begin billing parents.'}
          </p>
        </div>
      </div>

      {/* Config rows */}
      <Card className="rounded-2xl border-[rgba(26,63,122,0.10)] shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-[#0F1923]">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {configs
            .filter(c => EDITABLE_KEYS.includes(c.key))
            .map(config => (
              <div key={config.key} className="space-y-1.5">
                <Label className="text-sm font-semibold text-[#0F1923]">{config.key}</Label>
                {config.description && (
                  <p className="text-xs text-[#5A6474]">{config.description}</p>
                )}
                <div className="flex gap-2">
                  {config.key === 'PAYMENTS_LIVE' || config.key === 'DEBICHECK_ENABLED' || config.key === 'CAPITEC_VRP_ENABLED' ? (
                    <select
                      value={values[config.key] ?? 'false'}
                      onChange={e => setValues(prev => ({ ...prev, [config.key]: e.target.value }))}
                      className="flex-1 h-10 rounded-lg border border-[rgba(26,63,122,0.15)] bg-white px-3 text-sm text-[#0F1923]"
                    >
                      <option value="false">false</option>
                      <option value="true">true</option>
                    </select>
                  ) : (
                    <Input
                      value={values[config.key] ?? ''}
                      onChange={e => setValues(prev => ({ ...prev, [config.key]: e.target.value }))}
                      className="flex-1 h-10"
                    />
                  )}
                  <Button
                    size="sm"
                    onClick={() => save(config.key)}
                    disabled={saving === config.key}
                    className="h-10 bg-[#1A3F7A] text-white hover:bg-[#1A3F7A]/90"
                  >
                    <Save className="w-4 h-4 mr-1.5" />
                    Save
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  )
}
