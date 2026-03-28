import { useState, useEffect } from 'react'
import { CheckCircleIcon, XCircleIcon, PhotoIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import { statusBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import ApplicationItemsCell from '../../components/ui/ApplicationItemsCell'
import FraudGateBadge from '../../components/ui/FraudGateBadge'
import ScoreFactorBars from '../../components/ui/ScoreFactorBars'
import ScoreGauge from '../../components/merchant/ScoreGauge'
import { Application } from '../../types'
import { apiApplications } from '../../api'
import { formatUZS, maskPassport } from '../../utils/format'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'text-emerald-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'
  const bg    = score >= 70 ? 'bg-emerald-500'   : score >= 50 ? 'bg-yellow-500'   : 'bg-red-500'
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
type DetailTab = 'overview' | 'products' | 'score' | 'verification'

const PAGE_SIZE = 10

export default function MFOApplications() {
  const [applications, setApplications] = useState<Application[]>([])
  const [tab, setTab] = useState<TabFilter>('ALL')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [confirmApp, setConfirmApp] = useState<{ app: Application; action: 'approve' | 'reject' | 'partial' } | null>(null)
  const [detailApp, setDetailApp] = useState<Application | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('overview')
  const [overrideReason, setOverrideReason] = useState('')
  const [deciding, setDeciding] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    apiApplications.list(page, PAGE_SIZE).then(res => {
      setApplications(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
    }).catch(() => {})
  }, [page])

  // When opening detail, fetch full version (with score_breakdown)
  const openDetail = (app: Application) => {
    setDetailApp(app)
    setDetailTab('overview')
    apiApplications.get(app.id)
      .then(full => setDetailApp(full))
      .catch(() => {}) // keep partial data if detail fetch fails
  }

  const filtered = applications.filter(a => tab === 'ALL' || a.status === tab)
  const paginated = filtered

  const changeTab = (t: TabFilter) => { setTab(t); setPage(1) }

  const tabs: TabFilter[] = ['ALL', 'PENDING', 'APPROVED', 'PARTIAL', 'REJECTED', 'ACTIVE']
  const counts: Record<TabFilter, number> = {
    ALL:      applications.length,
    PENDING:  applications.filter(a => a.status === 'PENDING').length,
    APPROVED: applications.filter(a => a.status === 'APPROVED').length,
    PARTIAL:  applications.filter(a => a.status === 'PARTIAL').length,
    REJECTED: applications.filter(a => a.status === 'REJECTED').length,
    ACTIVE:   applications.filter(a => a.status === 'ACTIVE').length,
  }

  const executeAction = () => {
    if (!confirmApp) return
    const { app, action } = confirmApp
    const body: Record<string, unknown> = {
      action: action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'PARTIAL',
    }
    if (overrideReason.trim()) body.override_reason = overrideReason.trim()

    setDeciding(true)
    apiApplications.decide(app.id, body)
      .then(updated => {
        setApplications(prev => prev.map(a => a.id === app.id ? updated : a))
        setConfirmApp(null)
        setOverrideReason('')
      })
      .catch(() => {
        // Optimistic fallback
        setApplications(prev => prev.map(a =>
          a.id === app.id
            ? { ...a, status: body.action as Application['status'], decidedAt: new Date().toISOString().split('T')[0] }
            : a
        ))
        setConfirmApp(null)
        setOverrideReason('')
      })
      .finally(() => setDeciding(false))
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Tab bar */}
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

      {/* Main table */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {[
                  t('applications.colClient'), 'Passport',
                  t('applications.colMerchant'), 'Items',
                  t('applications.colAmount'), 'MFO / Tariff',
                  t('applications.colMonths'), t('applications.colMonthly'),
                  t('applications.colScore'), 'Fraud',
                  t('applications.colStatus'), t('applications.colDate'),
                  t('applications.colActions'),
                ].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-sm text-gray-400">
                    {t('applications.noApplications')}
                  </td>
                </tr>
              ) : paginated.map(app => (
                <tr
                  key={app.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => openDetail(app)}
                >
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{app.client.fullName}</td>
                  <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap font-mono text-xs">{maskPassport(app.client.passportNumber)}</td>
                  <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{app.merchantName}</td>
                  <td className="px-3 py-3"><ApplicationItemsCell items={app.items} /></td>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{formatUZS(app.totalAmount)}</td>
                  <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">
                    <span>{app.mfoName ?? '—'}</span>
                    {app.tariffName && <span className="block text-xs text-gray-400">{app.tariffName}</span>}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600">{app.months ? `${app.months}mo` : '—'}</td>
                  <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">{app.monthlyPayment ? formatUZS(app.monthlyPayment) : '—'}</td>
                  <td className="px-3 py-3"><ScoreBar score={app.score} /></td>
                  <td className="px-3 py-3"><FraudGateBadge gate={app.fraudGate} /></td>
                  <td className="px-3 py-3">{statusBadge(app.status)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{app.createdAt?.split('T')[0]}</td>
                  <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                    {app.status === 'PENDING' && (
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => { setConfirmApp({ app, action: 'approve' }); setOverrideReason('') }}
                            className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                            {t('applications.approve')}
                          </button>
                          <button
                            onClick={() => { setConfirmApp({ app, action: 'reject' }); setOverrideReason('') }}
                            className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                          >
                            <XCircleIcon className="h-3.5 w-3.5" />
                            {t('applications.reject')}
                          </button>
                        </div>
                        <button
                          onClick={() => { setConfirmApp({ app, action: 'partial' }); setOverrideReason('') }}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-gray-500">
            {t('common.showing', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, total), total })}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              {t('common.previous')}
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .reduce<(number | '…')[]>((acc, n, idx, arr) => {
                if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…')
                acc.push(n); return acc
              }, [])
              .map((n, i) => n === '…'
                ? <span key={`e-${i}`} className="px-2 text-gray-400 text-sm">…</span>
                : <button key={n} onClick={() => setPage(n as number)}
                    className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium',
                      page === n ? 'bg-emerald-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50')}
                  >{n}</button>
              )}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm Decision Modal ──────────────────────────────────────────── */}
      <Modal
        open={!!confirmApp}
        onClose={() => { setConfirmApp(null); setOverrideReason('') }}
        title={confirmApp?.action === 'approve' ? t('applications.approveTitle') : confirmApp?.action === 'partial' ? t('applications.partialTitle') : t('applications.rejectTitle')}
        size="md"
      >
        {confirmApp && (
          <div className="space-y-5">
            <div className="rounded-xl bg-gray-50 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('applications.colClient')}</span>
                <span className="font-medium">{confirmApp.app.client.fullName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Items</span>
                <span className="font-medium text-right max-w-xs">
                  {confirmApp.app.items.map(i => `${i.productName} ×${i.quantity}`).join(', ') || '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('applications.totalAmount')}</span>
                <span className="font-medium">{formatUZS(confirmApp.app.totalAmount)}</span>
              </div>
              {confirmApp.app.monthlyPayment != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('applications.monthlyPayment')}</span>
                  <span className="font-medium">{formatUZS(confirmApp.app.monthlyPayment)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('applications.creditScore')}</span>
                <span className={clsx('font-bold',
                  confirmApp.app.score >= 70 ? 'text-emerald-600' :
                  confirmApp.app.score >= 50 ? 'text-yellow-600' : 'text-red-600')}>
                  {confirmApp.app.score}/100
                </span>
              </div>
            </div>

            {confirmApp.action === 'partial' && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-700">
                {t('applications.partialNote')}
              </div>
            )}

            {/* Override reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Override Reason
                {confirmApp.action !== 'reject' && <span className="text-gray-400 font-normal ml-1">(optional)</span>}
              </label>
              <textarea
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                rows={2}
                placeholder="Add a note or reason for this decision…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <Button variant="secondary" color="gray" className="flex-1" onClick={() => { setConfirmApp(null); setOverrideReason('') }}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                color={confirmApp.action === 'approve' ? 'emerald' : confirmApp.action === 'partial' ? 'gray' : 'red'}
                className={clsx('flex-1', confirmApp.action === 'partial' && 'bg-yellow-500 hover:bg-yellow-600 text-white')}
                onClick={executeAction}
                disabled={deciding || (confirmApp.action === 'reject' && !overrideReason.trim())}
              >
                {deciding ? t('common.saving') :
                  confirmApp.action === 'approve' ? t('applications.confirmApproval') :
                  confirmApp.action === 'partial' ? t('applications.confirmPartial') :
                  t('applications.confirmRejection')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Detail Modal ────────────────────────────────────────────────────── */}
      <Modal open={!!detailApp} onClose={() => setDetailApp(null)} title="Application Details" size="xl">
        {detailApp && (
          <div className="space-y-4">
            {/* Tab bar */}
            <div className="flex gap-1 border-b border-gray-100 pb-0">
              {(['overview', 'products', 'score', 'verification'] as DetailTab[]).map(dt => (
                <button
                  key={dt}
                  onClick={() => setDetailTab(dt)}
                  className={clsx(
                    'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                    detailTab === dt
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}
                >
                  {dt === 'overview' ? 'Overview' :
                   dt === 'products' ? `Products (${detailApp.items.length})` :
                   dt === 'score'    ? 'Score Breakdown' :
                   'Verification'}
                </button>
              ))}
            </div>

            {/* ── TAB: Overview ─────────────────────────────────────────────── */}
            {detailTab === 'overview' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Left column */}
                <div className="space-y-5">
                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Client Information</h3>
                    <div className="space-y-2">
                      {[
                        ['Full Name',        detailApp.client.fullName || '—'],
                        ['Passport',         maskPassport(detailApp.client.passportNumber)],
                        ['Phone',            detailApp.client.phone || '—'],
                        ['Age',              detailApp.client.age ? `${detailApp.client.age} years` : '—'],
                        ['Employment',       detailApp.client.employmentType],
                        ['Monthly Income',   detailApp.client.monthlyIncome ? formatUZS(detailApp.client.monthlyIncome) : '—'],
                        ['PINFL',            detailApp.client.pinfl ?? '—'],
                        ['Open Loans',       String(detailApp.client.openLoans)],
                        ['Overdue Days',     String(detailApp.client.overdueDays)],
                        ['Bankruptcy',       detailApp.client.hasBankruptcy ? 'Yes' : 'No'],
                        ['Credit History',   detailApp.client.creditHistory],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-500 shrink-0">{label}</span>
                          <span className="font-medium text-right ml-4 text-gray-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Application</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Status</span>
                        <span>{statusBadge(detailApp.status)}</span>
                      </div>
                      {[
                        ['Merchant',   detailApp.merchantName],
                        ['Submitted',  detailApp.createdAt?.split('T')[0] ?? '—'],
                        ['Decided',    detailApp.decidedAt?.split('T')[0] ?? '—'],
                        ['Decided By', detailApp.decidedBy ?? '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-500">{label}</span>
                          <span className="font-medium text-gray-900">{value}</span>
                        </div>
                      ))}
                      {detailApp.overrideReason && (
                        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 mt-2">
                          <p className="text-xs font-semibold text-yellow-800 mb-1">Override Reason</p>
                          <p className="text-xs text-yellow-700">{detailApp.overrideReason}</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* Right column */}
                <div className="space-y-5">
                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Financial Summary</h3>
                    <div className="space-y-2">
                      {[
                        ['Total Amount',    formatUZS(detailApp.totalAmount)],
                        ['Down Payment',    formatUZS(detailApp.downPaymentAmount)],
                        ['Financed Amount', formatUZS(detailApp.financedAmount)],
                        ['MFO',            detailApp.mfoName ?? '—'],
                        ['Tariff',         detailApp.tariffName ?? '—'],
                        ['Duration',       detailApp.months ? `${detailApp.months} months` : '—'],
                        ['Monthly Payment',detailApp.monthlyPayment ? formatUZS(detailApp.monthlyPayment) : '—'],
                        ['Approved Amount',detailApp.approvedAmount ? formatUZS(detailApp.approvedAmount) : '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-500 shrink-0">{label}</span>
                          <span className="font-medium text-gray-900 text-right ml-4">{value}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Fraud Check</h3>
                    <div className="flex items-center gap-2 mb-3">
                      <FraudGateBadge gate={detailApp.fraudGate} />
                    </div>
                    {detailApp.fraudSignals.length > 0 ? (
                      <div className="space-y-2">
                        {detailApp.fraudSignals.map(sig => (
                          <div key={sig.code} className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2">
                            <span className={clsx(
                              'mt-0.5 h-2 w-2 rounded-full shrink-0',
                              sig.severity === 'block' ? 'bg-red-500' :
                              sig.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-400'
                            )} />
                            <div>
                              <p className="text-xs font-semibold text-gray-800">{sig.code}</p>
                              <p className="text-xs text-gray-500">{sig.description}</p>
                              <p className="text-xs text-gray-400">Score impact: {sig.score_impact}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No fraud signals detected</p>
                    )}
                  </section>
                </div>
              </div>
            )}

            {/* ── TAB: Products ──────────────────────────────────────────────── */}
            {detailTab === 'products' && (
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Product Name', 'Category', 'Unit Price', 'Qty', 'Subtotal'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {detailApp.items.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.productName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.category || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatUZS(item.price)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">{formatUZS(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">
                        {formatUZS(detailApp.items.reduce((s, i) => s + i.subtotal, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* ── TAB: Score Breakdown ───────────────────────────────────────── */}
            {detailTab === 'score' && (
              detailApp.scoreBreakdown == null ? (
                <div className="py-12 text-center text-sm text-gray-400">Score data not available</div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <ScoreGauge score={detailApp.scoreBreakdown.total_score} size={160} />
                    <div className="flex-1 space-y-2">
                      <div className={clsx(
                        'inline-flex rounded-full px-4 py-1.5 text-sm font-bold',
                        detailApp.scoreBreakdown.decision === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                        detailApp.scoreBreakdown.decision === 'PARTIAL'  ? 'bg-yellow-100 text-yellow-700'  :
                        'bg-red-100 text-red-700'
                      )}>
                        {detailApp.scoreBreakdown.decision === 'APPROVED' ? '✓ APPROVED' :
                         detailApp.scoreBreakdown.decision === 'PARTIAL'  ? '⚠ PARTIAL APPROVAL' :
                         '✗ REJECTED'}
                      </div>
                      {detailApp.scoreBreakdown.hard_reject && (
                        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-xs font-semibold text-red-700">Hard Reject: {detailApp.scoreBreakdown.hard_reject_reason}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <ScoreFactorBars breakdown={detailApp.scoreBreakdown} />

                  {detailApp.scoreBreakdown.reason_codes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {detailApp.scoreBreakdown.reason_codes.map(code => (
                        <span key={code} className="rounded-full bg-gray-100 text-gray-500 px-2.5 py-0.5 text-xs">{code}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}

            {/* ── TAB: Verification ──────────────────────────────────────────── */}
            {detailTab === 'verification' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Face photo */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Face Verification Photo</h3>
                  <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center" style={{ height: 200 }}>
                    {detailApp.faceImageUrl ? (
                      <img
                        src={detailApp.faceImageUrl}
                        alt="Face verification"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-400 space-y-2">
                        <PhotoIcon className="h-10 w-10 mx-auto text-gray-300" />
                        <p className="text-xs">No face image on file</p>
                      </div>
                    )}
                  </div>
                  {detailApp.faceImageUrl && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                      <CheckCircleIcon className="h-4 w-4" />
                      Identity verified
                    </div>
                  )}
                </div>

                {/* Signature */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Client Signature</h3>
                  <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center" style={{ height: 200 }}>
                    {detailApp.signatureUrl ? (
                      <img
                        src={detailApp.signatureUrl}
                        alt="Client signature"
                        className="w-full h-full object-contain p-4"
                      />
                    ) : (
                      <div className="text-center text-gray-400 space-y-2">
                        <PencilSquareIcon className="h-10 w-10 mx-auto text-gray-300" />
                        <p className="text-xs">No signature on file</p>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    Captured: {detailApp.createdAt?.split('T')[0] ?? '—'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
