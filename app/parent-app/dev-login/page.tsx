'use client'

export default function ParentDevLogin() {
  if (process.env.NODE_ENV !== 'development') return null

  return (
    <div className="min-h-screen bg-[#ec3d3a] flex flex-col items-center justify-center gap-4 px-6">
      <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Dev bypass</p>
      <a
        href="/api/dev/login?role=PARENT"
        className="w-full max-w-xs text-center bg-[#fdc73e] text-[#0F1923] font-semibold py-4 rounded-xl"
      >
        Login as Parent →
      </a>
    </div>
  )
}
