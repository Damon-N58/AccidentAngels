'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DriverTopBar } from '@/components/driver/DriverTopBar'
import { CameraUpload } from '@/components/shared/CameraUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'

const DOC_INSTRUCTIONS: Record<string, { label: string; instruction: string; requiresExpiry: boolean; requiresNumber: boolean }> = {
  PDP:                    { label: 'Professional Driving Permit', instruction: 'Take a clear photo of all 4 pages of your PDP. Make sure all text is legible.', requiresExpiry: true, requiresNumber: true },
  POLICE_CLEARANCE:       { label: 'Police Clearance Certificate', instruction: 'Upload your police clearance certificate. Must not be older than 6 months.', requiresExpiry: true, requiresNumber: true },
  PASSENGER_LIABILITY:    { label: 'Passenger Liability Insurance', instruction: 'Upload your current passenger liability insurance schedule.', requiresExpiry: true, requiresNumber: true },
  ROADWORTHY_CERTIFICATE: { label: 'Roadworthy Certificate', instruction: 'Upload your current roadworthy certificate.', requiresExpiry: true, requiresNumber: true },
  VEHICLE_PHOTOS:         { label: 'Vehicle Photos', instruction: 'Take clear photos of your vehicle from all 4 sides. Front, back, left, right.', requiresExpiry: false, requiresNumber: false },
  DRIVER_LICENSE:         { label: "Driver's License", instruction: "Take a clear photo of the front and back of your driver's license card.", requiresExpiry: true, requiresNumber: true },
}

export default function DocUploadPage({ params }: { params: Promise<{ docType: string }> }) {
  const { docType } = use(params)
  const router = useRouter()
  const cfg = DOC_INSTRUCTIONS[docType] ?? { label: docType, instruction: 'Upload your document.', requiresExpiry: false, requiresNumber: false }

  const [file, setFile] = useState<File | null>(null)
  const [docNumber, setDocNumber] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [uploading, setUploading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { toast.error('Please select a document'); return }

    setUploading(true)
    try {
      // Get presigned upload URL
      const urlRes = await fetch('/api/compliance/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType, fileName: file.name, mimeType: file.type, fileSize: file.size }),
      })
      const { url, path, docId } = await urlRes.json()
      if (!url) throw new Error('Failed to get upload URL')

      // Upload directly to Supabase Storage
      const uploadRes = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!uploadRes.ok) throw new Error('Upload failed')

      // Save metadata
      const saveRes = await fetch(`/api/compliance/${docId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, docNumber, issueDate, expiryDate }),
      })
      if (!saveRes.ok) throw new Error('Failed to save document')

      toast.success('Document uploaded. Under review.')
      router.push('/compliance')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <DriverTopBar
        title={cfg.label}
        rightSlot={
          <button onClick={() => router.back()} className="p-2">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        }
      />
      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-5">
        <div className="bg-[#1A3F7A]/05 rounded-xl p-3">
          <p className="text-sm text-[#0F1923]">{cfg.instruction}</p>
        </div>

        <CameraUpload
          onFile={setFile}
          disabled={uploading}
          label="Take Photo"
        />

        {cfg.requiresNumber && (
          <div className="space-y-2">
            <Label>Document number</Label>
            <Input value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="e.g. PDP-12345" className="h-12" />
          </div>
        )}

        {cfg.requiresExpiry && (
          <>
            <div className="space-y-2">
              <Label>Issue date</Label>
              <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="h-12" />
            </div>
            <div className="space-y-2">
              <Label>Expiry date</Label>
              <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="h-12" />
            </div>
          </>
        )}

        <Button
          type="submit"
          disabled={!file || uploading}
          className="w-full h-14 bg-[#1A3F7A] text-white text-base font-semibold rounded-xl"
        >
          {uploading ? 'Uploading…' : 'Submit for review'}
        </Button>
      </form>
    </div>
  )
}
