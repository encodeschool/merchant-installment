import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

const DEMO_PASSWORD = 'demo1234'

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

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useTranslation()

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
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center bg-gradient-to-br from-slate-800 to-slate-900 p-12 text-white">
        <div className="max-w-md text-center">
          <div className="mb-6 text-5xl font-black tracking-tight">
            Installment<br />
            <span className="text-emerald-400">Platform</span>
          </div>
          <p className="text-slate-300 text-lg leading-relaxed">
            {t('login.brandSubtitle')}
          </p>
          <p className="mt-4 text-slate-500 text-sm">{t('login.brandTagline')}</p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-black text-slate-800">Installment Platform</h1>
            <p className="text-gray-500 text-sm mt-1">UzHack 2026</p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('login.signIn')}</h2>
          <p className="text-gray-500 text-sm mb-8">{t('login.accessPanel')}</p>

          {/* Demo accounts */}
          <div className="mb-6">
            {/* <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">{t('login.demoAccounts')}</p> */}
            {/* <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((u) => {
                const colors = roleColors[u.role]
                return (
                  <button
                    key={u.id}
                    onClick={() => quickLogin(u.email)}
                    className={clsx(
                      'flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-all',
                      colors.light,
                      email === u.email ? `ring-2 ${colors.ring}` : 'hover:opacity-80'
                    )}
                  >
                    <div className={clsx('h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold', colors.bg)}>
                      {u.name.charAt(0)}
                    </div>
                    <span className="truncate w-full text-center leading-tight">{roleLabels[u.role]}</span>
                  </button>
                )
              })}
            </div> */}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('login.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('login.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder', { pwd: DEMO_PASSWORD })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
