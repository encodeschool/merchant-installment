import { useState } from 'react'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { statusBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { mockApplications } from '../../data/mockData'
import { Application } from '../../types'
import clsx from 'clsx'

function formatUZS(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M UZS'
  return n.toLocaleString() + ' UZS'
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'text-emerald-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'
  const bg = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 bg-gray-100 rounded-full h-1.5">
        <div className={clsx('h-1.5 rounded-full', bg)} style={{ width: `${score}%` }} />
      </div>
      <span className={clsx('text-sm font-bold', color)}>{score}</span>
    </div>
  )
}

type TabFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'ACTIVE'

export default function MFOApplications() {
  const [applications, setApplications] = useState<Application[]>(mockApplications)
  const [tab, setTab] = useState<TabFilter>('ALL')
  const [confirmApp, setConfirmApp] = useState<{ app: Application; action: 'approve' | 'reject' | 'partial' } | null>(null)
  const [detailApp, setDetailApp] = useState<Application | null>(null)

  const filtered = applications.filter(a =>
    tab === 'ALL' || a.status === tab
  )

  const tabs: TabFilter[] = ['ALL', 'PENDING', 'APPROVED', 'PARTIAL', 'REJECTED', 'ACTIVE']
  const counts: Record<TabFilter, number> = {
    ALL: applications.length,
    PENDING: applications.filter(a => a.status === 'PENDING').length,
    APPROVED: applications.filter(a => a.status === 'APPROVED').length,
    PARTIAL: applications.filter(a => a.status === 'PARTIAL').length,
    REJECTED: applications.filter(a => a.status === 'REJECTED').length,
    ACTIVE: applications.filter(a => a.status === 'ACTIVE').length,
  }

  const executeAction = () => {
    if (!confirmApp) return
    const { app, action } = confirmApp
    const approvedAmount = action === 'partial'
      ? Math.round(app.productPrice * 0.70)
      : undefined
    setApplications(prev => prev.map(a =>
      a.id === app.id
        ? {
          ...a,
          status: action === 'approve' ? 'APPROVED' as const : action === 'partial' ? 'PARTIAL' as const : 'REJECTED' as const,
          approvedAmount,
          decidedAt: new Date().toISOString().split('T')[0],
        }
        : a
    ))
    setConfirmApp(null)
  }

  const scoreBreakdown = (_app: Application) => {
    const incomeScore = 20
    const creditScore = 20
    const ageScore = 20
    const tariffScore = 20
    return [
      { label: 'Income Score', weight: '30%', value: incomeScore, max: 30 },
      { label: 'Credit History', weight: '30%', value: creditScore, max: 30 },
      { label: 'Age Factor', weight: '20%', value: ageScore, max: 20 },
      { label: 'Tariff Match', weight: '20%', value: tariffScore, max: 20 },
    ]
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              tab === t ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-600 hover:text-gray-900'
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
                {['Client', 'Merchant', 'Product', 'Amount', 'Tariff', 'Months', 'Monthly', 'Score', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-gray-400">
                    No applications found.
                  </td>
                </tr>
              ) : filtered.map(app => (
                <tr
                  key={app.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setDetailApp(app)}
                >
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{app.clientName}</td>
                  <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{app.merchantName}</td>
                  <td className="px-3 py-3 text-sm text-gray-600 max-w-28 truncate">{app.productName}</td>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{formatUZS(app.totalAmount)}</td>
                  <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{app.tariffName}</td>
                  <td className="px-3 py-3 text-sm text-gray-600">{app.months}mo</td>
                  <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">{formatUZS(app.monthlyPayment)}</td>
                  <td className="px-3 py-3"><ScoreBar score={app.score} /></td>
                  <td className="px-3 py-3">{statusBadge(app.status)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{app.createdAt}</td>
                  <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                    {app.status === 'PENDING' && (
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setConfirmApp({ app, action: 'approve' })}
                            className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => setConfirmApp({ app, action: 'reject' })}
                            className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                          >
                            <XCircleIcon className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                        <button
                          onClick={() => setConfirmApp({ app, action: 'partial' })}
                          className="flex items-center gap-1 rounded-lg bg-yellow-50 px-2 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 w-full justify-center"
                        >
                          Partial (70%)
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

      {/* Confirm Action Modal */}
      <Modal
        open={!!confirmApp}
        onClose={() => setConfirmApp(null)}
        title={confirmApp?.action === 'approve' ? 'Approve Application' : confirmApp?.action === 'partial' ? 'Partial Approval' : 'Reject Application'}
        size="md"
      >
        {confirmApp && (
          <div className="space-y-5">
            <div className="rounded-xl bg-gray-50 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Client</span>
                <span className="font-medium">{confirmApp.app.clientName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Product</span>
                <span className="font-medium">{confirmApp.app.productName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Amount</span>
                <span className="font-medium">{formatUZS(confirmApp.app.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Monthly Payment</span>
                <span className="font-medium">{formatUZS(confirmApp.app.monthlyPayment)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Credit Score</span>
                <span className={clsx('font-bold', confirmApp.app.score >= 70 ? 'text-emerald-600' : confirmApp.app.score >= 50 ? 'text-yellow-600' : 'text-red-600')}>
                  {confirmApp.app.score}/100
                </span>
              </div>
            </div>

            {/* Score Breakdown */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Score Breakdown</p>
              <div className="space-y-2">
                {scoreBreakdown(confirmApp.app).map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="text-gray-400">({item.weight})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full"
                          style={{ width: `${(item.value / item.max) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{item.value}/{item.max}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {confirmApp.action === 'partial' && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-700">
                Client will be approved for <strong>70% of product price</strong> ({Math.round(confirmApp.app.productPrice * 0.70).toLocaleString()} UZS). Client covers the remaining 30% as additional down payment.
              </div>
            )}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <Button variant="secondary" color="gray" className="flex-1" onClick={() => setConfirmApp(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                color={confirmApp.action === 'approve' ? 'emerald' : confirmApp.action === 'partial' ? 'gray' : 'red'}
                className={clsx('flex-1', confirmApp.action === 'partial' && 'bg-yellow-500 hover:bg-yellow-600 text-white')}
                onClick={executeAction}
              >
                {confirmApp.action === 'approve' ? 'Confirm Approval' : confirmApp.action === 'partial' ? 'Confirm Partial' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailApp} onClose={() => setDetailApp(null)} title="Application Details" size="lg">
        {detailApp && (
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Client Name', detailApp.clientName],
              ['Phone', detailApp.clientPhone],
              ['Merchant', detailApp.merchantName],
              ['Product', detailApp.productName],
              ['Product Price', formatUZS(detailApp.productPrice)],
              ['Total Amount', formatUZS(detailApp.totalAmount)],
              ['Tariff', detailApp.tariffName],
              ['Duration', `${detailApp.months} months`],
              ['Monthly Payment', formatUZS(detailApp.monthlyPayment)],
              ['Credit Score', String(detailApp.score)],
              ['Status', detailApp.status],
              ...(detailApp.approvedAmount ? [['Approved Amount', formatUZS(detailApp.approvedAmount)]] : []),
              ['Submitted', detailApp.createdAt],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
