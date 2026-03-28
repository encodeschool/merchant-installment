import { useState, useEffect } from 'react'
import { CreditCardIcon, BanknotesIcon, CalendarIcon } from '@heroicons/react/24/outline'
import { addMonths, format } from 'date-fns'
import StatCard from '../../components/ui/StatCard'
import { statusBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { Contract } from '../../types'
import { apiContracts, Installment } from '../../api'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

function formatUZS(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M UZS'
  return n.toLocaleString() + ' UZS'
}

export default function MerchantInstallments() {
  const { t } = useTranslation()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [scheduleContract, setScheduleContract] = useState<Contract | null>(null)
  const [schedule, setSchedule] = useState<Installment[]>([])
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  useEffect(() => {
    apiContracts.list().then(setContracts).catch(() => {})
  }, [])

  const openSchedule = (contract: Contract) => {
    setScheduleContract(contract)
    setLoadingSchedule(true)
    apiContracts.schedule(contract.id)
      .then(setSchedule)
      .catch(() => {
        const startDate = new Date(contract.createdAt)
        setSchedule(Array.from({ length: contract.months }, (_, i) => ({
          id: String(i + 1),
          contractId: contract.id,
          installmentNumber: i + 1,
          dueDate: format(addMonths(startDate, i + 1), 'yyyy-MM-dd'),
          amount: contract.monthlyPayment,
          paidAt: i < contract.paidInstallments ? contract.createdAt : null,
          status: (i < contract.paidInstallments ? 'PAID' : 'UPCOMING') as Installment['status'],
        })))
      })
      .finally(() => setLoadingSchedule(false))
  }

  const activeContracts = contracts.filter(c => c.status === 'ACTIVE').length
  const totalPaid = contracts.reduce((sum, c) => sum + c.paidInstallments * c.monthlyPayment, 0)
  const nextDueDate = contracts
    .filter(c => c.status === 'ACTIVE' && c.nextPaymentDate)
    .sort((a, b) => new Date(a.nextPaymentDate).getTime() - new Date(b.nextPaymentDate).getTime())[0]?.nextPaymentDate ?? 'N/A'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t('installments.activeContracts')}
          value={activeContracts}
          subtitle={t('installments.total', { count: contracts.length })}
          icon={<CreditCardIcon className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title={t('installments.totalPaid')}
          value={formatUZS(totalPaid)}
          subtitle={t('installments.acrossAll')}
          icon={<BanknotesIcon className="h-5 w-5" />}
          color="blue"
          trend={5}
        />
        <StatCard
          title={t('installments.nextPaymentDue')}
          value={nextDueDate}
          subtitle={t('installments.earliest')}
          icon={<CalendarIcon className="h-5 w-5" />}
          color="orange"
        />
      </div>

      <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t('installments.contractsTitle')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t('installments.contractsSubtitle')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {[t('installments.colClient'), t('installments.colProduct'), t('installments.colTotal'), t('installments.colMonthly'), t('installments.colProgress'), t('installments.colNextPayment'), t('installments.colStatus'), t('installments.colActions')].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                    {t('installments.noContracts')}
                  </td>
                </tr>
              ) : contracts.map(contract => {
                const progress = Math.round((contract.paidInstallments / contract.months) * 100)
                return (
                  <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-gray-900">{contract.clientName}</p>
                      <p className="text-xs text-gray-400">ID: {contract.id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 max-w-36">
                      <p className="truncate">{contract.itemsSummary ?? contract.productName ?? '—'}</p>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {formatUZS(contract.totalAmount)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                      {formatUZS(contract.monthlyPayment)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{contract.paidInstallments}/{contract.months}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-24 bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-blue-700 whitespace-nowrap">
                      {contract.nextPaymentDate}
                    </td>
                    <td className="px-4 py-4">{statusBadge(contract.status)}</td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => openSchedule(contract)}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        {t('installments.viewSchedule')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!scheduleContract}
        onClose={() => { setScheduleContract(null); setSchedule([]) }}
        title={t('installments.scheduleTitle', { name: scheduleContract?.clientName })}
        size="lg"
      >
        {scheduleContract && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">{t('installments.product')}</p>
                <p className="font-semibold mt-0.5">{scheduleContract.itemsSummary ?? scheduleContract.productName ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('installments.totalAmount')}</p>
                <p className="font-semibold mt-0.5">{formatUZS(scheduleContract.totalAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('installments.monthly')}</p>
                <p className="font-semibold mt-0.5">{formatUZS(scheduleContract.monthlyPayment)}</p>
              </div>
            </div>

            {loadingSchedule ? (
              <div className="text-center py-8 text-sm text-gray-400">{t('installments.loadingSchedule')}</div>
            ) : (
              <div className="rounded-xl border border-gray-100 overflow-hidden max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{t('installments.colNum')}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{t('installments.colDueDate')}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{t('installments.colAmount')}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{t('installments.colSched')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {schedule.map(item => (
                      <tr key={item.id} className={clsx('hover:bg-gray-50', item.status === 'PAID' ? 'opacity-60' : '')}>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-500">{item.installmentNumber}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">{item.dueDate}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{formatUZS(item.amount)}</td>
                        <td className="px-4 py-2.5">
                          <span className={clsx(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                            item.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : item.status === 'OVERDUE'
                              ? 'bg-red-50 text-red-700 ring-red-200'
                              : 'bg-blue-50 text-blue-700 ring-blue-200'
                          )}>
                            {item.status === 'PAID' ? t('installments.paid') : item.status === 'OVERDUE' ? t('installments.overdue') : t('installments.upcoming')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between text-sm text-gray-500 pt-1">
              <span>{t('installments.paidCount', { count: scheduleContract.paidInstallments })}</span>
              <span>{t('installments.remaining', { count: scheduleContract.months - scheduleContract.paidInstallments })}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
