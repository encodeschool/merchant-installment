import clsx from 'clsx'
import React from 'react'

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'

const variantMap: Record<Variant, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  neutral: 'bg-gray-100 text-gray-600 ring-gray-200',
  purple: 'bg-purple-50 text-purple-700 ring-purple-200',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: Variant
  className?: string
}

export default function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', variantMap[variant], className)}>
      {children}
    </span>
  )
}

export function statusBadge(status: string) {
  const map: Record<string, { variant: Variant; label: string }> = {
    APPROVED: { variant: 'success', label: 'Approved' },
    ACTIVE: { variant: 'success', label: 'Active' },
    COMPLETED: { variant: 'info', label: 'Completed' },
    PENDING: { variant: 'warning', label: 'Pending' },
    PARTIAL: { variant: 'warning', label: 'Partial Approval' },
    REJECTED: { variant: 'danger', label: 'Rejected' },
    SUSPENDED: { variant: 'danger', label: 'Suspended' },
    DEFAULTED: { variant: 'danger', label: 'Defaulted' },
    NONE: { variant: 'neutral', label: 'None' },
    GOOD: { variant: 'success', label: 'Good' },
    FAIR: { variant: 'warning', label: 'Fair' },
    BAD: { variant: 'danger', label: 'Bad' },
  }
  const entry = map[status] ?? { variant: 'neutral' as Variant, label: status }
  return <Badge variant={entry.variant}>{entry.label}</Badge>
}
