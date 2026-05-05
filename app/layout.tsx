import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Accident Angels',
  description: 'Safe scholar transport, every day.',
  manifest: '/driver/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Accident Angels',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1A3F7A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={`${geist.variable} h-full`}>
      <body className="min-h-full bg-[#F8F9FB] antialiased">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
