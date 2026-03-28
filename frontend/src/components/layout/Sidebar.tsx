import { NavLink, useNavigate } from 'react-router-dom'
import {
  HomeIcon, DocumentCheckIcon, BuildingLibraryIcon,
  ClipboardDocumentListIcon, ChartBarIcon, UserGroupIcon,
  ShoppingBagIcon, PlusCircleIcon, CreditCardIcon,
  ArrowRightOnRectangleIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useAuthStore } from '../../store/authStore'

interface NavItem {
  label: string
  path: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const navConfig: Record<string, { items: NavItem[]; color: string; bg: string; activeBg: string; activeText: string; badge: string }> = {
  CENTRAL_BANK: {
    items: [
      { label: 'Dashboard', path: '/cb', icon: HomeIcon },
      { label: 'Tariff Approvals', path: '/cb/tariffs', icon: DocumentCheckIcon },
      { label: 'MFO Monitoring', path: '/cb/mfo', icon: BuildingLibraryIcon },
      { label: 'Audit Logs', path: '/cb/audit', icon: ClipboardDocumentListIcon },
    ],
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    activeBg: 'bg-purple-100',
    activeText: 'text-purple-700 font-semibold',
    badge: 'bg-purple-100 text-purple-700',
  },
  MFO_ADMIN: {
    items: [
      { label: 'Dashboard', path: '/mfo', icon: HomeIcon },
      { label: 'Tariff Plans', path: '/mfo/tariffs', icon: ChartBarIcon },
      { label: 'Merchants', path: '/mfo/merchants', icon: UserGroupIcon },
      { label: 'Applications', path: '/mfo/applications', icon: ClipboardDocumentListIcon },
    ],
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    activeBg: 'bg-emerald-100',
    activeText: 'text-emerald-700 font-semibold',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  MERCHANT: {
    items: [
      { label: 'Dashboard', path: '/merchant', icon: HomeIcon },
      { label: 'Products', path: '/merchant/products', icon: ShoppingBagIcon },
      { label: 'New Application', path: '/merchant/apply', icon: PlusCircleIcon },
      { label: 'Installments', path: '/merchant/installments', icon: CreditCardIcon },
    ],
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    activeBg: 'bg-blue-100',
    activeText: 'text-blue-700 font-semibold',
    badge: 'bg-blue-100 text-blue-700',
  },
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const config = navConfig[user?.role ?? 'MERCHANT']

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-white shadow-lg transition-transform duration-300 lg:static lg:translate-x-0 lg:shadow-none lg:border-r lg:border-gray-200',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Logo */}
      <div className={clsx('flex items-center justify-between px-5 py-4 border-b border-gray-100', config.bg)}>
        <div>
          <p className={clsx('text-sm font-bold tracking-wide', config.color)}>
            Installment Platform
          </p>
          <p className="text-xs text-gray-500 mt-0.5">UzHack 2026</p>
        </div>
        <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-gray-100">
          <XMarkIcon className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {config.items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/cb' || item.path === '/mfo' || item.path === '/merchant'}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? clsx(config.activeBg, config.activeText)
                  : 'text-gray-600 hover:bg-gray-100'
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-gray-100 p-4">
        <div className="mb-3">
          <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
          <p className="text-xs text-gray-500 truncate">{user?.organization}</p>
          <span className={clsx('mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium', config.badge)}>
            {user?.role?.replace('_', ' ')}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <ArrowRightOnRectangleIcon className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  )
}
