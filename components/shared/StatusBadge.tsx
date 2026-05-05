import { cn } from '@/lib/utils'

type ComplianceStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
type ContractStatus   = 'DRAFT' | 'PENDING_DRIVER_SIGNATURE' | 'PENDING_PARENT_SIGNATURE' | 'FULLY_SIGNED' | 'CANCELLED'
type DriverStatus     = 'PENDING_COMPLIANCE' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'

type Status = ComplianceStatus | ContractStatus | DriverStatus | 'EXPIRING'

const CONFIG: Record<Status, { label: string; className: string }> = {
  PENDING:                   { label: 'Pending',           className: 'bg-[#5A6474]/10 text-[#5A6474]' },
  UNDER_REVIEW:              { label: 'Under Review',      className: 'bg-[#F59E0B]/10 text-[#F59E0B]' },
  APPROVED:                  { label: 'Approved',          className: 'bg-[#0F6E56]/10 text-[#0F6E56]' },
  REJECTED:                  { label: 'Rejected',          className: 'bg-[#E24B4A]/10 text-[#E24B4A]' },
  EXPIRED:                   { label: 'Expired',           className: 'bg-[#E24B4A]/10 text-[#E24B4A]' },
  EXPIRING:                  { label: 'Expiring Soon',     className: 'bg-[#F59E0B]/10 text-[#F59E0B]' },
  DRAFT:                     { label: 'Draft',             className: 'bg-[#5A6474]/10 text-[#5A6474]' },
  PENDING_DRIVER_SIGNATURE:  { label: 'Awaiting Driver',   className: 'bg-[#F59E0B]/10 text-[#F59E0B]' },
  PENDING_PARENT_SIGNATURE:  { label: 'Awaiting Parent',   className: 'bg-[#F59E0B]/10 text-[#F59E0B]' },
  FULLY_SIGNED:              { label: 'Active',            className: 'bg-[#0F6E56]/10 text-[#0F6E56]' },
  CANCELLED:                 { label: 'Cancelled',         className: 'bg-[#E24B4A]/10 text-[#E24B4A]' },
  PENDING_COMPLIANCE:        { label: 'Pending Compliance', className: 'bg-[#F59E0B]/10 text-[#F59E0B]' },
  ACTIVE:                    { label: 'Active',            className: 'bg-[#0F6E56]/10 text-[#0F6E56]' },
  SUSPENDED:                 { label: 'Suspended',         className: 'bg-[#E24B4A]/10 text-[#E24B4A]' },
  INACTIVE:                  { label: 'Inactive',          className: 'bg-[#5A6474]/10 text-[#5A6474]' },
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold',
      cfg.className,
      className
    )}>
      {cfg.label}
    </span>
  )
}
