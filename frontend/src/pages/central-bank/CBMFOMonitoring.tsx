import { useState, useEffect } from 'react'
import {
  BuildingLibraryIcon, CheckBadgeIcon, ExclamationCircleIcon, BanknotesIcon,
} from '@heroicons/react/24/outline'
import StatCard from '../../components/ui/StatCard'
import { statusBadge } from '../../components/ui/Badge'
import { mockMFOStats } from '../../data/mockData'
import { MFOStats } from '../../types'
import { apiDashboard } from '../../api'
import clsx from 'clsx'

function formatUZS(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B UZS'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + 'M UZS'
  return n.toLocaleString() + ' UZS'
}

function defaultRateColor(rate: number) {
  if (rate < 3) return 'text-emerald-600'
  if (rate <= 5) return 'text-yellow-600'
  return 'text-red-600'
}

function defaultRateBg(rate: number) {
  if (rate < 3) return 'bg-emerald-50'
  if (rate <= 5) return 'bg-yellow-50'
  return 'bg-red-50'
}

export default function CBMFOMonitoring() {
  const [mfos, setMfos] = useState<MFOStats[]>(mockMFOStats)

  useEffect(() => {
    apiDashboard.mfoList().then(setMfos).catch(() => {})
  }, [])

  const activeMFOs = mfos.filter(m => m.status === 'ACTIVE').length
  const suspendedMFOs = mfos.filter(m => m.status === 'SUSPENDED').length
  const avgApproval = mfos.length > 0
    ? (mfos.reduce((sum, m) => sum + m.approvalRate, 0) / mfos.length).toFixed(0)
    : '0'
  const totalDisbursed = mfos.reduce((sum, m) => sum + m.totalDisbursed, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active MFOs"
          value={activeMFOs}
          icon={<BuildingLibraryIcon className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          title="Suspended MFOs"
          value={suspendedMFOs}
          icon={<ExclamationCircleIcon className="h-5 w-5" />}
          color="red"
        />
        <StatCard
          title="Avg Approval Rate"
          value={`${avgApproval}%`}
          subtitle="Across all MFOs"
          icon={<CheckBadgeIcon className="h-5 w-5" />}
          color="emerald"
        />
        <StatCard
          title="Total Disbursed"
          value={formatUZS(totalDisbursed)}
          subtitle="All MFOs combined"
          icon={<BanknotesIcon className="h-5 w-5" />}
          color="purple"
        />
      </div>

      <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Registered MFOs</h2>
          <p className="text-xs text-gray-500 mt-0.5">Monitor performance and manage status</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['MFO Name', 'Merchants', 'Applications', 'Approval Rate', 'Total Disbursed', 'Default Rate', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mfos.map(mfo => (
                <tr key={mfo.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                        <BuildingLibraryIcon className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{mfo.name}</p>
                        <p className="text-xs text-gray-400">ID: {mfo.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">{mfo.totalMerchants}</td>
                  <td className="px-4 py-4 text-sm text-gray-700">{mfo.totalApplications.toLocaleString()}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-20">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full"
                          style={{ width: `${mfo.approvalRate}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{mfo.approvalRate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">{formatUZS(mfo.totalDisbursed)}</td>
                  <td className="px-4 py-4">
                    <span className={clsx(
                      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                      defaultRateBg(mfo.defaultRate),
                      defaultRateColor(mfo.defaultRate)
                    )}>
                      {mfo.defaultRate}%
                    </span>
                  </td>
                  <td className="px-4 py-4">{statusBadge(mfo.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-6 text-xs text-gray-500">
        <span className="font-medium">Default Rate:</span>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span>{'<3% (Good)'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
          <span>3–5% (Moderate)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span>{'>5% (High Risk)'}</span>
        </div>
      </div>
    </div>
  )
}
