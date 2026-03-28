import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  CreditCardIcon, ClockIcon, ShoppingBagIcon, BanknotesIcon, PlusCircleIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline'
import StatCard from '../../components/ui/StatCard'
import { statusBadge } from '../../components/ui/Badge'
import { Application, Contract, Product } from '../../types'
import { apiApplications, apiContracts, apiProducts } from '../../api'
import { useAuthStore } from '../../store/authStore'

function formatUZS(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M UZS'
  return n.toLocaleString() + ' UZS'
}

export default function MerchantDashboard() {
  const { user } = useAuthStore()

  const [applications, setApplications] = useState<Application[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    apiApplications.list().then(setApplications).catch(() => {})
    apiContracts.list().then(setContracts).catch(() => {})
    apiProducts.list().then(setProducts).catch(() => {})
  }, [])

  const activeInstallments = contracts.filter(c => c.status === 'ACTIVE').length
  const pendingApps = applications.filter(a => a.status === 'PENDING').length
  const revenueThisMonth = applications
    .filter(a => a.status === 'ACTIVE')
    .reduce((sum, a) => sum + a.monthlyPayment, 0)

  const recentApps = [...applications]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Installments"
          value={activeInstallments}
          subtitle="Active contracts"
          icon={<CreditCardIcon className="h-5 w-5" />}
          color="blue"
          trend={10}
        />
        <StatCard
          title="Pending Applications"
          value={pendingApps}
          subtitle="Awaiting MFO review"
          icon={<ClockIcon className="h-5 w-5" />}
          color="orange"
        />
        <StatCard
          title="Total Products"
          value={products.length}
          subtitle={`${products.filter(p => p.available).length} available`}
          icon={<ShoppingBagIcon className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Monthly Payments Due"
          value={formatUZS(revenueThisMonth)}
          subtitle="From active contracts"
          icon={<BanknotesIcon className="h-5 w-5" />}
          color="blue"
          trend={5}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white">
        <div>
          <p className="font-semibold text-lg">New Customer?</p>
          <p className="text-blue-100 text-sm mt-0.5">Submit an installment application in minutes</p>
        </div>
        <Link
          to="/merchant/apply"
          className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors shrink-0"
        >
          <PlusCircleIcon className="h-4 w-4" />
          New Application
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Recent Applications</h2>
            <Link to="/merchant/apply" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              New <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentApps.length === 0 ? (
              <p className="px-5 py-8 text-sm text-center text-gray-400">No applications yet.</p>
            ) : recentApps.map(app => (
              <div key={app.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{app.clientName}</p>
                  <p className="text-xs text-gray-500 truncate">{app.productName} · {formatUZS(app.totalAmount)}</p>
                </div>
                <div className="ml-3 flex flex-col items-end gap-1">
                  {statusBadge(app.status)}
                  <span className="text-xs text-gray-400">{app.createdAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Active Contracts</h2>
            <Link to="/merchant/installments" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {contracts.length === 0 ? (
              <p className="px-5 py-8 text-sm text-center text-gray-400">No active contracts.</p>
            ) : contracts.map(contract => (
              <div key={contract.id} className="px-5 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">{contract.clientName}</p>
                  {statusBadge(contract.status)}
                </div>
                <p className="text-xs text-gray-500 mb-2">{contract.productName}</p>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-gray-500">
                    Paid: <span className="font-medium text-gray-700">{contract.paidInstallments}/{contract.months}</span>
                  </span>
                  <span className="text-gray-500">
                    Monthly: <span className="font-medium text-gray-700">{formatUZS(contract.monthlyPayment)}</span>
                  </span>
                  <span className="text-gray-500">
                    Next: <span className="font-medium text-blue-600">{contract.nextPaymentDate}</span>
                  </span>
                </div>
                <div className="mt-2 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${(contract.paidInstallments / contract.months) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
