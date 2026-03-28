import { useState } from 'react'
import { CreditCardIcon, BanknotesIcon, CalendarIcon } from '@heroicons/react/24/outline'
import StatCard from '../../components/ui/StatCard'
import { statusBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { mockContracts } from '../../data/mockData'
import { Contract } from '../../types'
import clsx from 'clsx'
import { addMonths, format } from 'date-fns'

function formatUZS(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M UZS'
  return n.toLocaleString() + ' UZS'
}

interface ScheduleItem {
  installmentNo: number
  dueDate: string
  amount: number
  status: 'PAID' | 'UPCOMING'
}

function generateSchedule(contract: Contract): ScheduleItem[] {
  const startDate = new Date(contract.createdAt)
  return Array.from({ length: contract.months }, (_, i) => {
    const dueDate = addMonths(startDate, i + 1)
    return {
      installmentNo: i + 1,
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      amount: contract.monthlyPayment,
      status: i < contract.paidInstallments ? 'PAID' : 'UPCOMING',
    }
  })
}

export default function MerchantInstallments() {
  const [contracts] = useState<Contract[]>(mockContracts)
  const [scheduleContract, setScheduleContract] = useState<Contract | null>(null)

  const activeContracts = contracts.filter(c => c.status === 'ACTIVE').length
  const totalPaid = contracts.reduce((sum, c) => sum + c.paidInstallments * c.monthlyPayment, 0)
  const nextDueDate = contracts
    .filter(c => c.status === 'ACTIVE')
    .sort((a, b) => new Date(a.nextPaymentDate).getTime() - new Date(b.nextPaymentDate).getTime())[0]?.nextPaymentDate ?? 'N/A'

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Contracts"
          value={activeContracts}
          subtitle={`${contracts.length} total`}
          icon={<CreditCardIcon className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Total Paid"
          value={formatUZS(totalPaid)}
          subtitle="Across all contracts"
          icon={<BanknotesIcon className="h-5 w-5" />}
          color="blue"
          trend={5}
        />
        <StatCard
          title="Next Payment Due"
          value={nextDueDate}
          subtitle="Earliest upcoming"
          icon={<CalendarIcon className="h-5 w-5" />}
          color="orange"
        />
      </div>

      {/* Contracts Table */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Installment Contracts</h2>
          <p className="text-xs text-gray-500 mt-0.5">Track all customer installment contracts</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Client', 'Product', 'Total', 'Monthly', 'Progress', 'Next Payment', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                    No installment contracts yet.
                  </td>
                </tr>
              ) : contracts.map(contract => {
                const progress = Math.round((contract.paidInstallments / contract.months) * 100)
                return (
                  <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-gray-900">{contract.clientName}</p>
                      <p className="text-xs text-gray-400">ID: {contract.id}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 max-w-32">
                      <p className="truncate">{contract.productName}</p>
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
                        onClick={() => setScheduleContract(contract)}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        View Schedule
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Schedule Modal */}
      <Modal
        open={!!scheduleContract}
        onClose={() => setScheduleContract(null)}
        title={`Payment Schedule — ${scheduleContract?.clientName}`}
        size="lg"
      >
        {scheduleContract && (
          <div className="space-y-4">
            {/* Contract info */}
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Product</p>
                <p className="font-semibold mt-0.5">{scheduleContract.productName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Amount</p>
                <p className="font-semibold mt-0.5">{formatUZS(scheduleContract.totalAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Monthly</p>
                <p className="font-semibold mt-0.5">{formatUZS(scheduleContract.monthlyPayment)}</p>
              </div>
            </div>

            {/* Schedule Table */}
            <div className="rounded-xl border border-gray-100 overflow-hidden max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">#</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Due Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {generateSchedule(scheduleContract).map(item => (
                    <tr key={item.installmentNo} className={clsx('hover:bg-gray-50', item.status === 'PAID' ? 'opacity-60' : '')}>
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-500">{item.installmentNo}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">{item.dueDate}</td>
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{formatUZS(item.amount)}</td>
                      <td className="px-4 py-2.5">
                        <span className={clsx(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                          item.status === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-blue-50 text-blue-700 ring-blue-200'
                        )}>
                          {item.status === 'PAID' ? 'Paid' : 'Upcoming'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between text-sm text-gray-500 pt-1">
              <span>Paid: <strong className="text-emerald-600">{scheduleContract.paidInstallments} installments</strong></span>
              <span>Remaining: <strong className="text-blue-600">{scheduleContract.months - scheduleContract.paidInstallments} installments</strong></span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
