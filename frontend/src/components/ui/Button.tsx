import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Color = 'purple' | 'emerald' | 'blue' | 'red' | 'gray'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  color?: Color
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed'

const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' }

const variants: Record<Variant, Record<Color, string>> = {
  primary: {
    purple: 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500',
    emerald: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
    blue: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    red: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    gray: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
  },
  secondary: {
    purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100 focus:ring-purple-400',
    emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus:ring-emerald-400',
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100 focus:ring-blue-400',
    red: 'bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-400',
    gray: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400',
  },
  danger: {
    purple: 'border border-red-300 text-red-600 hover:bg-red-50',
    emerald: 'border border-red-300 text-red-600 hover:bg-red-50',
    blue: 'border border-red-300 text-red-600 hover:bg-red-50',
    red: 'border border-red-300 text-red-600 hover:bg-red-50',
    gray: 'border border-red-300 text-red-600 hover:bg-red-50',
  },
  ghost: {
    purple: 'text-gray-600 hover:bg-gray-100',
    emerald: 'text-gray-600 hover:bg-gray-100',
    blue: 'text-gray-600 hover:bg-gray-100',
    red: 'text-red-600 hover:bg-red-50',
    gray: 'text-gray-600 hover:bg-gray-100',
  },
}

export default function Button({
  variant = 'primary', color = 'blue', size = 'md', loading, icon, children, className, ...props
}: ButtonProps) {
  return (
    <button className={clsx(base, sizes[size], variants[variant][color], className)} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : icon}
      {children}
    </button>
  )
}
