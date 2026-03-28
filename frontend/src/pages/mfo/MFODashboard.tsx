import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  UserGroupIcon, DocumentCheckIcon, BanknotesIcon, ClockIcon,
  ChartBarIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import StatCard from '../../components/ui/StatCard'
import { statusBadge } from '../../components/ui/Badge'
import { Application } from '../../types'
import { apiDashboard, apiApplications } from '../../api'
import { useTranslation } from 'react-i18next'
import { MFODashboardSkeleton } from '../../components/ui/Skeleton'

function formatUZS(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M UZS'
  return n.toLocaleString() + ' UZS'
}

export default function MFODashboard() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalMerchants: 0,
    pendingApplications: 0,
    approvedThisMonth: 0,
    totalTurnover: 0,
    unpaidAmount: 0,
    monthlyTrend: [] as { month: string; applications: number }[],
  })
  const [recentApps, setRecentApps] = useState<Application[]>([])

  useEffect(() => {
    Promise.all([
      apiDashboard.mfo().catch(() => null),
      apiApplications.list().catch(() => [] as Application[]),
    ]).then(([d, apps]) => {
      if (d) setStats({
        totalMerchants: d.totalMerchants,
        pendingApplications: d.pendingApplications,
        approvedThisMonth: d.approvedThisMonth,
        totalTurnover: d.totalTurnover,
        unpaidAmount: d.unpaidAmount,
        monthlyTrend: d.monthlyTrend,
      })
      setRecentApps(
        [...apps].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
      )
    }).finally(() => setLoading(false))
  }, [])

  const revenueEstimate = recentApps
    .filter(a => a.status === 'ACTIVE')
    .reduce((sum, a) => sum + (a.totalAmount ?? 0), 0)

  if (loading) return <MFODashboardSkeleton />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title={t('mfoDashboard.totalTurnover')}
          value={formatUZS(stats.totalTurnover)}
          subtitle={t('mfoDashboard.allContracts')}
          icon={<BanknotesIcon className="h-5 w-5" />}
          color="emerald"
        />
        <StatCard
          title={t('mfoDashboard.unpaid')}
          value={formatUZS(stats.unpaidAmount)}
          subtitle={t('mfoDashboard.unpaidSubtitle')}
          icon={<BanknotesIcon className="h-5 w-5" />}
          color="orange"
        />
        <StatCard
          title={t('mfoDashboard.pendingApps')}
          value={stats.pendingApplications}
          subtitle={t('mfoDashboard.awaitingReview')}
          icon={<ClockIcon className="h-5 w-5" />}
          color="orange"
        />
        <StatCard
          title={t('mfoDashboard.approvedMonth')}
          value={stats.approvedThisMonth}
          subtitle={t('mfoDashboard.activeApproved')}
          icon={<DocumentCheckIcon className="h-5 w-5" />}
          color="emerald"
          trend={12}
        />
        <StatCard
          title={t('mfoDashboard.interestRevenue')}
          value={formatUZS(revenueEstimate)}
          subtitle={t('mfoDashboard.fromActiveLoans')}
          icon={<BanknotesIcon className="h-5 w-5" />}
          color="emerald"
          trend={8}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl bg-white border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{t('mfoDashboard.monthlyApplications')}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{t('mfoDashboard.submittedVsApproved')}</p>
            </div>
            <ChartBarIcon className="h-5 w-5 text-emerald-400" />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.monthlyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="applications" name={t('mfoDashboard.submitted')} fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="approved" name={t('mfoDashboard.approved')} fill="#6ee7b7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">{t('mfoDashboard.quickActions')}</h2>
          <Link
            to="/mfo/tariffs"
            className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 p-4 hover:bg-emerald-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ChartBarIcon className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">{t('mfoDashboard.manageTariffs')}</p>
                <p className="text-xs text-emerald-600">{t('mfoDashboard.manageTariffsDesc')}</p>
              </div>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-emerald-500" />
          </Link>
          <Link
            to="/mfo/merchants"
            className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 p-4 hover:bg-emerald-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <UserGroupIcon className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">{t('mfoDashboard.manageMerchants')}</p>
                <p className="text-xs text-emerald-600">{t('mfoDashboard.manageMerchantsDesc')}</p>
              </div>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-emerald-500" />
          </Link>
          <Link
            to="/mfo/applications"
            className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 p-4 hover:bg-emerald-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <DocumentCheckIcon className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">{t('mfoDashboard.reviewApplications')}</p>
                <p className="text-xs text-emerald-600">{t('mfoDashboard.reviewApplicationsDesc', { count: stats.pendingApplications })}</p>
              </div>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-emerald-500" />
          </Link>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t('mfoDashboard.recentApplications')}</h2>
          <Link to="/mfo/applications" className="text-xs text-emerald-600 hover:underline">{t('common.viewAll')}</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-50">
            <thead className="bg-gray-50">
              <tr>
                {[t('common.client'), t('common.merchant'), t('common.product'), t('applications.totalAmount'), t('applications.colScore'), t('common.status'), t('common.date')].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentApps.map(app => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{app.client?.fullName ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{app.merchantName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-32 truncate">{app.items?.[0]?.productName ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatUZS(app.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-bold ${app.score >= 70 ? 'text-emerald-600' : app.score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {app.score}
                    </span>
                  </td>
                  <td className="px-4 py-3">{statusBadge(app.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{app.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
