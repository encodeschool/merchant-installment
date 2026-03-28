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

function formatUZS(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B UZS'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M UZS'
  return n.toLocaleString() + ' UZS'
}

export default function CBDashboard() {
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
    apiDashboard.cb().then(d => setStats({
      totalMFOs: d.totalMFOs,
      totalApplications: d.totalApplications,
      totalDisbursed: d.totalDisbursed,
      avgDefaultRate: d.avgDefaultRate,
      monthlyTrend: d.monthlyTrend,
    })).catch(() => {})

    apiDashboard.mfoList().then(list => {
      setMfoList(list)
      setPendingTariffs(0)
    }).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total MFOs"
          value={stats.totalMFOs}
          subtitle={`${mfoList.filter(m => m.status === 'ACTIVE').length} active`}
          icon={<BuildingLibraryIcon className="h-5 w-5" />}
          color="purple"
          trend={0}
        />
        <StatCard
          title="Total Applications"
          value={stats.totalApplications.toLocaleString()}
          subtitle="All MFOs combined"
          icon={<DocumentCheckIcon className="h-5 w-5" />}
          color="purple"
          trend={12}
        />
        <StatCard
          title="Total Disbursed"
          value={formatUZS(stats.totalDisbursed)}
          subtitle="All time"
          icon={<BanknotesIcon className="h-5 w-5" />}
          color="purple"
          trend={8}
        />
        <StatCard
          title="Avg Default Rate"
          value={`${stats.avgDefaultRate}%`}
          subtitle="Across all MFOs"
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
                {pendingTariffs} tariff{pendingTariffs > 1 ? 's' : ''} awaiting approval
              </p>
              <p className="text-xs text-yellow-600 mt-0.5">Review and approve or reject pending tariff submissions</p>
            </div>
          </div>
          <Link
            to="/cb/tariffs"
            className="shrink-0 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 transition-colors"
          >
            Review Now
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl bg-white border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Application Trend</h2>
              <p className="text-xs text-gray-500 mt-0.5">Last 6 months — all MFOs</p>
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
                <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="applications" name="Applications" stroke="#9333ea" fill="url(#colorApps)" strokeWidth={2} />
              <Area type="monotone" dataKey="approved" name="Approved" stroke="#10b981" fill="url(#colorApproved)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl bg-white border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">MFO Summary</h2>
            <Link to="/cb/mfo" className="text-xs text-purple-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {mfoList.map((mfo) => (
              <div key={mfo.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{mfo.name}</p>
                  <p className="text-xs text-gray-500">{mfo.totalApplications.toLocaleString()} apps · {mfo.approvalRate}% approved</p>
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
            <p className="text-sm font-semibold text-purple-900">Tariff Approvals</p>
            <p className="text-xs text-purple-600">{pendingTariffs} pending</p>
          </div>
        </Link>
        <Link
          to="/cb/mfo"
          className="flex items-center gap-3 rounded-xl bg-purple-50 border border-purple-100 p-4 hover:bg-purple-100 transition-colors"
        >
          <BuildingLibraryIcon className="h-6 w-6 text-purple-600" />
          <div>
            <p className="text-sm font-semibold text-purple-900">MFO Monitoring</p>
            <p className="text-xs text-purple-600">{stats.totalMFOs} registered MFOs</p>
          </div>
        </Link>
        <Link
          to="/cb/audit"
          className="flex items-center gap-3 rounded-xl bg-purple-50 border border-purple-100 p-4 hover:bg-purple-100 transition-colors"
        >
          <ChartBarIcon className="h-6 w-6 text-purple-600" />
          <div>
            <p className="text-sm font-semibold text-purple-900">Audit Logs</p>
            <p className="text-xs text-purple-600">Full activity trail</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
