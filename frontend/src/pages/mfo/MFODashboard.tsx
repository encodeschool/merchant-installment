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
import { mockApplications, mockMerchants, mockMonthlyTrend } from '../../data/mockData'

function formatUZS(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M UZS'
  return n.toLocaleString() + ' UZS'
}

export default function MFODashboard() {
  const totalMerchants = mockMerchants.length
  const pendingApps = mockApplications.filter(a => a.status === 'PENDING').length
  const approvedThisMonth = mockApplications.filter(a =>
    a.status === 'APPROVED' || a.status === 'ACTIVE'
  ).length
  const revenueEstimate = mockApplications
    .filter(a => a.status === 'ACTIVE')
    .reduce((sum, a) => sum + (a.totalAmount - a.productPrice), 0)

  const recentApps = [...mockApplications].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Merchants"
          value={totalMerchants}
          subtitle={`${mockMerchants.filter(m => m.status === 'ACTIVE').length} active`}
          icon={<UserGroupIcon className="h-5 w-5" />}
          color="emerald"
          trend={5}
        />
        <StatCard
          title="Pending Applications"
          value={pendingApps}
          subtitle="Awaiting review"
          icon={<ClockIcon className="h-5 w-5" />}
          color="orange"
        />
        <StatCard
          title="Approved This Month"
          value={approvedThisMonth}
          subtitle="Active + recently approved"
          icon={<DocumentCheckIcon className="h-5 w-5" />}
          color="emerald"
          trend={12}
        />
        <StatCard
          title="Interest Revenue Est."
          value={formatUZS(revenueEstimate)}
          subtitle="From active loans"
          icon={<BanknotesIcon className="h-5 w-5" />}
          color="emerald"
          trend={8}
        />
      </div>

      {/* Chart + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl bg-white border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Monthly Applications</h2>
              <p className="text-xs text-gray-500 mt-0.5">Applications submitted vs approved</p>
            </div>
            <ChartBarIcon className="h-5 w-5 text-emerald-400" />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={mockMonthlyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="applications" name="Submitted" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="approved" name="Approved" fill="#6ee7b7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick links */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Quick Actions</h2>
          <Link
            to="/mfo/tariffs"
            className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 p-4 hover:bg-emerald-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ChartBarIcon className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">Manage Tariffs</p>
                <p className="text-xs text-emerald-600">Create & edit tariff plans</p>
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
                <p className="text-sm font-semibold text-emerald-900">Manage Merchants</p>
                <p className="text-xs text-emerald-600">Onboard & monitor merchants</p>
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
                <p className="text-sm font-semibold text-emerald-900">Review Applications</p>
                <p className="text-xs text-emerald-600">{pendingApps} pending decision</p>
              </div>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-emerald-500" />
          </Link>
        </div>
      </div>

      {/* Recent Applications */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Recent Applications</h2>
          <Link to="/mfo/applications" className="text-xs text-emerald-600 hover:underline">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-50">
            <thead className="bg-gray-50">
              <tr>
                {['Client', 'Merchant', 'Product', 'Amount', 'Score', 'Status', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentApps.map(app => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{app.clientName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{app.merchantName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-32 truncate">{app.productName}</td>
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
