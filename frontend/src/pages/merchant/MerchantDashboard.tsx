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
import { useTranslation } from 'react-i18next'
import { MerchantDashboardSkeleton } from '../../components/ui/Skeleton'

function formatUZS(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M UZS'
  return n.toLocaleString() + ' UZS'
}

const CONTRACTS_PAGE_SIZE = 5

export default function MerchantDashboard() {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const [applications, setApplications] = useState<Application[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [contractPage, setContractPage] = useState(1)

  useEffect(() => {
    Promise.all([
      apiApplications.list(1, 100),
      apiContracts.list(1, 100),
      apiProducts.list(),
    ]).then(([appsPage, ctrsPage, prods]) => {
      setApplications(appsPage.items)
      setContracts(ctrsPage.items)
      setProducts(prods)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const contractTotalPages = Math.max(1, Math.ceil(contracts.length / CONTRACTS_PAGE_SIZE))
  const paginatedContracts = contracts.slice((contractPage - 1) * CONTRACTS_PAGE_SIZE, contractPage * CONTRACTS_PAGE_SIZE)

  const activeInstallments = contracts.filter(c => c.status === 'ACTIVE').length
  const pendingApps = applications.filter(a => a.status === 'PENDING').length
  const revenueThisMonth = applications
    .filter(a => a.status === 'ACTIVE')
    .reduce((sum, a) => sum + (a.monthlyPayment ?? 0), 0)

  const recentApps = [...applications]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  if (loading) return <MerchantDashboardSkeleton />

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('merchantDashboard.activeInstallments')}
          value={activeInstallments}
          subtitle={t('merchantDashboard.activeContracts')}
          icon={<CreditCardIcon className="h-5 w-5" />}
          color="blue"
          trend={10}
        />
        <StatCard
          title={t('merchantDashboard.pendingApps')}
          value={pendingApps}
          subtitle={t('merchantDashboard.awaitingMFO')}
          icon={<ClockIcon className="h-5 w-5" />}
          color="orange"
        />
        <StatCard
          title={t('merchantDashboard.totalProducts')}
          value={products.length}
          subtitle={t('merchantDashboard.availableCount', { count: products.filter(p => p.available).length })}
          icon={<ShoppingBagIcon className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title={t('merchantDashboard.monthlyDue')}
          value={formatUZS(revenueThisMonth)}
          subtitle={t('merchantDashboard.fromActiveContracts')}
          icon={<BanknotesIcon className="h-5 w-5" />}
          color="blue"
          trend={5}
        />
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white shadow-card">
        <div>
          <p className="font-semibold text-lg">{t('merchantDashboard.newCustomer')}</p>
          <p className="text-blue-100 text-sm mt-0.5">{t('merchantDashboard.newCustomerDesc')}</p>
        </div>
        <Link
          to="/merchant/apply"
          className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors shrink-0"
        >
          <PlusCircleIcon className="h-4 w-4" />
          {t('merchantDashboard.newApplication')}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('merchantDashboard.recentApplications')}</h2>
            <Link to="/merchant/apply" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              {t('merchantDashboard.newApplication')} <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentApps.length === 0 ? (
              <p className="px-6 py-8 text-sm text-center text-gray-400">{t('merchantDashboard.noApplications')}</p>
            ) : recentApps.map(app => (
              <div key={app.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{app.client?.fullName ?? '—'}</p>
                  <p className="text-xs text-gray-500 truncate">{app.items?.[0]?.productName ?? '—'} · {formatUZS(app.totalAmount)}</p>
                </div>
                <div className="ml-3 flex flex-col items-end gap-1">
                  {statusBadge(app.status)}
                  <span className="text-xs text-gray-400">{app.createdAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('merchantDashboard.activeContractsTitle')}</h2>
            <Link to="/merchant/installments" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              {t('common.viewAll')} <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {contracts.length === 0 ? (
              <p className="px-6 py-8 text-sm text-center text-gray-400">{t('merchantDashboard.noContracts')}</p>
            ) : contracts.map(contract => (
              <div key={contract.id} className="px-6 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">{contract.clientName}</p>
                  {statusBadge(contract.status)}
                </div>
                <p className="text-xs text-gray-500 mb-2">{contract.itemsSummary ?? contract.productName ?? '—'}</p>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-gray-500">
                    {t('merchantDashboard.paid')}: <span className="font-medium text-gray-700">{contract.paidInstallments}/{contract.months}</span>
                  </span>
                  <span className="text-gray-500">
                    {t('merchantDashboard.monthly')}: <span className="font-medium text-gray-700">{formatUZS(contract.monthlyPayment)}</span>
                  </span>
                  <span className="text-gray-500">
                    {t('merchantDashboard.nextDate')}: <span className="font-medium text-blue-600">{contract.nextPaymentDate}</span>
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
          {contractTotalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {(contractPage - 1) * CONTRACTS_PAGE_SIZE + 1}–{Math.min(contractPage * CONTRACTS_PAGE_SIZE, contracts.length)} of {contracts.length}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setContractPage(p => Math.max(1, p - 1))}
                  disabled={contractPage === 1}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="flex items-center px-2 text-xs text-gray-500">{contractPage} / {contractTotalPages}</span>
                <button
                  onClick={() => setContractPage(p => Math.min(contractTotalPages, p + 1))}
                  disabled={contractPage === contractTotalPages}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
