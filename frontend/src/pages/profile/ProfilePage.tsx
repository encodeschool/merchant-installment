import { useState } from 'react'
import { UserCircleIcon, KeyIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '../../store/authStore'
import { apiProfile } from '../../api'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

const roleColors: Record<string, string> = {
  CENTRAL_BANK: 'bg-purple-600',
  MFO_ADMIN: 'bg-emerald-600',
  MERCHANT: 'bg-blue-600',
}

const roleBadge: Record<string, string> = {
  CENTRAL_BANK: 'bg-purple-100 text-purple-700',
  MFO_ADMIN: 'bg-emerald-100 text-emerald-700',
  MERCHANT: 'bg-blue-100 text-blue-700',
}

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const { t } = useTranslation()

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [organization, setOrganization] = useState(user?.organization ?? '')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pwError, setPwError] = useState<string | null>(null)

  const handleSaveInfo = () => {
    setError(null)
    setSaving(true)
    apiProfile.update({ name, email, organization })
      .then(updated => {
        updateUser(updated)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      })
      .catch(err => setError(err?.response?.data?.detail ?? t('profile.failedSave')))
      .finally(() => setSaving(false))
  }

  const handleChangePassword = () => {
    setPwError(null)
    if (!currentPassword) { setPwError(t('profile.enterCurrentPassword')); return }
    if (newPassword.length < 6) { setPwError(t('profile.passwordTooShort')); return }
    if (newPassword !== confirmPassword) { setPwError(t('profile.passwordMismatch')); return }

    setSaving(true)
    apiProfile.update({ current_password: currentPassword, new_password: newPassword })
      .then(() => {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      })
      .catch(err => setPwError(err?.response?.data?.detail ?? t('profile.failedPassword')))
      .finally(() => setSaving(false))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Avatar header */}
      <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm flex items-center gap-5">
        <div className={clsx(
          'flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white text-2xl font-bold',
          roleColors[user?.role ?? 'MERCHANT']
        )}>
          {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{user?.name}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
          <span className={clsx('mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', roleBadge[user?.role ?? 'MERCHANT'])}>
            {user?.role?.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Success banner */}
      {saved && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium">
          <CheckCircleIcon className="h-4 w-4 shrink-0" />
          {t('profile.savedSuccess')}
        </div>
      )}

      {/* Profile info */}
      <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <UserCircleIcon className="h-5 w-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">{t('profile.info')}</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.fullName')}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.email')}</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.organization')}</label>
          <input
            type="text"
            value={organization}
            onChange={e => setOrganization(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.role')}</label>
          <input
            type="text"
            value={user?.role?.replace('_', ' ') ?? ''}
            disabled
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-400">{t('profile.roleHint')}</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="pt-1">
          <button
            onClick={handleSaveInfo}
            disabled={saving || !name || !email}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? t('profile.saving') : t('profile.saveChanges')}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <KeyIcon className="h-5 w-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">{t('profile.changePassword')}</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.currentPassword')}</label>
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            className={inputCls}
            placeholder="••••••••"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.newPassword')}</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className={inputCls}
            placeholder={t('profile.minChars')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.confirmPassword')}</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className={inputCls}
            placeholder="••••••••"
          />
        </div>

        {pwError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{pwError}</p>
        )}

        <div className="pt-1">
          <button
            onClick={handleChangePassword}
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="rounded-xl bg-gray-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? t('profile.updating') : t('profile.updatePassword')}
          </button>
        </div>
      </div>

    </div>
  )
}
