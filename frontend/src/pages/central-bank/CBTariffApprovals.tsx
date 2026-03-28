import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { statusBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Tariff } from '../../types'
import { apiTariffs } from '../../api'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

function formatUZS(n: number): string {
  return n.toLocaleString() + ' UZS'
}

type FilterTab = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'

export default function CBTariffApprovals() {
  const { t } = useTranslation()
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [tab, setTab] = useState<FilterTab>('ALL')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Tariff | null>(null)

  useEffect(() => {
    apiTariffs.list().then(setTariffs).catch(() => {})
  }, [])

  const filtered = tariffs.filter(t => {
    const matchesTab = tab === 'ALL' || t.status === tab
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.mfoName.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  })

  const approve = (id: string) => {
    apiTariffs.approve(id)
      .then(updated => {
        setTariffs(prev => prev.map(t => t.id === id ? updated : t))
        setSelected(null)
      })
      .catch(() => {
        setTariffs(prev => prev.map(t => t.id === id
          ? { ...t, status: 'APPROVED' as const, approvedAt: new Date().toISOString().split('T')[0] }
          : t
        ))
        setSelected(null)
      })
  }

  const reject = (id: string) => {
    apiTariffs.reject(id)
      .then(updated => {
        setTariffs(prev => prev.map(t => t.id === id ? updated : t))
        setSelected(null)
      })
      .catch(() => {
        setTariffs(prev => prev.map(t => t.id === id ? { ...t, status: 'REJECTED' as const } : t))
        setSelected(null)
      })
  }

  const tabs: FilterTab[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED']
  const counts: Record<FilterTab, number> = {
    ALL: tariffs.length,
    PENDING: tariffs.filter(t => t.status === 'PENDING').length,
    APPROVED: tariffs.filter(t => t.status === 'APPROVED').length,
    REJECTED: tariffs.filter(t => t.status === 'REJECTED').length,
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('cbTariffs.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          />
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {tabs.map(tabKey => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={clsx(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              tab === tabKey ? 'bg-white shadow-sm text-purple-700' : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {tabKey.charAt(0) + tabKey.slice(1).toLowerCase()} ({counts[tabKey]})
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {[t('cbTariffs.colName'), t('cbTariffs.colMFO'), t('cbTariffs.colRate'), t('cbTariffs.colAmountRange'), t('cbTariffs.colDuration'), t('cbTariffs.colStatus'), t('cbTariffs.colCreated'), t('cbTariffs.colActions')].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                    {t('cbTariffs.noTariffs')}
                  </td>
                </tr>
              ) : filtered.map(tariff => (
                <tr
                  key={tariff.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelected(tariff)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{tariff.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{tariff.mfoName}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-semibold">{tariff.interestRate}%</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {(tariff.minAmount / 1_000_000).toFixed(1)}M – {(tariff.maxAmount / 1_000_000).toFixed(1)}M UZS
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{tariff.months} mo</td>
                  <td className="px-4 py-3">{statusBadge(tariff.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{tariff.createdAt}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {tariff.status === 'PENDING' && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => approve(tariff.id)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                          {t('common.approve')}
                        </button>
                        <button
                          onClick={() => reject(tariff.id)}
                          className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                        >
                          <XCircleIcon className="h-3.5 w-3.5" />
                          {t('common.reject')}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={t('cbTariffs.detailsTitle')} size="md">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">{t('cbTariffs.tariffName')}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{selected.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('cbTariffs.mfo')}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{selected.mfoName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('cbTariffs.annualRate')}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{selected.interestRate}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('common.status')}</p>
                <div className="mt-0.5">{statusBadge(selected.status)}</div>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('cbTariffs.minAmount')}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatUZS(selected.minAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('cbTariffs.maxAmount')}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatUZS(selected.maxAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('cbTariffs.duration')}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{selected.months} months</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('cbTariffs.minScore')}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{selected.minScore}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('cbTariffs.submitted')}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{selected.createdAt}</p>
              </div>
              {selected.approvedAt && (
                <div>
                  <p className="text-xs text-gray-500">{t('cbTariffs.approvedAt')}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{selected.approvedAt}</p>
                </div>
              )}
            </div>

            {selected.status === 'PENDING' && (
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <Button
                  variant="primary"
                  color="emerald"
                  className="flex-1"
                  onClick={() => approve(selected.id)}
                >
                  {t('cbTariffs.approveTariff')}
                </Button>
                <Button
                  variant="primary"
                  color="red"
                  className="flex-1"
                  onClick={() => reject(selected.id)}
                >
                  {t('cbTariffs.rejectTariff')}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
