'use client'

import { useRef, useState, ChangeEvent } from 'react'
import { Camera, Upload, X, FileImage } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CameraUploadProps {
  onFile: (file: File) => void
  accept?: string
  disabled?: boolean
  preview?: string | null
  onClear?: () => void
  label?: string
}

export function CameraUpload({
  onFile,
  accept = 'image/*,application/pdf',
  disabled,
  preview,
  onClear,
  label = 'Take Photo',
}: CameraUploadProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  const displayPreview = preview ?? localPreview

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onFile(file)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (ev) => setLocalPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  function clear() {
    setLocalPreview(null)
    onClear?.()
  }

  if (displayPreview) {
    return (
      <div className="relative rounded-xl overflow-hidden border-2 border-[#0F6E56]/30 bg-[#0F6E56]/5">
        {displayPreview.startsWith('data:image') || displayPreview.startsWith('https') ? (
          <img src={displayPreview} alt="Document preview" className="w-full max-h-64 object-contain" />
        ) : (
          <div className="flex items-center gap-3 p-4">
            <FileImage className="w-8 h-8 text-[#0F6E56]" />
            <span className="text-sm text-[#0F1923] font-medium">Document uploaded</span>
          </div>
        )}
        {!disabled && (
          <button
            onClick={clear}
            className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-sm border"
          >
            <X className="w-4 h-4 text-[#E24B4A]" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={cn(
      'border-2 border-dashed rounded-xl p-6',
      'border-[rgba(26,63,122,0.25)] bg-[rgba(26,63,122,0.02)]',
      'flex flex-col items-center gap-4',
      disabled && 'opacity-50 pointer-events-none'
    )}>
      <div className="w-14 h-14 rounded-full bg-[#1A3F7A]/10 flex items-center justify-center">
        <Camera className="w-7 h-7 text-[#1A3F7A]" />
      </div>

      <div className="text-center">
        <p className="text-sm font-medium text-[#0F1923]">
          Take a clear photo or upload a file
        </p>
        <p className="text-xs text-[#5A6474] mt-1">
          JPG, PNG or PDF
        </p>
      </div>

      <div className="flex gap-3 w-full">
        <Button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex-1 h-12 bg-[#1A3F7A] hover:bg-[#1A3F7A]/90 text-white"
        >
          <Camera className="w-4 h-4 mr-2" />
          {label}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          className="h-12 px-4"
        >
          <Upload className="w-4 h-4" />
        </Button>
      </div>

      {/* Camera input — opens camera on mobile */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      {/* File picker — all file types */}
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}
