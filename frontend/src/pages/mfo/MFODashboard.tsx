import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  UserGroupIcon, DocumentCheckIcon, BanknotesIcon, ClockIcon,
  ChartBarIcon, ArrowRightIcon, SparklesIcon,
} from '@heroicons/react/24/outline'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line,
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
  const [forecast, setForecast] = useState<{
    monthlyHistory: { month: string; revenue: number; approved: number }[]
    projections: { month: string; projectedRevenue: number }[]
    aiInsight: string
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
    riskReason: string
  } | null>(null)
  const [forecastLoading, setForecastLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiDashboard.mfo().then(d => setStats({
        totalMerchants: d.totalMerchants,
        pendingApplications: d.pendingApplications,
        approvedThisMonth: d.approvedThisMonth,
        totalTurnover: d.totalTurnover,
        unpaidAmount: d.unpaidAmount,
        monthlyTrend: d.monthlyTrend,
      })),
      apiApplications.list(1, 5).then(res => setRecentApps(res.items)),
    ]).catch(() => {}).finally(() => setLoading(false))

    apiDashboard.mfoForecast()
      .then(d => setForecast(d))
      .catch(() => {})
      .finally(() => setForecastLoading(false))
  }, [])

  const revenueEstimate = recentApps
    .filter(a => a.status === 'ACTIVE')
    .reduce((sum, a) => sum + (a.totalAmount ?? 0), 0)

  if (loading) return <MFODashboardSkeleton />

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
        <div className="lg:col-span-2 rounded-2xl bg-white shadow-card p-5">
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

      {/* AI Revenue Forecast */}
      <div className="rounded-2xl bg-white shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-emerald-500" />
            <h2 className="text-base font-semibold text-gray-900">AI Revenue Forecast</h2>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full">Next 3 months</span>
        </div>
        <div className="p-5">
          {forecastLoading ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">Loading forecast...</div>
          ) : forecast ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {forecast.projections.map((p) => (
                  <div key={p.month} className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
                    <p className="text-xs text-emerald-600 font-medium">{p.month}</p>
                    <p className="text-base font-bold text-emerald-900 mt-1">{formatUZS(p.projectedRevenue)}</p>
                    <p className="text-xs text-emerald-500 mt-0.5">projected</p>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={(() => {
                    const hist = forecast.monthlyHistory.map(h => ({ month: h.month, historical: h.revenue, projected: null }))
                    const lastHistRevenue = hist.length > 0 ? hist[hist.length - 1].historical : 0
                    const proj = forecast.projections.map((p, i) => ({
                      month: p.month,
                      historical: null,
                      projected: p.projectedRevenue,
                      ...(i === 0 ? { historical: lastHistRevenue } : {}),
                    }))
                    return [...hist, ...proj]
                  })()}
                  margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + 'M' : String(v)} />
                  <Tooltip formatter={(value: number) => formatUZS(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="historical" name="Historical" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="projected" name="Projected" stroke="#6ee7b7" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <div className="rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">AI Forecast Insight</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    forecast.riskLevel === 'LOW' ? 'bg-emerald-100 text-emerald-700' :
                    forecast.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {forecast.riskLevel} RISK
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{forecast.aiInsight}</p>
                {forecast.riskReason && (
                  <p className="text-xs text-gray-500 italic border-t border-emerald-100 pt-2">{forecast.riskReason}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">Forecast unavailable</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('mfoDashboard.recentApplications')}</h2>
          <Link to="/mfo/applications" className="text-xs text-emerald-600 hover:underline">{t('common.viewAll')}</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                {[t('common.client'), t('common.merchant'), t('common.product'), t('applications.totalAmount'), t('applications.colScore'), t('common.status'), t('common.date')].map(h => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentApps.map(app => (
                <tr key={app.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{app.client?.fullName ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{app.merchantName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-32 truncate">{app.items?.[0]?.productName ?? '—'}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatUZS(app.totalAmount)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-bold ${app.score >= 70 ? 'text-emerald-600' : app.score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {app.score}
                    </span>
                  </td>
                  <td className="px-6 py-4">{statusBadge(app.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{app.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
