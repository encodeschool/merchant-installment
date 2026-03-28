import { useState, useEffect } from 'react'
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { statusBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Merchant } from '../../types'
import { apiMerchants } from '../../api'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

type TabFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'PENDING'

interface MerchantForm {
  name: string
  legalName: string
  category: string
  phone: string
  address: string
}

const emptyForm: MerchantForm = { name: '', legalName: '', category: '', phone: '', address: '' }

const categories = ['Electronics', 'Mobile & Gadgets', 'Home Appliances', 'Furniture', 'Sports & Fitness', 'Fashion', 'Auto Parts', 'Other']

export default function MFOMerchants() {
  const { t } = useTranslation()
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [tab, setTab] = useState<TabFilter>('ALL')
  const [search, setSearch] = useState('')
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [form, setForm] = useState<MerchantForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiMerchants.list().then(setMerchants).catch(() => {})
  }, [])

  const filtered = merchants.filter(m => {
    const matchesTab = tab === 'ALL' || m.status === tab
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.legalName.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  })

  const toggleStatus = (id: string) => {
    const m = merchants.find(x => x.id === id)
    if (!m || m.status === 'PENDING') return
    const newStatus = m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    apiMerchants.setStatus(id, newStatus)
      .then(updated => setMerchants(prev => prev.map(x => x.id === id ? updated : x)))
      .catch(() => setMerchants(prev => prev.map(x => x.id === id ? { ...x, status: newStatus as Merchant['status'] } : x)))
  }

  const handleOnboard = () => {
    setSaving(true)
    apiMerchants.create({
      name: form.name,
      legal_name: form.legalName,
      category: form.category,
      phone: form.phone,
      address: form.address,
    })
      .then(created => {
        setMerchants(prev => [created, ...prev])
        setForm(emptyForm)
        setOnboardOpen(false)
      })
      .catch(() => {
        const newMerchant: Merchant = {
          id: `m${Date.now()}`,
          name: form.name,
          legalName: form.legalName,
          category: form.category,
          phone: form.phone,
          address: form.address,
          status: 'PENDING',
          totalApplications: 0,
          approvedApplications: 0,
          joinedAt: new Date().toISOString().split('T')[0],
        }
        setMerchants(prev => [newMerchant, ...prev])
        setForm(emptyForm)
        setOnboardOpen(false)
      })
      .finally(() => setSaving(false))
  }

  const tabs: TabFilter[] = ['ALL', 'ACTIVE', 'SUSPENDED', 'PENDING']
  const counts: Record<TabFilter, number> = {
    ALL: merchants.length,
    ACTIVE: merchants.filter(m => m.status === 'ACTIVE').length,
    SUSPENDED: merchants.filter(m => m.status === 'SUSPENDED').length,
    PENDING: merchants.filter(m => m.status === 'PENDING').length,
  }

  const approvalRate = (m: Merchant) =>
    m.totalApplications > 0
      ? Math.round((m.approvedApplications / m.totalApplications) * 100)
      : 0

  const categoryInitial = (cat: string) => cat.charAt(0).toUpperCase()

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('merchants.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <Button
          variant="primary"
          color="emerald"
          icon={<PlusIcon className="h-4 w-4" />}
          onClick={() => setOnboardOpen(true)}
        >
          {t('merchants.onboardMerchant')}
        </Button>
      </div>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {tabs.map(tabKey => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={clsx(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              tab === tabKey ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {tabKey.charAt(0) + tabKey.slice(1).toLowerCase()} ({counts[tabKey]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-100 p-12 text-center">
          <p className="text-sm text-gray-400">{t('merchants.noMerchants')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => (
            <div key={m.id} className="rounded-xl bg-white border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                    {categoryInitial(m.category)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.category}</p>
                  </div>
                </div>
                {statusBadge(m.status)}
              </div>

              <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                <p className="truncate"><span className="font-medium text-gray-700">{t('merchants.legal')}: </span>{m.legalName}</p>
                <p><span className="font-medium text-gray-700">{t('merchants.phone')}: </span>{m.phone}</p>
                <p className="truncate"><span className="font-medium text-gray-700">{t('merchants.address')}: </span>{m.address}</p>
                <p><span className="font-medium text-gray-700">{t('merchants.joined')}: </span>{m.joinedAt}</p>
              </div>

              <div className="flex items-center justify-between py-2 border-t border-gray-50 text-xs">
                <div className="text-center">
                  <p className="font-bold text-gray-900">{m.totalApplications}</p>
                  <p className="text-gray-400">{t('merchants.apps')}</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900">{m.approvedApplications}</p>
                  <p className="text-gray-400">{t('merchants.approved')}</p>
                </div>
                <div className="text-center">
                  <p className={clsx('font-bold', approvalRate(m) >= 70 ? 'text-emerald-600' : approvalRate(m) >= 50 ? 'text-yellow-600' : 'text-red-600')}>
                    {approvalRate(m)}%
                  </p>
                  <p className="text-gray-400">{t('merchants.rate')}</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-50">
                <button
                  onClick={() => toggleStatus(m.id)}
                  className={clsx(
                    'w-full rounded-lg py-1.5 text-xs font-medium transition-colors',
                    m.status === 'ACTIVE'
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : m.status === 'SUSPENDED'
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-gray-50 text-gray-500 cursor-default'
                  )}
                  disabled={m.status === 'PENDING'}
                >
                  {m.status === 'ACTIVE' ? t('merchants.suspend') : m.status === 'SUSPENDED' ? t('merchants.reactivate') : t('merchants.pendingApproval')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={onboardOpen} onClose={() => setOnboardOpen(false)} title={t('merchants.onboardNewTitle')} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('merchants.businessName')}</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. TechMart Savdo"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('merchants.legalName')}</label>
            <input
              type="text"
              value={form.legalName}
              onChange={e => setForm(f => ({ ...f, legalName: e.target.value }))}
              placeholder="e.g. TechMart Savdo LLC"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('merchants.category')}</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              <option value="">{t('merchants.selectCategory')}</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('merchants.phone')}</label>
            <input
              type="text"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+998901234567"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('merchants.address')}</label>
            <input
              type="text"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="City, Street, Building"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <Button variant="secondary" color="gray" className="flex-1" onClick={() => setOnboardOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              color="emerald"
              className="flex-1"
              onClick={handleOnboard}
              disabled={!form.name || !form.category || saving}
            >
              {saving ? t('merchants.saving') : t('merchants.onboardMerchant')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
