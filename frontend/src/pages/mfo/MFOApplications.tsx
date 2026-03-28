import { useState, useEffect } from 'react'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { statusBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Application } from '../../types'
import { apiApplications } from '../../api'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { MFOApplicationsSkeleton } from '../../components/ui/Skeleton'

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

const PAGE_SIZE = 10

export default function MFOApplications() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabFilter>('ALL')
  const [page, setPage] = useState(1)
  const [confirmApp, setConfirmApp] = useState<{ app: Application; action: 'approve' | 'reject' | 'partial' } | null>(null)
  const [detailApp, setDetailApp] = useState<Application | null>(null)
  const [deciding, setDeciding] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    apiApplications.list().then(setApplications).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = applications.filter(a =>
    tab === 'ALL' || a.status === tab
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const changeTab = (t: TabFilter) => { setTab(t); setPage(1) }

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
    const body = action === 'approve'
      ? { action: 'APPROVED' }
      : action === 'reject'
      ? { action: 'REJECTED' }
      : { action: 'PARTIAL' }

    setDeciding(true)
    apiApplications.decide(app.id, body)
      .then(updated => {
        setApplications(prev => prev.map(a => a.id === app.id ? updated : a))
        setConfirmApp(null)
      })
      .catch(() => {
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
      })
      .finally(() => setDeciding(false))
  }

  if (loading) return <MFOApplicationsSkeleton />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {tabs.map(tabKey => (
          <button
            key={tabKey}
            onClick={() => changeTab(tabKey)}
            className={clsx(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              tab === tabKey ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {t(`applications.tabs.${tabKey}`)} ({counts[tabKey]})
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {[
                  t('applications.colClient'), t('applications.colMerchant'), t('applications.colProduct'),
                  t('applications.colAmount'), t('applications.colTariff'), t('applications.colMonths'),
                  t('applications.colMonthly'), t('applications.colScore'), t('applications.colStatus'),
                  t('applications.colDate'), t('applications.colActions'),
                ].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-gray-400">
                    {t('applications.noApplications')}
                  </td>
                </tr>
              ) : paginated.map(app => (
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
                            {t('applications.approve')}
                          </button>
                          <button
                            onClick={() => setConfirmApp({ app, action: 'reject' })}
                            className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                          >
                            <XCircleIcon className="h-3.5 w-3.5" />
                            {t('applications.reject')}
                          </button>
                        </div>
                        <button
                          onClick={() => setConfirmApp({ app, action: 'partial' })}
                          className="flex items-center gap-1 rounded-lg bg-yellow-50 px-2 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 w-full justify-center"
                        >
                          {t('applications.partial')}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-gray-500">
            {t('common.showing', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, filtered.length), total: filtered.length })}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('common.previous')}
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .reduce<(number | '…')[]>((acc, n, idx, arr) => {
                if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…')
                acc.push(n)
                return acc
              }, [])
              .map((n, i) =>
                n === '…' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n as number)}
                    className={clsx(
                      'rounded-lg px-3 py-1.5 text-sm font-medium',
                      page === n
                        ? 'bg-emerald-600 text-white'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {n}
                  </button>
                )
              )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      <Modal
        open={!!confirmApp}
        onClose={() => setConfirmApp(null)}
        title={confirmApp?.action === 'approve' ? t('applications.approveTitle') : confirmApp?.action === 'partial' ? t('applications.partialTitle') : t('applications.rejectTitle')}
        size="md"
      >
        {confirmApp && (
          <div className="space-y-5">
            <div className="rounded-xl bg-gray-50 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('applications.colClient')}</span>
                <span className="font-medium">{confirmApp.app.clientName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('applications.colProduct')}</span>
                <span className="font-medium">{confirmApp.app.productName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('applications.totalAmount')}</span>
                <span className="font-medium">{formatUZS(confirmApp.app.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('applications.monthlyPayment')}</span>
                <span className="font-medium">{formatUZS(confirmApp.app.monthlyPayment)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('applications.creditScore')}</span>
                <span className={clsx('font-bold', confirmApp.app.score >= 70 ? 'text-emerald-600' : confirmApp.app.score >= 50 ? 'text-yellow-600' : 'text-red-600')}>
                  {confirmApp.app.score}/100
                </span>
              </div>
            </div>

            {confirmApp.action === 'partial' && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-700">
                {t('applications.partialNote')}
              </div>
            )}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <Button variant="secondary" color="gray" className="flex-1" onClick={() => setConfirmApp(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                color={confirmApp.action === 'approve' ? 'emerald' : confirmApp.action === 'partial' ? 'gray' : 'red'}
                className={clsx('flex-1', confirmApp.action === 'partial' && 'bg-yellow-500 hover:bg-yellow-600 text-white')}
                onClick={executeAction}
                disabled={deciding}
              >
                {deciding ? t('common.saving') : confirmApp.action === 'approve' ? t('applications.confirmApproval') : confirmApp.action === 'partial' ? t('applications.confirmPartial') : t('applications.confirmRejection')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!detailApp} onClose={() => setDetailApp(null)} title={t('applications.appDetails')} size="lg">
        {detailApp && (
          <div className="grid grid-cols-2 gap-4">
            {[
              [t('common.client'), detailApp.clientName],
              [t('common.phone'), detailApp.clientPhone],
              [t('common.merchant'), detailApp.merchantName],
              [t('common.product'), detailApp.productName],
              [t('applications.productPrice'), formatUZS(detailApp.productPrice)],
              [t('applications.totalAmount'), formatUZS(detailApp.totalAmount)],
              [t('applications.tariff'), detailApp.tariffName],
              [t('applications.duration'), `${detailApp.months} months`],
              [t('applications.monthlyPayment'), formatUZS(detailApp.monthlyPayment)],
              [t('applications.creditScore'), String(detailApp.score)],
              [t('common.status'), detailApp.status],
              ...(detailApp.approvedAmount ? [[t('applications.approvedAmount'), formatUZS(detailApp.approvedAmount)]] : []),
              [t('applications.submittedAt'), detailApp.createdAt],
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
