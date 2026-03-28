import { useState, useRef, useEffect } from 'react'
import { Bars3Icon, BellIcon, UserCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import clsx from 'clsx'

const pageTitleKeys: Record<string, string> = {
  '/cb': 'nav.dashboard',
  '/cb/tariffs': 'nav.tariffApprovals',
  '/cb/mfo': 'nav.mfoMonitoring',
  '/cb/audit': 'nav.auditLogs',
  '/cb/profile': 'nav.myProfile',
  '/mfo': 'nav.dashboard',
  '/mfo/tariffs': 'nav.tariffPlans',
  '/mfo/merchants': 'nav.merchants',
  '/mfo/applications': 'nav.applications',
  '/mfo/profile': 'nav.myProfile',
  '/merchant': 'nav.dashboard',
  '/merchant/products': 'nav.products',
  '/merchant/apply': 'nav.newApplication',
  '/merchant/installments': 'nav.installments',
  '/merchant/profile': 'nav.myProfile',
}

const roleColors: Record<string, string> = {
  CENTRAL_BANK: 'bg-purple-600',
  MFO_ADMIN: 'bg-emerald-600',
  MERCHANT: 'bg-blue-600',
}

const profilePaths: Record<string, string> = {
  CENTRAL_BANK: '/cb/profile',
  MFO_ADMIN: '/mfo/profile',
  MERCHANT: '/merchant/profile',
}

const LANGS = ['en', 'ru', 'uz'] as const

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { t } = useTranslation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const titleKey = pageTitleKeys[pathname] ?? 'nav.dashboard'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    setDropdownOpen(false)
    logout()
    navigate('/login')
  }

  const handleProfile = () => {
    setDropdownOpen(false)
    const path = profilePaths[user?.role ?? '']
    if (path) navigate(path)
  }

  return (
    <header className="flex h-14 items-center gap-4 border-b border-gray-100 bg-white px-4 md:px-8 shrink-0 sticky top-0 z-20">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-md hover:bg-gray-100"
      >
        <Bars3Icon className="h-6 w-6 text-gray-600" />
      </button>

      <h1 className="flex-1 text-base font-semibold text-gray-800 md:text-lg truncate">
        {t(titleKey)}
      </h1>

      {/* Language switcher */}
      <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 p-0.5 shrink-0">
        {LANGS.map(lang => (
          <button
            key={lang}
            onClick={() => i18n.changeLanguage(lang)}
            className={clsx(
              'rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors',
              i18n.language === lang
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:text-gray-800'
            )}
          >
            {lang}
          </button>
        ))}
      </div>

      <button className="relative p-2 rounded-full hover:bg-gray-100 shrink-0">
        <BellIcon className="h-5 w-5 text-gray-500" />
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
      </button>

      {/* Avatar + dropdown */}
      <div ref={dropdownRef} className="relative shrink-0">
        <button
          onClick={() => setDropdownOpen(o => !o)}
          className={clsx(
            'flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold ring-2 ring-transparent hover:ring-offset-1 transition-all',
            roleColors[user?.role ?? 'MERCHANT'],
            dropdownOpen && 'ring-gray-300 ring-offset-1',
          )}
        >
          {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-gray-200 bg-white shadow-lg py-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{user?.organization}</p>
              <span className={clsx(
                'mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                user?.role === 'CENTRAL_BANK' ? 'bg-purple-100 text-purple-700' :
                user?.role === 'MFO_ADMIN' ? 'bg-emerald-100 text-emerald-700' :
                'bg-blue-100 text-blue-700'
              )}>
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
            <button
              onClick={handleProfile}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <UserCircleIcon className="h-4 w-4 text-gray-400" />
              {t('nav.myProfile')}
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              {t('nav.logout')}
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
