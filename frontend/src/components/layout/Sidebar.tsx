import { NavLink, useNavigate } from 'react-router-dom'
import {
  HomeIcon, DocumentCheckIcon, BuildingLibraryIcon,
  ClipboardDocumentListIcon, ChartBarIcon, UserGroupIcon,
  ShoppingBagIcon, PlusCircleIcon, CreditCardIcon,
  ArrowRightOnRectangleIcon, XMarkIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useAuthStore } from '../../store/authStore'

interface NavItem {
  label: string
  path: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const navConfig: Record<string, { items: NavItem[]; color: string; bg: string; activeBg: string; activeText: string }> = {
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
  },
}

interface SidebarProps {
  open: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
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
        'fixed inset-y-0 left-0 z-30 flex flex-col bg-white shadow-lg transition-all duration-300',
        'lg:static lg:shadow-none lg:border-r lg:border-gray-200',
        collapsed ? 'lg:w-16' : 'lg:w-64',
        open ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0',
      )}
    >
      {/* Logo / header */}
      <div className={clsx('flex items-center border-b border-gray-100 shrink-0', config.bg, collapsed ? 'justify-center px-0 py-4' : 'justify-between px-5 py-4')}>
        {!collapsed && (
          <div>
            <p className={clsx('text-sm font-bold tracking-wide', config.color)}>Installment Platform</p>
            <p className="text-xs text-gray-500 mt-0.5">UzHack 2026</p>
          </div>
        )}
        {/* Mobile close */}
        <button onClick={onClose} className={clsx('p-1 rounded hover:bg-gray-100 lg:hidden', collapsed && 'mx-auto')}>
          <XMarkIcon className="h-5 w-5 text-gray-500" />
        </button>
        {/* Desktop collapse toggle */}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={clsx('hidden lg:flex items-center justify-center p-1 rounded hover:bg-gray-100 transition-colors', collapsed && 'mx-auto')}
        >
          {collapsed
            ? <ChevronRightIcon className="h-4 w-4 text-gray-500" />
            : <ChevronLeftIcon className="h-4 w-4 text-gray-500" />}
        </button>
      </div>

      {/* Nav */}
      <nav className={clsx('flex-1 overflow-y-auto py-4 space-y-1', collapsed ? 'px-2' : 'px-3')}>
        {config.items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/cb' || item.path === '/mfo' || item.path === '/merchant'}
            onClick={onClose}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center rounded-lg py-2.5 text-sm transition-colors',
                collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                isActive
                  ? clsx(config.activeBg, config.activeText)
                  : 'text-gray-600 hover:bg-gray-100'
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className={clsx('border-t border-gray-100 p-3 shrink-0', collapsed && 'flex justify-center')}>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Log out' : undefined}
          className={clsx(
            'flex items-center rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors',
            collapsed ? 'justify-center w-10 h-10 px-0' : 'w-full gap-2',
          )}
        >
          <ArrowRightOnRectangleIcon className="h-4 w-4 shrink-0" />
          {!collapsed && 'Log out'}
        </button>
      </div>
    </aside>
  )
}
