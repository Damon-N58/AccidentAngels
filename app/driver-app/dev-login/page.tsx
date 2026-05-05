'use client'

export default function DriverDevLogin() {
  if (process.env.NODE_ENV !== 'development') return null

  return (
    <div className="min-h-screen bg-[#1A3F7A] flex flex-col items-center justify-center gap-4 px-6">
      <p className="text-white/60 text-xs uppercase tracking-widest mb-2">Dev bypass</p>
      <a
        href="/api/dev/login?role=DRIVER"
        className="w-full max-w-xs text-center bg-white text-[#1A3F7A] font-semibold py-4 rounded-xl"
      >
        Login as Driver →
      </a>
    </div>
  )
}
