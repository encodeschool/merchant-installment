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
import { useTranslation } from 'react-i18next'

interface NavItem {
  labelKey: string
  path: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const navConfig: Record<string, { items: NavItem[]; gradient: string }> = {
  CENTRAL_BANK: {
    items: [
      { labelKey: 'nav.dashboard', path: '/cb', icon: HomeIcon },
      { labelKey: 'nav.tariffApprovals', path: '/cb/tariffs', icon: DocumentCheckIcon },
      { labelKey: 'nav.mfoMonitoring', path: '/cb/mfo', icon: BuildingLibraryIcon },
      { labelKey: 'nav.auditLogs', path: '/cb/audit', icon: ClipboardDocumentListIcon },
    ],
    gradient: 'linear-gradient(180deg, #1e1b4b 0%, #3730a3 100%)',
  },
  MFO_ADMIN: {
    items: [
      { labelKey: 'nav.dashboard', path: '/mfo', icon: HomeIcon },
      { labelKey: 'nav.tariffPlans', path: '/mfo/tariffs', icon: ChartBarIcon },
      { labelKey: 'nav.merchants', path: '/mfo/merchants', icon: UserGroupIcon },
      { labelKey: 'nav.applications', path: '/mfo/applications', icon: ClipboardDocumentListIcon },
    ],
    gradient: 'linear-gradient(180deg, #052e16 0%, #14532d 100%)',
  },
  MERCHANT: {
    items: [
      { labelKey: 'nav.dashboard', path: '/merchant', icon: HomeIcon },
      { labelKey: 'nav.products', path: '/merchant/products', icon: ShoppingBagIcon },
      { labelKey: 'nav.newApplication', path: '/merchant/apply', icon: PlusCircleIcon },
      { labelKey: 'nav.installments', path: '/merchant/installments', icon: CreditCardIcon },
    ],
    gradient: 'linear-gradient(180deg, #0f172a 0%, #1e3a5f 100%)',
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
  const { t } = useTranslation()
  const config = navConfig[user?.role ?? 'MERCHANT']

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-30 flex flex-col transition-all duration-300',
        collapsed ? 'lg:w-16' : 'lg:w-64',
        open ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0',
      )}
      style={{ background: config.gradient }}
    >
      {/* TOP SECTION: Logo */}
      <div className={clsx('shrink-0', collapsed ? 'px-2 pt-5 pb-3' : 'px-5 pt-6 pb-4')}>
        <div className={clsx('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
          <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">MIP</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate">Merchant Installment</p>
              <p className="text-white/40 text-xs truncate">Platform</p>
            </div>
          )}
          {/* Mobile close */}
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-white/10 lg:hidden">
            <XMarkIcon className="h-5 w-5 text-white/60" />
          </button>
        </div>
        {/* Desktop collapse toggle */}
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center p-1 rounded-lg hover:bg-white/10 transition-colors absolute top-5 right-3"
          >
            <ChevronLeftIcon className="h-4 w-4 text-white/40" />
          </button>
        )}
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            title={t('nav.dashboard')}
            className="hidden lg:flex items-center justify-center p-1 rounded-lg hover:bg-white/10 transition-colors mx-auto mt-2"
          >
            <ChevronRightIcon className="h-4 w-4 text-white/40" />
          </button>
        )}
      </div>

      {/* NAV SECTION */}
      <nav className={clsx('flex-1 overflow-y-auto py-4 space-y-1', collapsed ? 'px-2' : 'px-3')}>
        <p className={clsx('text-white/30 text-[10px] font-semibold uppercase tracking-widest pb-1', collapsed ? 'text-center' : 'px-3 pt-0')}>
          {!collapsed && 'Menu'}
        </p>
        {config.items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/cb' || item.path === '/mfo' || item.path === '/merchant'}
            onClick={onClose}
            title={collapsed ? t(item.labelKey) : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center rounded-xl text-sm font-medium transition-all cursor-pointer',
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 py-2.5',
                isActive
                  ? clsx('bg-white/12 text-white border-l-2 border-white/70 font-semibold', collapsed ? 'px-0' : 'pl-[calc(0.75rem-2px)] pr-3')
                  : clsx('text-white/55 hover:bg-white/[0.08] hover:text-white/80 border-l-2 border-transparent', collapsed ? 'px-0' : 'px-3')
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && t(item.labelKey)}
          </NavLink>
        ))}
      </nav>

      {/* BOTTOM SECTION: User + Logout */}
      <div className={clsx('border-t border-white/10 shrink-0', collapsed ? 'px-2 py-3' : 'px-4 py-4')}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white/80 text-sm font-medium truncate">{user?.name ?? 'User'}</p>
              <span className="text-white/50 text-[10px] bg-white/10 rounded-full px-2 py-0.5 inline-block mt-0.5">
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title={t('nav.logout')}
              className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            title={t('nav.logout')}
            className="flex items-center justify-center w-full p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  )
}
