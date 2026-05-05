'use client'

export default function ParentDevLogin() {
  if (process.env.NODE_ENV !== 'development') return null

  return (
    <div className="min-h-screen bg-[#1A3F7A] flex flex-col items-center justify-center gap-4 px-6">
      <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Dev bypass</p>
      <a
        href="/api/dev/login?role=PARENT"
        className="w-full max-w-xs text-center bg-[#F5A623] text-[#0F1923] font-semibold py-4 rounded-xl"
      >
        Login as Parent →
      </a>
    </div>
  )
}
