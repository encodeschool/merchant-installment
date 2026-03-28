import clsx from 'clsx'
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: number      // positive = up, negative = down
  icon?: React.ReactNode
  color?: 'purple' | 'emerald' | 'blue' | 'orange' | 'red' | 'gray'
}

const colorMap = {
  purple: 'bg-purple-50 text-purple-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  blue: 'bg-blue-50 text-blue-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-gray-100 text-gray-600',
}

export default function StatCard({ title, value, subtitle, trend, icon, color = 'blue' }: StatCardProps) {
  return (
    <div className="rounded-xl bg-white border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
          {trend !== undefined && (
            <div className={clsx('mt-1.5 flex items-center gap-1 text-xs font-medium', trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {trend >= 0 ? <ArrowTrendingUpIcon className="h-3.5 w-3.5" /> : <ArrowTrendingDownIcon className="h-3.5 w-3.5" />}
              {Math.abs(trend)}% vs last month
            </div>
          )}
        </div>
        {icon && (
          <div className={clsx('rounded-lg p-2.5', colorMap[color])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
