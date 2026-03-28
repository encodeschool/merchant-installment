import { useState } from 'react'
import { MagnifyingGlassIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { statusBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { mockTariffs } from '../../data/mockData'
import { Tariff } from '../../types'
import clsx from 'clsx'

function formatUZS(n: number): string {
  return n.toLocaleString() + ' UZS'
}

type FilterTab = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'

export default function CBTariffApprovals() {
  const [tariffs, setTariffs] = useState<Tariff[]>(mockTariffs)
  const [tab, setTab] = useState<FilterTab>('ALL')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Tariff | null>(null)

  const filtered = tariffs.filter(t => {
    const matchesTab = tab === 'ALL' || t.status === tab
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.mfoName.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  })

  const approve = (id: string) => {
    setTariffs(prev => prev.map(t => t.id === id
      ? { ...t, status: 'APPROVED' as const, approvedAt: new Date().toISOString().split('T')[0] }
      : t
    ))
    setSelected(null)
  }

  const reject = (id: string) => {
    setTariffs(prev => prev.map(t => t.id === id ? { ...t, status: 'REJECTED' as const } : t))
    setSelected(null)
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or MFO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-9 pr-4 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              tab === t ? 'bg-white shadow-sm text-purple-700' : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()} ({counts[t]})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'MFO', 'Rate %', 'Amount Range', 'Duration', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                    No tariffs found matching your criteria.
                  </td>
                </tr>
              ) : filtered.map(t => (
                <tr
                  key={t.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelected(t)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t.mfoName}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-semibold">{t.interestRate}%</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {(t.minAmount / 1_000_000).toFixed(1)}M – {(t.maxAmount / 1_000_000).toFixed(1)}M UZS
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t.minMonths}–{t.maxMonths} mo</td>
                  <td className="px-4 py-3">{statusBadge(t.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{t.createdAt}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {t.status === 'PENDING' && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => approve(t.id)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => reject(t.id)}
                          className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                        >
                          <XCircleIcon className="h-3.5 w-3.5" />
                          Reject
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

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Tariff Details" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Tariff Name</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{selected.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">MFO</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{selected.mfoName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Annual Interest Rate</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{selected.interestRate}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <div className="mt-0.5">{statusBadge(selected.status)}</div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Min Amount</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatUZS(selected.minAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Max Amount</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatUZS(selected.maxAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Min Duration</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{selected.minMonths} months</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Max Duration</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{selected.maxMonths} months</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Submitted</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{selected.createdAt}</p>
              </div>
              {selected.approvedAt && (
                <div>
                  <p className="text-xs text-gray-500">Approved</p>
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
                  Approve Tariff
                </Button>
                <Button
                  variant="primary"
                  color="red"
                  className="flex-1"
                  onClick={() => reject(selected.id)}
                >
                  Reject Tariff
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
