import { Bars3Icon, BellIcon } from '@heroicons/react/24/outline'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import clsx from 'clsx'

const pageTitles: Record<string, string> = {
  '/cb': 'Dashboard',
  '/cb/tariffs': 'Tariff Approvals',
  '/cb/mfo': 'MFO Monitoring',
  '/cb/audit': 'Audit Logs',
  '/mfo': 'Dashboard',
  '/mfo/tariffs': 'Tariff Plans',
  '/mfo/merchants': 'Merchants',
  '/mfo/applications': 'Applications',
  '/merchant': 'Dashboard',
  '/merchant/products': 'Products',
  '/merchant/apply': 'New Application',
  '/merchant/installments': 'My Installments',
}

const roleColors: Record<string, string> = {
  CENTRAL_BANK: 'bg-purple-600',
  MFO_ADMIN: 'bg-emerald-600',
  MERCHANT: 'bg-blue-600',
}

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { pathname } = useLocation()
  const { user } = useAuthStore()
  const title = pageTitles[pathname] ?? 'Installment Platform'

  return (
    <header className="flex h-14 items-center gap-4 border-b border-gray-200 bg-white px-4 md:px-6">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-md hover:bg-gray-100"
      >
        <Bars3Icon className="h-6 w-6 text-gray-600" />
      </button>

      <h1 className="flex-1 text-base font-semibold text-gray-800 md:text-lg">
        {title}
      </h1>

      <button className="relative p-2 rounded-full hover:bg-gray-100">
        <BellIcon className="h-5 w-5 text-gray-500" />
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
      </button>

      <div className={clsx('flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold', roleColors[user?.role ?? 'MERCHANT'])}>
        {user?.name?.charAt(0) ?? 'U'}
      </div>
    </header>
  )
}
