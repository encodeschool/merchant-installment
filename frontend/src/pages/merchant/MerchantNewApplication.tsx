import { useState } from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { mockProducts, mockTariffs } from '../../data/mockData'
import { Product, Tariff } from '../../types'
import clsx from 'clsx'

const MERCHANT_ID = 'm1'

function formatUZS(n: number): string {
  return n.toLocaleString() + ' UZS'
}

interface ClientInfo {
  fullName: string
  passportNumber: string
  phone: string
  monthlyIncome: string
  age: string
  creditHistory: 'GOOD' | 'FAIR' | 'BAD' | 'NONE'
}

const emptyClient: ClientInfo = {
  fullName: '', passportNumber: '', phone: '', monthlyIncome: '', age: '', creditHistory: 'NONE',
}

const FIXED_MONTHS = [3, 6, 9, 12]
const PARTIAL_RATIO = 0.70  // partial approval = 70% of financed amount

function calculateScore(client: ClientInfo, monthlyPayment: number) {
  const income = parseFloat(client.monthlyIncome) || 0
  const age = parseInt(client.age) || 0

  let incomeScore = 5
  if (income >= monthlyPayment * 3) incomeScore = 30
  else if (income >= monthlyPayment * 2) incomeScore = 20
  else if (income >= monthlyPayment * 1.5) incomeScore = 10

  const creditMap: Record<string, number> = { GOOD: 30, FAIR: 20, NONE: 10, BAD: 0 }
  const creditScore = creditMap[client.creditHistory] ?? 10

  let ageScore = 5
  if (age >= 25 && age <= 55) ageScore = 20
  else if (age >= 18 && age <= 65) ageScore = 15

  const tariffScore = 20

  return {
    incomeScore,
    creditScore,
    ageScore,
    tariffScore,
    total: incomeScore + creditScore + ageScore + tariffScore,
  }
}

type ScoringOutcome = 'APPROVED' | 'PARTIAL' | 'REJECTED'

function getScoringOutcome(score: number, tariffMinScore: number): ScoringOutcome {
  if (score < 50) return 'REJECTED'
  if (score >= tariffMinScore) return 'APPROVED'
  // score is 50–(minScore-1): partial
  return 'PARTIAL'
}

function calculateMonthly(price: number, months: number, rate: number) {
  const monthlyRate = rate / 100 / 12
  if (monthlyRate === 0) return price / months
  return price * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1)
}

export default function MerchantNewApplication() {
  const [step, setStep] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [client, setClient] = useState<ClientInfo>(emptyClient)
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null)
  const [selectedMonths, setSelectedMonths] = useState(12)
  const [submitted, setSubmitted] = useState(false)
  const [appId, setAppId] = useState('')

  const availableProducts = mockProducts.filter(p => p.merchantId === MERCHANT_ID && p.available)
  const approvedTariffs = mockTariffs.filter(t => t.status === 'APPROVED')

  const eligibleTariffs = selectedProduct
    ? approvedTariffs.filter(t =>
        selectedProduct.price >= t.minAmount &&
        selectedProduct.price <= t.maxAmount
      )
    : approvedTariffs

  // Down payment & financed amount
  const downPaymentPercent = selectedProduct?.downPaymentPercent ?? 0
  const downPaymentAmount = selectedProduct ? Math.round(selectedProduct.price * downPaymentPercent / 100) : 0
  const financedAmount = selectedProduct ? selectedProduct.price - downPaymentAmount : 0

  const monthlyPayment = selectedTariff && selectedProduct
    ? calculateMonthly(financedAmount, selectedMonths, selectedTariff.interestRate)
    : 0

  const totalAmount = monthlyPayment * selectedMonths

  const score = calculateScore(client, monthlyPayment)
  const outcome: ScoringOutcome = selectedTariff
    ? getScoringOutcome(score.total, selectedTariff.minScore)
    : 'REJECTED'

  // For PARTIAL: approved amount is 70% of financed amount
  const approvedAmount = outcome === 'PARTIAL' ? Math.round(financedAmount * PARTIAL_RATIO) : financedAmount
  const approvedMonthly = selectedTariff && outcome !== 'REJECTED'
    ? calculateMonthly(approvedAmount, selectedMonths, selectedTariff.interestRate)
    : 0

  const scoreColor = score.total >= 70 ? 'text-emerald-600' : score.total >= 50 ? 'text-yellow-600' : 'text-red-600'
  const scoreBg = score.total >= 70 ? 'bg-emerald-50 border-emerald-200' : score.total >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

  const handleSubmit = () => {
    const id = `APP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    setAppId(id)
    setSubmitted(true)
  }

  const handleReset = () => {
    setStep(1)
    setSelectedProduct(null)
    setClient(emptyClient)
    setSelectedTariff(null)
    setSelectedMonths(12)
    setSubmitted(false)
    setAppId('')
  }

  if (submitted) {
    const outcomeConfig = {
      APPROVED: { icon: 'text-emerald-600', bg: 'bg-emerald-100', title: 'Application Submitted!', subtitle: 'Preliminary score: APPROVED. Awaiting MFO final review.' },
      PARTIAL: { icon: 'text-yellow-600', bg: 'bg-yellow-100', title: 'Application Submitted!', subtitle: 'Preliminary score: PARTIAL APPROVAL. MFO may approve a limited amount.' },
      REJECTED: { icon: 'text-red-500', bg: 'bg-red-100', title: 'Application Submitted', subtitle: 'Preliminary score is low. MFO will review and make a final decision.' },
    }[outcome]

    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center max-w-md w-full">
          <div className={clsx('mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4', outcomeConfig.bg)}>
            <CheckCircleIcon className={clsx('h-9 w-9', outcomeConfig.icon)} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{outcomeConfig.title}</h2>
          <p className="text-gray-500 text-sm mb-5">{outcomeConfig.subtitle}</p>

          {/* Outcome banner */}
          <div className={clsx(
            'rounded-xl border px-4 py-3 mb-4 text-sm font-semibold',
            outcome === 'APPROVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
            outcome === 'PARTIAL' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
            'bg-red-50 border-red-200 text-red-700'
          )}>
            {outcome === 'APPROVED' && `✓ Full amount approved: ${formatUZS(financedAmount)}`}
            {outcome === 'PARTIAL' && `⚠ Limited amount: ${formatUZS(approvedAmount)} (70% of financed amount)`}
            {outcome === 'REJECTED' && `✗ Score too low for automatic approval`}
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 px-6 py-4 mb-5">
            <p className="text-xs text-gray-500">Application ID</p>
            <p className="text-lg font-bold text-blue-700 font-mono mt-1">{appId}</p>
          </div>
          <div className="space-y-2 text-left mb-5">
            {[
              ['Client', client.fullName],
              ['Product', selectedProduct?.name ?? ''],
              ['Down Payment', formatUZS(downPaymentAmount) + (downPaymentPercent > 0 ? ` (${downPaymentPercent}%)` : ' (none)')],
              ['Financed Amount', formatUZS(financedAmount)],
              ['Duration', `${selectedMonths} months`],
              ['Monthly Payment', formatUZS(Math.round(outcome === 'PARTIAL' ? approvedMonthly : monthlyPayment))],
              ['Credit Score', `${score.total}/100`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className={clsx('font-medium', label === 'Credit Score' ? scoreColor : '')}>{value}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleReset}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Submit Another Application
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={clsx(
              'h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
              s < step ? 'bg-blue-600 text-white' :
              s === step ? 'bg-blue-600 text-white' :
              'bg-gray-200 text-gray-500'
            )}>
              {s < step ? <CheckCircleIcon className="h-4 w-4" /> : s}
            </div>
            <span className={clsx('text-sm font-medium', s === step ? 'text-blue-700' : 'text-gray-400')}>
              {s === 1 ? 'Select Product' : s === 2 ? 'Client Info' : 'Review & Submit'}
            </span>
            {s < 3 && <div className={clsx('flex-1 h-0.5 min-w-8', s < step ? 'bg-blue-600' : 'bg-gray-200')} />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Product */}
      {step === 1 && (
        <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Select Product</h2>
          {availableProducts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No available products. Add products first.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className={clsx(
                    'text-left rounded-xl border-2 p-4 transition-all',
                    selectedProduct?.id === product.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{product.category}</p>
                      <p className="text-xs text-gray-400 mt-1">{product.description}</p>
                    </div>
                    {selectedProduct?.id === product.id && (
                      <CheckCircleIcon className="h-5 w-5 text-blue-600 shrink-0 ml-2" />
                    )}
                  </div>
                  <p className="text-base font-bold text-blue-700 mt-3">{formatUZS(product.price)}</p>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end mt-5">
            <button
              onClick={() => setStep(2)}
              disabled={!selectedProduct}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next: Client Info
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Client Info */}
      {step === 2 && (
        <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Client Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={client.fullName}
                onChange={e => setClient(c => ({ ...c, fullName: e.target.value }))}
                placeholder="Mansur Qodirov"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passport Number</label>
              <input
                type="text"
                value={client.passportNumber}
                onChange={e => setClient(c => ({ ...c, passportNumber: e.target.value }))}
                placeholder="AA1234567"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={client.phone}
                onChange={e => setClient(c => ({ ...c, phone: e.target.value }))}
                placeholder="+998901234567"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Income (UZS)</label>
              <input
                type="number"
                value={client.monthlyIncome}
                onChange={e => setClient(c => ({ ...c, monthlyIncome: e.target.value }))}
                placeholder="3000000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <input
                type="number"
                value={client.age}
                onChange={e => setClient(c => ({ ...c, age: e.target.value }))}
                placeholder="30"
                min="18" max="75"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit History</label>
              <div className="grid grid-cols-4 gap-2">
                {(['GOOD', 'FAIR', 'NONE', 'BAD'] as const).map(ch => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setClient(c => ({ ...c, creditHistory: ch }))}
                    className={clsx(
                      'rounded-lg py-2 text-xs font-semibold transition-all border',
                      client.creditHistory === ch
                        ? ch === 'GOOD' ? 'bg-emerald-600 text-white border-emerald-600'
                          : ch === 'FAIR' ? 'bg-yellow-500 text-white border-yellow-500'
                          : ch === 'BAD' ? 'bg-red-600 text-white border-red-600'
                          : 'bg-gray-600 text-white border-gray-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    )}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-between mt-5">
            <button
              onClick={() => setStep(1)}
              className="rounded-xl border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!client.fullName || !client.phone}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Select Tariff + Review */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Tariff Selection */}
          <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Select Tariff & Duration</h2>
            {eligibleTariffs.length === 0 ? (
              <p className="text-sm text-yellow-700 bg-yellow-50 rounded-lg p-3">
                No approved tariffs available for this product price range.
              </p>
            ) : (
              <div className="space-y-3">
                {eligibleTariffs.map(tariff => (
                  <div
                    key={tariff.id}
                    onClick={() => {
                      setSelectedTariff(tariff)
                      setSelectedMonths(tariff.minMonths)
                    }}
                    className={clsx(
                      'rounded-xl border-2 p-4 cursor-pointer transition-all',
                      selectedTariff?.id === tariff.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{tariff.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{tariff.mfoName} · {tariff.interestRate}% annual</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Duration</p>
                        <p className="text-sm font-medium">{tariff.minMonths}–{tariff.maxMonths} months</p>
                      </div>
                    </div>

                    {selectedTariff?.id === tariff.id && selectedProduct && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <label className="block text-xs font-medium text-gray-700 mb-2">Select Duration</label>
                        <div className="grid grid-cols-4 gap-2">
                          {FIXED_MONTHS.filter(m => m >= tariff.minMonths && m <= tariff.maxMonths).map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setSelectedMonths(m)}
                              className={clsx(
                                'rounded-lg py-1.5 text-xs font-semibold transition-all border',
                                selectedMonths === m
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                              )}
                            >
                              {m} mo
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {selectedTariff && selectedProduct && (
            <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm space-y-5">
              <h2 className="text-base font-semibold text-gray-900">Application Summary</h2>

              {/* Payment breakdown */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Product</p>
                  <p className="font-semibold mt-0.5">{selectedProduct.name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Client</p>
                  <p className="font-semibold mt-0.5">{client.fullName || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Product Price</p>
                  <p className="font-semibold mt-0.5">{formatUZS(selectedProduct.price)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Down Payment ({downPaymentPercent}%)</p>
                  <p className="font-semibold text-orange-600 mt-0.5">{formatUZS(downPaymentAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Financed Amount</p>
                  <p className="font-semibold mt-0.5">{formatUZS(financedAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Duration</p>
                  <p className="font-semibold mt-0.5">{selectedMonths} months</p>
                </div>
                <div>
                  <p className="text-gray-500">Monthly Payment</p>
                  <p className="font-bold text-blue-700 text-base mt-0.5">{formatUZS(Math.round(monthlyPayment))}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total Repayment</p>
                  <p className="font-bold text-gray-900 text-base mt-0.5">{formatUZS(Math.round(totalAmount))}</p>
                </div>
              </div>

              {/* Score + Outcome */}
              <div className={clsx('rounded-xl border p-4', scoreBg)}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-700">Estimated Credit Score</p>
                  <span className={clsx('text-2xl font-black', scoreColor)}>{score.total}/100</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">Tariff minimum score: {selectedTariff.minScore}</p>

                {/* Score bars */}
                <div className="space-y-2 mb-4">
                  {[
                    { label: 'Income vs Payment', value: score.incomeScore, max: 30 },
                    { label: 'Credit History', value: score.creditScore, max: 30 },
                    { label: 'Age Factor', value: score.ageScore, max: 20 },
                    { label: 'Tariff Match', value: score.tariffScore, max: 20 },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 text-xs">
                      <span className="w-32 text-gray-600 shrink-0">{item.label}</span>
                      <div className="flex-1 bg-white/60 rounded-full h-1.5">
                        <div
                          className={clsx('h-1.5 rounded-full', score.total >= 70 ? 'bg-emerald-500' : score.total >= 50 ? 'bg-yellow-500' : 'bg-red-500')}
                          style={{ width: `${(item.value / item.max) * 100}%` }}
                        />
                      </div>
                      <span className="font-semibold w-8 text-right">{item.value}/{item.max}</span>
                    </div>
                  ))}
                </div>

                {/* Decision outcome */}
                <div className={clsx(
                  'rounded-lg px-3 py-2 text-xs font-semibold',
                  outcome === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                  outcome === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                )}>
                  {outcome === 'APPROVED' && `✓ Preliminary: APPROVED — Full amount ${formatUZS(financedAmount)} eligible`}
                  {outcome === 'PARTIAL' && `⚠ Preliminary: PARTIAL — Limited to ${formatUZS(approvedAmount)} (${formatUZS(Math.round(approvedMonthly))}/mo)`}
                  {outcome === 'REJECTED' && `✗ Preliminary: REJECTED — Score below minimum threshold (50)`}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-between">
            <button
              onClick={() => setStep(2)}
              className="rounded-xl border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedTariff}
              className="rounded-xl bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Submit Application
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
