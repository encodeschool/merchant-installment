import clsx from 'clsx'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: number
  icon?: React.ReactNode
  color?: 'purple' | 'emerald' | 'blue' | 'orange' | 'red' | 'gray'
  accent?: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose'
  loading?: boolean
}

const accentMap = {
  blue:    { bg: 'bg-blue-50',    icon: 'bg-blue-500',    text: 'text-blue-600' },
  emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-500', text: 'text-emerald-600' },
  violet:  { bg: 'bg-violet-50',  icon: 'bg-violet-500',  text: 'text-violet-600' },
  amber:   { bg: 'bg-amber-50',   icon: 'bg-amber-500',   text: 'text-amber-600' },
  rose:    { bg: 'bg-rose-50',    icon: 'bg-rose-500',    text: 'text-rose-600' },
}

const legacyToAccent: Record<string, keyof typeof accentMap> = {
  purple: 'violet',
  emerald: 'emerald',
  blue: 'blue',
  orange: 'amber',
  red: 'rose',
  gray: 'blue',
}

export default function StatCard({ title, value, subtitle, trend, icon, color = 'blue', accent, loading }: StatCardProps) {
  const resolvedAccent = accent ?? legacyToAccent[color] ?? 'blue'
  const colors = accentMap[resolvedAccent]

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-card p-5 flex flex-col gap-4 animate-pulse">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-7 w-20 bg-gray-200 rounded mt-2" />
          </div>
          <div className="w-11 h-11 bg-gray-200 rounded-xl" />
        </div>
        <div className="h-3 w-32 bg-gray-100 rounded" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-shadow p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
        </div>
        {icon && (
          <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center', colors.icon)}>
            <span className="text-white [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
          </div>
        )}
      </div>
      {trend !== undefined && trend !== 0 && (
        <div className="flex items-center gap-1">
          <span className={clsx('text-xs font-medium', trend > 0 ? 'text-emerald-600' : 'text-red-500')}>
            {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
          <span className="text-gray-400 text-xs ml-1">vs last month</span>
        </div>
      )}
    </div>
  )
}
