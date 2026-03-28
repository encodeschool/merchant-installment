import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BuildingLibraryIcon, DocumentCheckIcon, BanknotesIcon,
  ExclamationTriangleIcon, ChartBarIcon,
} from '@heroicons/react/24/outline'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import StatCard from '../../components/ui/StatCard'
import { statusBadge } from '../../components/ui/Badge'
import { apiDashboard } from '../../api'
import { MFOStats } from '../../types'
import { useTranslation } from 'react-i18next'
import { CBDashboardSkeleton } from '../../components/ui/Skeleton'

function formatUZS(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B UZS'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M UZS'
  return n.toLocaleString() + ' UZS'
}

export default function CBDashboard() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalMFOs: 0,
    totalApplications: 0,
    totalDisbursed: 0,
    avgDefaultRate: 0,
    monthlyTrend: [] as { month: string; applications: number }[],
  })
  const [pendingTariffs, setPendingTariffs] = useState(0)
  const [mfoList, setMfoList] = useState<MFOStats[]>([])

  useEffect(() => {
    Promise.all([
      apiDashboard.cb().catch(() => null),
      apiDashboard.mfoList().catch(() => [] as MFOStats[]),
    ]).then(([d, list]) => {
      if (d) setStats({
        totalMFOs: d.totalMFOs,
        totalApplications: d.totalApplications,
        totalDisbursed: d.totalDisbursed,
        avgDefaultRate: d.avgDefaultRate,
        monthlyTrend: d.monthlyTrend,
      })
      setMfoList(list)
      setPendingTariffs(0)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <CBDashboardSkeleton />

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('cbDashboard.totalMFOs')}
          value={stats.totalMFOs}
          subtitle={t('cbDashboard.activeCount', { count: mfoList.filter(m => m.status === 'ACTIVE').length })}
          icon={<BuildingLibraryIcon className="h-5 w-5" />}
          color="purple"
          trend={0}
        />
        <StatCard
          title={t('cbDashboard.totalApplications')}
          value={stats.totalApplications.toLocaleString()}
          subtitle={t('cbDashboard.allMFOsCombined')}
          icon={<DocumentCheckIcon className="h-5 w-5" />}
          color="purple"
          trend={12}
        />
        <StatCard
          title={t('cbDashboard.totalDisbursed')}
          value={formatUZS(stats.totalDisbursed)}
          subtitle={t('cbDashboard.allTime')}
          icon={<BanknotesIcon className="h-5 w-5" />}
          color="purple"
          trend={8}
        />
        <StatCard
          title={t('cbDashboard.avgDefaultRate')}
          value={`${stats.avgDefaultRate}%`}
          subtitle={t('cbDashboard.acrossAllMFOs')}
          icon={<ExclamationTriangleIcon className="h-5 w-5" />}
          color="red"
          trend={-0.3}
        />
      </div>

      {pendingTariffs > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-yellow-50 border border-yellow-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">
                {t('cbDashboard.awaitingApproval_other', { count: pendingTariffs })}
              </p>
              <p className="text-xs text-yellow-600 mt-0.5">{t('cbDashboard.reviewPendingNote')}</p>
            </div>
          </div>
          <Link
            to="/cb/tariffs"
            className="shrink-0 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 transition-colors"
          >
            {t('cbDashboard.reviewNow')}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-white shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{t('cbDashboard.applicationTrend')}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{t('cbDashboard.last6Months')}</p>
            </div>
            <ChartBarIcon className="h-5 w-5 text-purple-400" />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={stats.monthlyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9333ea" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="applications" name={t('cbDashboard.applications')} stroke="#9333ea" fill="url(#colorApps)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-white shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('cbDashboard.mfoSummary')}</h2>
            <Link to="/cb/mfo" className="text-xs text-purple-600 hover:underline">{t('common.viewAll')}</Link>
          </div>
          <div className="space-y-3">
            {mfoList.map((mfo) => (
              <div key={mfo.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{mfo.name}</p>
                  <p className="text-xs text-gray-500">{t('cbDashboard.appsApproved', { apps: mfo.totalApplications.toLocaleString(), rate: mfo.approvalRate })}</p>
                </div>
                <div className="ml-2 shrink-0">
                  {statusBadge(mfo.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/cb/tariffs"
          className="flex items-center gap-3 rounded-xl bg-purple-50 border border-purple-100 p-4 hover:bg-purple-100 transition-colors"
        >
          <DocumentCheckIcon className="h-6 w-6 text-purple-600" />
          <div>
            <p className="text-sm font-semibold text-purple-900">{t('cbDashboard.tariffApprovals')}</p>
            <p className="text-xs text-purple-600">{t('cbDashboard.pending', { count: pendingTariffs })}</p>
          </div>
        </Link>
        <Link
          to="/cb/mfo"
          className="flex items-center gap-3 rounded-xl bg-purple-50 border border-purple-100 p-4 hover:bg-purple-100 transition-colors"
        >
          <BuildingLibraryIcon className="h-6 w-6 text-purple-600" />
          <div>
            <p className="text-sm font-semibold text-purple-900">{t('cbDashboard.mfoMonitoring')}</p>
            <p className="text-xs text-purple-600">{t('cbDashboard.registeredMFOs', { count: stats.totalMFOs })}</p>
          </div>
        </Link>
        <Link
          to="/cb/audit"
          className="flex items-center gap-3 rounded-xl bg-purple-50 border border-purple-100 p-4 hover:bg-purple-100 transition-colors"
        >
          <ChartBarIcon className="h-6 w-6 text-purple-600" />
          <div>
            <p className="text-sm font-semibold text-purple-900">{t('cbDashboard.auditLogs')}</p>
            <p className="text-xs text-purple-600">{t('cbDashboard.fullActivity')}</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
