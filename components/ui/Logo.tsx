import Image from 'next/image'
import logoSrc from '@/public/logo.png'

interface LogoProps {
  size?: number
  className?: string
}

export function Logo({ size = 56, className = '' }: LogoProps) {
  return (
    <Image
      src={logoSrc}
      alt="Accident Angels"
      width={size}
      height={size}
      className={className}
      priority
      unoptimized
    />
  )
}
