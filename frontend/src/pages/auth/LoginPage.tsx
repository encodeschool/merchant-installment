import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useTranslation } from 'react-i18next'
import { BanknotesIcon, ShoppingBagIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

const DEMO_PASSWORD = 'demo1234'

const BACKGROUND_IMAGES = [
  '/625620372_18328729924171842_2082333328854662346_n.jpg',
  '/651932141_18124748884571754_2114921593851786412_n.jpg',
  '/653632867_18129703471479113_4644078975088522012_n.jpg',
  '/654013319_18383386447091505_8304455326098712430_n.jpg',
  '/654075735_18163655311419698_1038842188726176300_n.jpg',
  '/654450776_18457788892097325_2286324401007108298_n.jpg',
  '/655039080_18386214460087364_3728211768746775533_n.jpg',
]

const DEMO_ACCOUNTS = [
  { id: 'u2', name: 'Dilnoza Yusupova', email: 'dilnoza@ipoteka.uz', role: 'MFO_ADMIN' as const },
  { id: 'u3', name: 'Bobur Rahimov', email: 'bobur@techmart.uz', role: 'MERCHANT' as const },
]

const roleColors = {
  MFO_ADMIN: { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', light: 'bg-emerald-50 border-emerald-200 text-emerald-700', ring: 'ring-emerald-400' },
  MERCHANT: { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', light: 'bg-blue-50 border-blue-200 text-blue-700', ring: 'ring-blue-400' },
}

const roleLabels = {
  MFO_ADMIN: 'MFO Admin',
  MERCHANT: 'Merchant',
}

const roleIcons = {
  MFO_ADMIN: BanknotesIcon,
  MERCHANT: ShoppingBagIcon,
}

const submitBtnColors: Record<string, string> = {
  MERCHANT: 'bg-blue-600 hover:bg-blue-700',
  MFO_ADMIN: 'bg-emerald-600 hover:bg-emerald-700',
  CENTRAL_BANK: 'bg-violet-600 hover:bg-violet-700',
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [showDemoAccounts, setShowDemoAccounts] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const selectedRole = DEMO_ACCOUNTS.find(u => u.email === email)?.role ?? 'MERCHANT'

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const ok = await login(email, password || DEMO_PASSWORD)
    setLoading(false)
    if (!ok) {
      setError(t('login.invalidEmail'))
      return
    }
    const role = useAuthStore.getState().user?.role
    const map: Record<string, string> = { CENTRAL_BANK: '/cb', MFO_ADMIN: '/mfo', MERCHANT: '/merchant' }
    navigate(map[role ?? ''] ?? '/')
  }

  const quickLogin = (userEmail: string) => {
    setEmail(userEmail)
    setPassword(DEMO_PASSWORD)
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left brand panel — image carousel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 text-white relative overflow-hidden">
        {/* Background images with crossfade */}
        {BACKGROUND_IMAGES.map((img, idx) => (
          <div
            key={img}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{
              opacity: idx === currentImageIndex ? 1 : 0,
              backgroundImage: `url(${img})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ))}
        
        {/* Lighter overlay for more visible images */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 via-blue-900/40 to-slate-900/50" />

        <div className="flex flex-col items-center justify-center gap-10 relative z-10 max-w-xl">
          <div className="text-center bg-slate-900/70 backdrop-blur-md px-10 py-8 rounded-3xl shadow-2xl border border-white/10">
            <h1 className="text-5xl font-bold tracking-tight text-white mb-2" style={{ textShadow: '2px 2px 12px rgba(0,0,0,0.9)' }}>
              Markazlashgan Nasiya Platformasi
            </h1>
            <p className="text-white/90 text-lg mt-4 max-w-md text-center leading-relaxed font-light" style={{ textShadow: '1px 1px 6px rgba(0,0,0,0.8)' }}>
              O'zbekiston Markaziy Banki tomonidan sertifikatlangan
            </p>
          </div>

          <div className="flex flex-col gap-4 bg-slate-900/70 backdrop-blur-md px-8 py-6 rounded-2xl shadow-2xl border border-white/10 w-full">
            {[
              'Hamma nasiya tashkilotlar bir yerda',
              'AI yordamida chuqurlashtirilgan skoring modeli',
              'Avtomatlashgan nasiya berish tizmi',
            ].map((feature) => (
              <div key={feature} className="flex items-start gap-4 text-white text-base" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.8)' }}>
                <svg className="w-6 h-6 text-emerald-400 shrink-0 drop-shadow-lg mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="leading-relaxed">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Credits */}
        <div className="absolute bottom-4 right-4 text-white/50 text-[9px] z-10 bg-black/30 px-2 py-1 rounded">
          Feruz Rustamov
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex flex-1 items-center justify-center p-8 min-h-screen bg-slate-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm space-y-6 relative">
          <div className="lg:hidden text-center">
            <h1 className="text-2xl font-bold text-slate-800">Merchant Installment</h1>
            <p className="text-gray-400 text-xs mt-1">Platform</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('login.signIn')}</h2>
              <p className="text-gray-500 text-sm mt-1">{t('login.accessPanel')}</p>
            </div>
            
            {/* Demo toggle button */}
            <button
              onClick={() => setShowDemoAccounts(!showDemoAccounts)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 rounded-lg transition-all hover:bg-indigo-50"
            >
              {showDemoAccounts ? 'Hide Demo' : 'Show Demo'}
            </button>
          </div>

          {/* Role selector cards - conditionally shown */}
          {showDemoAccounts && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">{t('login.demoAccounts')}</p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((u) => {
                  const colors = roleColors[u.role]
                  const isSelected = email === u.email
                  const Icon = roleIcons[u.role]
                  return (
                    <button
                      key={u.id}
                      onClick={() => quickLogin(u.email)}
                      className={clsx(
                        'flex flex-col items-center gap-1.5 border rounded-xl p-3 cursor-pointer text-center text-xs font-medium transition-all',
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      )}
                    >
                      <div className={clsx(
                        'w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                        isSelected ? 'bg-indigo-500 text-white' : clsx(colors.bg, 'text-white')
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="truncate w-full text-center leading-tight">{roleLabels[u.role]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('login.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('login.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPlaceholder', { pwd: DEMO_PASSWORD })}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword
                    ? <EyeSlashIcon className="h-4 w-4" />
                    : <EyeIcon className="h-4 w-4" />
                  }
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className={clsx(
                'w-full rounded-xl py-3 font-semibold text-sm text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2',
                submitBtnColors[selectedRole] ?? 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Kirish...
                </>
              ) : t('login.signIn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
