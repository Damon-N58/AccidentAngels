import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-16 px-6 text-center',
      className
    )}>
      {icon && (
        <div className="w-16 h-16 rounded-full bg-[#1A3F7A]/08 flex items-center justify-center mb-4">
          <div className="text-[#1A3F7A]/50 [&>svg]:w-8 [&>svg]:h-8">
            {icon}
          </div>
        </div>
      )}
      <h3 className="text-base font-semibold text-[#0F1923] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[#5A6474] max-w-xs mb-6">{description}</p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          className="h-12 bg-[#1A3F7A] hover:bg-[#1A3F7A]/90 text-white"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
