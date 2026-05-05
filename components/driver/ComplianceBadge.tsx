import { CheckCircle2, Clock, XCircle, AlertTriangle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXPIRING'

const CFG = {
  PENDING:      { label: 'Pending',        Icon: Clock,          cls: 'text-[#5A6474] bg-[#5A6474]/10' },
  UNDER_REVIEW: { label: 'Under review',   Icon: RotateCcw,      cls: 'text-[#F59E0B] bg-[#F59E0B]/10' },
  APPROVED:     { label: 'Approved',       Icon: CheckCircle2,   cls: 'text-[#0F6E56] bg-[#0F6E56]/10' },
  REJECTED:     { label: 'Rejected',       Icon: XCircle,        cls: 'text-[#E24B4A] bg-[#E24B4A]/10' },
  EXPIRED:      { label: 'Expired',        Icon: XCircle,        cls: 'text-[#E24B4A] bg-[#E24B4A]/10' },
  EXPIRING:     { label: 'Expiring soon',  Icon: AlertTriangle,  cls: 'text-[#F59E0B] bg-[#F59E0B]/10' },
}

interface ComplianceBadgeProps {
  status: Status
  size?: 'sm' | 'md'
  className?: string
}

export function ComplianceBadge({ status, size = 'md', className }: ComplianceBadgeProps) {
  const { label, Icon, cls } = CFG[status]
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-medium',
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1',
      cls,
      className
    )}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {label}
    </span>
  )
}
