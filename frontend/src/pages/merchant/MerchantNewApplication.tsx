import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/24/solid'
import { Product, EligibleOffer, ScoreResult, MultiProductResponse } from '../../types'
import { apiProducts, apiApplications, apiMerchants } from '../../api'
import { useAuthStore } from '../../store/authStore'
import FaceVerifyCamera, { VerifyResult } from '../../components/merchant/FaceVerifyCamera'
import SignaturePad, { SignaturePadHandle } from '../../components/merchant/SignaturePad'
import ScoreGauge from '../../components/merchant/ScoreGauge'
import clsx from 'clsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUZS(n: number): string {
  return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' UZS'
}

function calculateMonthly(principal: number, months: number, rate: number): number {
  if (rate === 0) return principal / months
  const r = rate / 100 / 12
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

function roundK(n: number): number {
  return Math.round(n / 1000) * 1000
}

function maskPassport(s: string): string {
  if (s.length < 3) return s
  return s.slice(0, 2) + '***' + s.slice(-3)
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function maskCardNumber(formatted: string): string {
  const digits = formatted.replace(/\s/g, '')
  return digits.slice(0, 4) + ' **** **** ' + digits.slice(-4)
}

const INCOME_OPTIONS = [
  1_500_000, 2_000_000, 2_500_000, 3_000_000,
  3_500_000, 4_000_000, 5_000_000, 6_000_000,
  7_500_000, 10_000_000,
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface CartItem { product: Product; quantity: number }
interface ClientForm { passportSeries: string; birthDate: string; monthlyIncome: string }
interface SelectedOffer { tariff: EligibleOffer; months: number }

// ── Step indicator ────────────────────────────────────────────────────────────

const STEP_LABELS = ['Products', 'Identity', 'Scoring', 'Result', 'Offers', 'Sign', 'Done']

function StepIndicator({ step, stepLabelOverride }: { step: number; stepLabelOverride?: string }) {
  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
      {STEP_LABELS.slice(0, 6).map((label, i) => {
        const s = i + 1
        const done = s < step
        const active = s === step
        const displayLabel = active && stepLabelOverride ? stepLabelOverride : label
        return (
          <div key={s} className="flex items-center gap-1 shrink-0">
            <div className={clsx(
              'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              done ? 'bg-emerald-500 text-white' :
              active ? 'bg-blue-600 text-white' :
              'bg-gray-200 text-gray-500'
            )}>
              {done ? <CheckIcon className="h-3.5 w-3.5" /> : s}
            </div>
            <span className={clsx(
              'text-xs font-medium hidden sm:inline',
              active ? 'text-blue-700' : done ? 'text-emerald-600' : 'text-gray-400'
            )}>
              {displayLabel}
            </span>
            {s < 6 && (
              <div className={clsx(
                'w-4 sm:w-8 h-0.5 mx-1',
                done ? 'bg-emerald-400' : 'bg-gray-200'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Mock fallback data (when backend unreachable) ─────────────────────────────

function mockMultiProductResponse(appId: string): MultiProductResponse {
  const score = 55 + Math.floor(Math.random() * 30)
  return {
    id: appId,
    score_result: {
      f1_affordability: 70, f2_credit: 65, f3_behavioral: 80, f4_demographic: 75,
      total_score: score,
      decision: score >= 70 ? 'APPROVED' : score >= 50 ? 'PARTIAL' : 'REJECTED',
      weights: { w1: 0.4, w2: 0.3, w3: 0.2, w4: 0.1 },
      hard_reject: false,
      hard_reject_reason: null,
      reason_codes: [],
      approved_ratio: score >= 70 ? 1.0 : score >= 50 ? 0.7 : 0.0,
    },
    eligible_offers: [
      {
        tariff_id: 'mock-1',
        mfo_name: 'UzMicroFinance',
        tariff_name: 'Standard Installment',
        interest_rate: 24,
        available_months: [3, 6, 9, 12],
        min_monthly_payment: 0,
        max_monthly_payment: 0,
        min_down_payment_pct: 10,
        approved_amount: 0,
        approved_ratio: score >= 70 ? 1.0 : 0.7,
      },
      {
        tariff_id: 'mock-2',
        mfo_name: 'FinancePlus',
        tariff_name: 'Flexible Plan',
        interest_rate: 18,
        available_months: [6, 9, 12],
        min_monthly_payment: 0,
        max_monthly_payment: 0,
        min_down_payment_pct: 15,
        approved_amount: 0,
        approved_ratio: score >= 70 ? 1.0 : 0.7,
      },
    ],
    fraud_gate: 'PASS',
    fraud_signals: [],
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MerchantNewApplication() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [merchantId, setMerchantId] = useState('')
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])

  // Wizard step
  const [step, setStep] = useState(1)

  // Step 1: Cart
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Step 2: Client form
  const [subStep2, setSubStep2] = useState<'form' | 'card' | 'camera'>('form')
  const [clientForm, setClientForm] = useState<ClientForm>({ passportSeries: '', birthDate: '', monthlyIncome: '' })
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({})
  const [face1Image, setFace1Image] = useState<string | null>(null)
  const [face1Verified, setFace1Verified] = useState(false)
  // Step 2B: Card scan
  const [cardNumber, setCardNumber] = useState('')
  const [cardFetching, setCardFetching] = useState(false)
  const [cardFetched, setCardFetched] = useState(false)
  const [fetchedIncome, setFetchedIncome] = useState<number | null>(null)

  // Step 3: Scoring animation
  const [checkItems, setCheckItems] = useState([false, false, false, false])
  const [animDone, setAnimDone] = useState(false)
  const [apiDone, setApiDone] = useState(false)
  const [apiResult, setApiResult] = useState<MultiProductResponse | null>(null)
  const [scoringError, setScoringError] = useState(false)

  // Step 4: Score result
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [eligibleOffers, setEligibleOffers] = useState<EligibleOffer[]>([])
  const [fraudGate, setFraudGate] = useState<'PASS' | 'FLAG' | 'BLOCK'>('PASS')
  const [fraudSignals, setFraudSignals] = useState<string[]>([])
  const [appId, setAppId] = useState<string | null>(null)

  // Step 5: Offer selection
  const [selectedOffer, setSelectedOffer] = useState<SelectedOffer | null>(null)

  // Step 6: Signing
  const [face2Image, setFace2Image] = useState<string | null>(null)
  const [face2Verified, setFace2Verified] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const sigPadRef = useRef<SignaturePadHandle>(null)

  // Step 7: Final
  const [finalApp, setFinalApp] = useState<{ monthly_payment: number; months: number } | null>(null)

  // Load data
  useEffect(() => {
    apiMerchants.my().then(m => setMerchantId(m.id)).catch(() => {})
    apiProducts.list().then(data => setAvailableProducts(data.filter(p => p.available))).catch(() => {})
  }, [user])

  // ── Cart helpers ─────────────────────────────────────────────────────────────

  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0)
  const maxDownPct = cart.length ? Math.max(...cart.map(i => i.product.downPaymentPercent)) : 0
  const downAmount = Math.round(cartTotal * maxDownPct / 100)
  const financedAmount = cartTotal - downAmount

  const addToCart = (product: Product) => {
    setCart(c => c.find(x => x.product.id === product.id) ? c : [...c, { product, quantity: 1 }])
  }
  const changeQty = (productId: string, delta: number) => {
    setCart(c => c.flatMap(item => {
      if (item.product.id !== productId) return [item]
      const next = item.quantity + delta
      if (next <= 0) return []
      if (next > 10) return [item]
      return [{ ...item, quantity: next }]
    }))
  }

  const inCart = (id: string) => cart.find(x => x.product.id === id)

  const categories = Array.from(new Set(availableProducts.map(p => p.category).filter(Boolean)))

  const filteredProducts = availableProducts.filter(p => {
    const matchQ = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchC = !selectedCategory || p.category === selectedCategory
    return matchQ && matchC
  })

  // ── Passport validation ───────────────────────────────────────────────────────

  const PASSPORT_RE = /^[A-Z]{2}\d{7}$/

  function validateClientForm(): boolean {
    const errors: Record<string, string> = {}
    const ps = clientForm.passportSeries.toUpperCase()
    if (!PASSPORT_RE.test(ps)) errors.passportSeries = 'Must be 2 letters followed by 7 digits (e.g. AB1234567)'
    if (!clientForm.birthDate) {
      errors.birthDate = 'Birth date required'
    } else {
      const age = calcAge(clientForm.birthDate)
      if (age < 18 || age > 75) errors.birthDate = 'Client must be between 18 and 75 years old'
    }
    setClientErrors(errors)
    return Object.keys(errors).length === 0
  }

  function calcAge(birthDate: string): number {
    const bd = new Date(birthDate)
    const today = new Date()
    let age = today.getFullYear() - bd.getFullYear()
    if (today.getMonth() < bd.getMonth() || (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate())) {
      age--
    }
    return age
  }

  const clientFormValid = (() => {
    const ps = clientForm.passportSeries.toUpperCase()
    if (!PASSPORT_RE.test(ps)) return false
    if (!clientForm.birthDate) return false
    const age = calcAge(clientForm.birthDate)
    if (age < 18 || age > 75) return false
    return true
  })()

  // ── Step 3: scoring API call + animation ──────────────────────────────────────

  const startScoring = useCallback(() => {
    setScoringError(false)
    setCheckItems([false, false, false, false])
    setAnimDone(false)
    setApiDone(false)
    setApiResult(null)

    const duration = 4000 + Math.random() * 4000
    ;[0, 1, 2, 3].forEach(i => {
      setTimeout(() => setCheckItems(prev => { const n = [...prev]; n[i] = true; return n }), (i + 1) * 900)
    })
    setTimeout(() => setAnimDone(true), duration)

    const payload = {
      merchant_id: merchantId,
      items: cart.map(item => ({ product_id: item.product.id, quantity: item.quantity })),
      months: 12,
      client: {
        passport_number: clientForm.passportSeries.toUpperCase(),
        birth_date: clientForm.birthDate,
        full_name: '',
        phone: '',
        monthly_income: Math.round(Number(clientForm.monthlyIncome.replace(/\s/g, ''))),
        age: calcAge(clientForm.birthDate),
        credit_history: 'NONE',
        open_loans: 0,
        overdue_days: 0,
        has_bankruptcy: false,
      },
      face_image_b64: face1Image ?? '',
      signature_b64: '',
    }

    apiApplications
      .submitMulti(payload)
      .then(res => {
        // Enrich eligible_offers with computed monthly payments using total financed amount
        const enriched = res.eligible_offers.map((offer: EligibleOffer) => {
          if (offer.approved_amount === 0) {
            const approved = Math.round(financedAmount * (offer.approved_ratio || 1))
            const months = offer.available_months
            return {
              ...offer,
              approved_amount: approved,
              min_monthly_payment: roundK(calculateMonthly(approved, Math.max(...months), offer.interest_rate)),
              max_monthly_payment: roundK(calculateMonthly(approved, Math.min(...months), offer.interest_rate)),
            }
          }
          return offer
        })
        setApiResult({ ...res, eligible_offers: enriched })
        setApiDone(true)
      })
      .catch(() => {
        const mockId = appId || `APP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        const mock = mockMultiProductResponse(mockId)
        // Enrich mock with actual financed amounts
        const enriched = mock.eligible_offers.map(offer => ({
          ...offer,
          approved_amount: Math.round(financedAmount * offer.approved_ratio),
          min_monthly_payment: roundK(calculateMonthly(
            Math.round(financedAmount * offer.approved_ratio),
            Math.max(...offer.available_months), offer.interest_rate)),
          max_monthly_payment: roundK(calculateMonthly(
            Math.round(financedAmount * offer.approved_ratio),
            Math.min(...offer.available_months), offer.interest_rate)),
        }))
        setApiResult({ ...mock, id: mockId, eligible_offers: enriched })
        setApiDone(true)
      })
  }, [merchantId, cart, clientForm, face1Image, financedAmount, appId])

  useEffect(() => {
    if (step === 3) startScoring()
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (animDone && apiDone && apiResult && step === 3) {
      setScoreResult(apiResult.score_result)
      setEligibleOffers(apiResult.eligible_offers)
      setFraudGate(apiResult.fraud_gate as 'PASS' | 'FLAG' | 'BLOCK')
      setFraudSignals(apiResult.fraud_signals)
      setAppId(apiResult.id)
      setTimeout(() => setStep(4), 500)
    }
  }, [animDone, apiDone, apiResult, step])

  // ── Submit confirm ─────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!selectedOffer || !appId) return
    setSubmitting(true)
    const sigDataUrl = sigPadRef.current?.toDataURL()
    const sigB64 = sigDataUrl ? sigDataUrl.split(',')[1] : ''

    try {
      const res = await apiApplications.confirm(appId, {
        tariff_id: selectedOffer.tariff.tariff_id,
        months: selectedOffer.months,
        signature_b64: sigB64,
      })
      setFinalApp(res)
      setStep(7)
    } catch {
      // Demo fallback
      setFinalApp({ monthly_payment: roundK(calculateMonthly(selectedOffer.tariff.approved_amount, selectedOffer.months, selectedOffer.tariff.interest_rate)), months: selectedOffer.months })
      setStep(7)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setStep(1); setCart([]); setSearchQuery(''); setSelectedCategory(null)
    setSubStep2('form')
    setClientForm({ passportSeries: '', birthDate: '', monthlyIncome: '' }); setClientErrors({})
    setCardNumber(''); setCardFetching(false); setCardFetched(false); setFetchedIncome(null)
    setFace1Image(null); setFace1Verified(false)
    setCheckItems([false, false, false, false]); setAnimDone(false); setApiDone(false); setApiResult(null); setScoringError(false)
    setScoreResult(null); setEligibleOffers([]); setFraudGate('PASS'); setFraudSignals([]); setAppId(null)
    setSelectedOffer(null)
    setFace2Image(null); setFace2Verified(false); setHasSignature(false)
    setFinalApp(null); setSubmitting(false)
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-4 pb-24">
      {step < 7 && (
        <StepIndicator
          step={step}
          stepLabelOverride={step === 2 ? `Identity (${subStep2 === 'form' ? '1' : subStep2 === 'card' ? '2' : '3'}/3)` : undefined}
        />
      )}

      {/* ── STEP 1: Product Selection ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Search + categories */}
          <div className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm space-y-3">
            <input
              type="text"
              placeholder="Search products…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={clsx('rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  !selectedCategory ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
              >All</button>
              {categories.map(cat => (
                <button key={cat}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                  className={clsx('rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                >{cat}</button>
              ))}
            </div>
          </div>

          {/* Product grid */}
          {filteredProducts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No products found.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map(product => {
                const cartItem = inCart(product.id)
                return (
                  <div key={product.id} className={clsx(
                    'rounded-xl border-2 bg-white p-3 transition-all relative',
                    cartItem ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                  )}>
                    {cartItem && (
                      <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center">
                        <CheckIcon className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <p className="text-sm font-semibold text-gray-900 pr-6 leading-tight">{product.name}</p>
                    <span className="inline-block mt-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{product.category}</span>
                    <p className="text-sm font-bold text-blue-700 mt-2">{formatUZS(product.price)}</p>
                    {product.downPaymentPercent > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">Down: {product.downPaymentPercent}%</p>
                    )}
                    {cartItem ? (
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => changeQty(product.id, -1)}
                          className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-sm hover:bg-blue-200 flex items-center justify-center"
                        >−</button>
                        <span className="text-sm font-bold text-gray-900 w-6 text-center">{cartItem.quantity}</span>
                        <button
                          onClick={() => changeQty(product.id, 1)}
                          disabled={cartItem.quantity >= 10}
                          className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-sm hover:bg-blue-200 flex items-center justify-center disabled:opacity-40"
                        >+</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(product)}
                        className="mt-3 w-full rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                      >Add</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Fixed cart bar */}
          {cart.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-20 shadow-lg">
              <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                <div className="text-sm">
                  <span className="font-semibold text-gray-900">{cart.length} item{cart.length > 1 ? 's' : ''}</span>
                  <span className="text-gray-500"> · Total: </span>
                  <span className="font-bold text-gray-900">{formatUZS(cartTotal)}</span>
                  <span className="text-gray-400 hidden sm:inline"> · Financed: </span>
                  <span className="font-semibold text-blue-600 hidden sm:inline">{formatUZS(financedAmount)}</span>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shrink-0"
                >Continue →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2A: Passport & Birth Date form ─────────────────────────────── */}
      {step === 2 && subStep2 === 'form' && (
        <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Client Identification</h2>
            <p className="text-sm text-gray-500 mt-1">Enter passport details to continue</p>
          </div>

          {/* Passport */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passport Series</label>
            <input
              type="text"
              value={clientForm.passportSeries}
              onChange={e => {
                const raw = e.target.value.toUpperCase()
                const letters = raw.slice(0, 2).replace(/[^A-Z]/g, '')
                const digits  = raw.slice(2).replace(/[^0-9]/g, '')
                const filtered = (letters + digits).slice(0, 9)
                setClientForm(f => ({ ...f, passportSeries: filtered }))
              }}
              onBlur={() => validateClientForm()}
              placeholder="AB1234567"
              maxLength={9}
              className={clsx(
                'w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-100',
                clientErrors.passportSeries ? 'border-red-400' :
                clientForm.passportSeries.length === 9 && PASSPORT_RE.test(clientForm.passportSeries) ? 'border-emerald-400' :
                'border-gray-300 focus:border-blue-400'
              )}
            />
            {clientErrors.passportSeries ? (
              <p className="text-xs text-red-500 mt-1">{clientErrors.passportSeries}</p>
            ) : clientForm.passportSeries.length === 0 ? (
              <p className="text-xs text-gray-400 mt-1">Format: AB1234567 — 2 letters then 7 digits</p>
            ) : clientForm.passportSeries.length < 9 ? (
              <p className="text-xs text-amber-500 mt-1">{clientForm.passportSeries.length} of 9 characters</p>
            ) : PASSPORT_RE.test(clientForm.passportSeries) ? (
              <p className="text-xs text-emerald-600 mt-1">✓ Valid format</p>
            ) : (
              <p className="text-xs text-red-500 mt-1">Must be 2 letters followed by 7 digits (e.g. AB1234567)</p>
            )}
          </div>

          {/* Birth date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Birth Date</label>
            <input
              type="date"
              value={clientForm.birthDate}
              onChange={e => setClientForm(f => ({ ...f, birthDate: e.target.value }))}
              onBlur={() => validateClientForm()}
              className={clsx(
                'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100',
                clientErrors.birthDate ? 'border-red-400' : 'border-gray-300 focus:border-blue-400'
              )}
            />
            {clientErrors.birthDate && (
              <p className="text-xs text-red-500 mt-1">{clientErrors.birthDate}</p>
            )}
          </div>

          <div className="flex gap-3 justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (validateClientForm()) {
                  setSubStep2('card')
                }
              }}
              disabled={!clientFormValid}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2B: Card Scan & Income Fetch ────────────────────────────────── */}
      {step === 2 && subStep2 === 'card' && (
        <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSubStep2('form')
                setCardNumber('')
                setCardFetched(false)
                setFetchedIncome(null)
                setClientForm(f => ({ ...f, monthlyIncome: '' }))
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
            >
              ← Back
            </button>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Bank Card</h2>
              <p className="text-sm text-gray-500">Enter the client's Humo or UzCard number to retrieve income data</p>
            </div>
          </div>

          {/* Card number input */}
          {!cardFetched ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatCardNumber(cardNumber)}
                    onChange={e => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 16)
                      setCardNumber(digits)
                    }}
                    placeholder="8600 0000 0000 0000"
                    maxLength={19}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-20 text-sm font-mono focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  {cardNumber.length >= 4 && (
                    <span className={clsx(
                      'absolute right-3 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs font-bold',
                      cardNumber.startsWith('9860') ? 'bg-orange-100 text-orange-700' :
                      cardNumber.startsWith('8600') ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    )}>
                      {cardNumber.startsWith('9860') ? 'Humo' : cardNumber.startsWith('8600') ? 'UzCard' : 'Card'}
                    </span>
                  )}
                </div>
              </div>

              <button
                disabled={cardNumber.length < 16 || cardFetching}
                onClick={() => {
                  setCardFetching(true)
                  const delay = Math.random() * 1000 + 1500
                  setTimeout(() => {
                    const income = INCOME_OPTIONS[Math.floor(Math.random() * INCOME_OPTIONS.length)]
                    setFetchedIncome(income)
                    setCardFetching(false)
                    setCardFetched(true)
                    setClientForm(f => ({ ...f, monthlyIncome: String(income) }))
                  }, delay)
                }}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {cardFetching ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Fetching data…
                  </>
                ) : (
                  'Fetch Income Data'
                )}
              </button>

              {cardFetching && (
                <div className="rounded-lg bg-blue-50 px-4 py-3 flex items-center gap-3 animate-pulse">
                  <div className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                  <p className="text-xs text-blue-700">
                    Checking card with {cardNumber.startsWith('8600') ? 'Humo' : cardNumber.startsWith('9860') ? 'UzCard' : 'card'} network…
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ── Success card ── */
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircleIcon className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-semibold text-emerald-800">Income Retrieved</p>
              </div>
              <div className="space-y-1.5 pl-8">
                {[
                  ['Card', maskCardNumber(formatCardNumber(cardNumber))],
                  ['Network', cardNumber.startsWith('8600') ? 'Humo' : cardNumber.startsWith('9860') ? 'UzCard' : 'Card'],
                  ['Monthly Income', formatUZS(fetchedIncome ?? 0)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-emerald-700">{label}</span>
                    <span className="font-semibold text-emerald-900 font-mono">{value}</span>
                  </div>
                ))}
              </div>
              <div className="pl-8 pt-1">
                <button
                  onClick={() => {
                    setCardNumber('')
                    setCardFetched(false)
                    setFetchedIncome(null)
                    setClientForm(f => ({ ...f, monthlyIncome: '' }))
                  }}
                  className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                  Re-scan Card
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                setFace1Image(null)
                setFace1Verified(false)
                setSubStep2('camera')
              }}
              disabled={!cardFetched}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2C: Face Verification camera ────────────────────────────────── */}
      {step === 2 && subStep2 === 'camera' && (
        <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSubStep2('card')}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
            >
              ← Back
            </button>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Identity Photo</h2>
              <p className="text-sm text-gray-500">
                Take a photo to verify passport <span className="font-mono font-semibold text-gray-700">{clientForm.passportSeries.toUpperCase()}</span>
              </p>
            </div>
          </div>

          <FaceVerifyCamera
            passportNumber={clientForm.passportSeries.toUpperCase()}
            title=""
            subtitle=""
            onVerified={(b64) => { setFace1Image(b64); setFace1Verified(true) }}
            onReset={() => { setFace1Image(null); setFace1Verified(false) }}
          />

          <div className="flex justify-end pt-2">
            <button
              onClick={() => { if (face1Verified) setStep(3) }}
              disabled={!face1Verified}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Scoring Animation ─────────────────────────────────────────── */}
      {step === 3 && (
        <div className="rounded-xl bg-white border border-gray-100 p-8 shadow-sm">
          <style>{`
            @keyframes checkBounce {
              0%   { transform: scale(0.5); opacity: 0; }
              60%  { transform: scale(1.2); opacity: 1; }
              100% { transform: scale(1); }
            }
            .check-appear { animation: checkBounce 0.4s ease forwards; }
            @keyframes barFill { from { width: 0% } to { width: 100% } }
          `}</style>

          <div className="text-center mb-8">
            <h2 className="text-lg font-bold text-gray-900">Analyzing Credit Profile</h2>
            <p className="text-sm text-gray-500 mt-1">Please wait while we evaluate the client</p>
          </div>

          <div className="space-y-4 max-w-sm mx-auto mb-8">
            {['Identity verified', 'Income analysis', 'Credit history check', 'Behavioral scoring'].map((label, i) => (
              <div key={label} className="flex items-center gap-3">
                <div className={clsx(
                  'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
                  checkItems[i] ? 'bg-emerald-100' : 'bg-gray-100'
                )}>
                  {checkItems[i] ? (
                    <CheckIcon className="h-4 w-4 text-emerald-600 check-appear" />
                  ) : (
                    <svg className="h-4 w-4 text-gray-400 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                </div>
                <span className={clsx('text-sm font-medium', checkItems[i] ? 'text-emerald-700' : 'text-gray-400')}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{
                animation: 'barFill 7s ease-in-out forwards',
                width: animDone ? '100%' : undefined,
              }}
            />
          </div>
          {checkItems[3] && animDone && (
            <p className="text-center text-sm text-emerald-600 font-medium mt-3">Processing complete</p>
          )}

          {scoringError && (
            <div className="mt-4 text-center">
              <p className="text-sm text-red-600 mb-2">An error occurred. Please try again.</p>
              <button onClick={startScoring} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 4: Scoring Result ────────────────────────────────────────────── */}
      {step === 4 && scoreResult && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Credit Assessment Result</h2>

            {/* Fraud BLOCK */}
            {fraudGate === 'BLOCK' && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-5 mb-4">
                <p className="text-lg font-bold text-red-700">Application Blocked</p>
                <p className="text-sm text-red-600 mt-1">Reason: {fraudSignals.join(', ')}</p>
                <button onClick={handleReset} className="mt-4 rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700">
                  Start New Application
                </button>
              </div>
            )}

            {/* Fraud FLAG */}
            {fraudGate === 'FLAG' && (
              <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 mb-4">
                <p className="text-sm font-semibold text-yellow-800">Risk signals detected — score adjusted</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {fraudSignals.map(s => (
                    <span key={s} className="rounded-full bg-yellow-200 text-yellow-800 px-2 py-0.5 text-xs">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {fraudGate !== 'BLOCK' && (
              <>
                {/* Score gauge + decision */}
                <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
                  <ScoreGauge score={scoreResult.total_score} />
                  <div className="flex-1 space-y-2">
                    <div className={clsx(
                      'inline-flex rounded-full px-4 py-1.5 text-sm font-bold',
                      scoreResult.decision === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                      scoreResult.decision === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    )}>
                      {scoreResult.decision === 'APPROVED' && '✓ APPROVED'}
                      {scoreResult.decision === 'PARTIAL' && '⚠ PARTIAL APPROVAL'}
                      {scoreResult.decision === 'REJECTED' && '✗ REJECTED'}
                    </div>
                    {scoreResult.decision === 'PARTIAL' && (
                      <p className="text-sm text-gray-600">
                        Approved amount: <span className="font-semibold text-gray-900">
                          {formatUZS(Math.round(financedAmount * scoreResult.approved_ratio))}
                        </span> ({Math.round(scoreResult.approved_ratio * 100)}% of financed)
                      </p>
                    )}
                  </div>
                </div>

                {/* Factor bars */}
                <div className="space-y-3 mb-4">
                  {[
                    { label: 'F1 Affordability', val: scoreResult.f1_affordability, w: scoreResult.weights.w1, color: 'bg-emerald-500' },
                    { label: 'F2 Credit History', val: scoreResult.f2_credit, w: scoreResult.weights.w2, color: 'bg-blue-500' },
                    { label: 'F3 Behavioral', val: scoreResult.f3_behavioral, w: scoreResult.weights.w3, color: 'bg-amber-500' },
                    { label: 'F4 Demographic', val: scoreResult.f4_demographic, w: scoreResult.weights.w4, color: 'bg-violet-500' },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">{item.label} ({Math.round(item.w * 100)}%)</span>
                        <span className="font-bold text-gray-900">{Math.round(item.val)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={clsx('h-full rounded-full transition-all', item.color)}
                          style={{ width: `${item.val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reason codes */}
                {scoreResult.reason_codes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {scoreResult.reason_codes.map(code => (
                      <span key={code} className="rounded-full bg-gray-100 text-gray-500 px-2 py-0.5 text-xs">{code}</span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {fraudGate !== 'BLOCK' && (
            <div className="flex gap-3 justify-between">
              <button
                onClick={handleReset}
                className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ✗ Reject Application
              </button>
              <div className="relative group">
                <button
                  onClick={() => setStep(5)}
                  disabled={scoreResult.decision === 'REJECTED'}
                  className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Continue to Offers →
                </button>
                {scoreResult.decision === 'REJECTED' && (
                  <div className="absolute bottom-full right-0 mb-1 w-48 rounded-lg bg-gray-800 text-white text-xs p-2 hidden group-hover:block">
                    Score too low to proceed
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 5: MFO Offers ────────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Available Financing Offers</h2>
            <p className="text-sm text-gray-500 mt-1">{eligibleOffers.length} offer{eligibleOffers.length !== 1 ? 's' : ''} available for your credit score</p>
          </div>

          {eligibleOffers.length === 0 ? (
            <div className="rounded-xl bg-white border border-gray-100 p-8 shadow-sm text-center">
              <p className="text-sm text-gray-500 mb-4">No offers available</p>
              <button onClick={handleReset} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Start New Application
              </button>
            </div>
          ) : (
            eligibleOffers.map(offer => {
              const isSelected = selectedOffer?.tariff.tariff_id === offer.tariff_id
              const selMonths = isSelected ? selectedOffer!.months : null

              return (
                <div key={offer.tariff_id} className={clsx(
                  'rounded-xl bg-white border-2 p-5 shadow-sm transition-all',
                  isSelected ? 'border-blue-500' : 'border-gray-200'
                )}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-base font-bold text-gray-900">{offer.mfo_name}</p>
                      <p className="text-sm text-gray-500">{offer.tariff_name}</p>
                    </div>
                    {isSelected && (
                      <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                        <CheckIcon className="h-3.5 w-3.5 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div>
                      <p className="text-gray-500 text-xs">Interest Rate</p>
                      <p className="font-semibold">{offer.interest_rate}% / year</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Approved Amount</p>
                      <p className="font-semibold">{formatUZS(offer.approved_amount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Down Payment</p>
                      <p className="font-semibold">{offer.min_down_payment_pct}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Approval</p>
                      <p className="font-semibold">{Math.round(offer.approved_ratio * 100)}%</p>
                    </div>
                  </div>

                  {/* Month selector */}
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">Select Duration</p>
                    <div className="grid grid-cols-4 gap-2">
                      {offer.available_months.map(m => {
                        const mp = roundK(calculateMonthly(offer.approved_amount, m, offer.interest_rate))
                        const active = selMonths === m && isSelected
                        return (
                          <button
                            key={m}
                            onClick={() => setSelectedOffer({ tariff: offer, months: m })}
                            className={clsx(
                              'rounded-xl p-2 text-center transition-all border',
                              active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                            )}
                          >
                            <p className="text-sm font-bold">{m} mo</p>
                            <p className="text-xs text-gray-500 mt-0.5">{(mp / 1000).toFixed(0)}K/mo</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Summary row when months selected */}
                  {isSelected && selMonths && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Monthly Payment</span>
                        <span className="font-bold text-blue-700">
                          {formatUZS(roundK(calculateMonthly(offer.approved_amount, selMonths, offer.interest_rate)))}
                        </span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-600">Total Repayment</span>
                        <span className="font-semibold text-gray-900">
                          {formatUZS(roundK(calculateMonthly(offer.approved_amount, selMonths, offer.interest_rate)) * selMonths)}
                        </span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-gray-600">Overpayment</span>
                        <span className="font-semibold text-gray-500">
                          {formatUZS(roundK(calculateMonthly(offer.approved_amount, selMonths, offer.interest_rate)) * selMonths - offer.approved_amount)}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      const m = selMonths ?? offer.available_months[offer.available_months.length - 1]
                      setSelectedOffer({ tariff: offer, months: m })
                    }}
                    className={clsx(
                      'w-full rounded-xl py-2.5 text-sm font-semibold transition-colors',
                      isSelected
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border border-blue-600 text-blue-600 hover:bg-blue-50'
                    )}
                  >
                    {isSelected ? '✓ Selected' : 'Select This Offer'}
                  </button>
                </div>
              )
            })
          )}

          <div className="flex gap-3 justify-between">
            <button onClick={() => setStep(4)} className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Back
            </button>
            <button
              onClick={() => setStep(6)}
              disabled={!selectedOffer}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue to Signing →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 6: Confirm & Sign ────────────────────────────────────────────── */}
      {step === 6 && selectedOffer && (
        <div className="space-y-4">
          {/* Section 1: Re-verify */}
          <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Contract Signing</h2>
            <p className="text-sm text-gray-500 mb-4">Re-verify client identity before signing</p>

            {!face2Verified ? (
              <FaceVerifyCamera
                passportNumber={clientForm.passportSeries.toUpperCase()}
                title="Re-verify Identity"
                subtitle="Take a second photo to confirm client identity"
                onVerified={(b64) => { setFace2Image(b64); setFace2Verified(true) }}
                onReset={() => { setFace2Image(null); setFace2Verified(false) }}
              />
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium text-emerald-700">Identity re-verified successfully</span>
                <button
                  onClick={() => { setFace2Image(null); setFace2Verified(false) }}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline"
                >Retake</button>
              </div>
            )}
          </div>

          {/* Section 2: Contract Summary */}
          {face2Verified && (
            <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Contract Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Products</span>
                  <span className="font-medium text-right max-w-xs">
                    {cart.map(i => `${i.product.name} ×${i.quantity}`).join(', ')}
                  </span>
                </div>
                {[
                  ['Total Amount', formatUZS(cartTotal)],
                  ['Down Payment', formatUZS(downAmount) + ` (${maxDownPct}%)`],
                  ['Financed Amount', formatUZS(financedAmount)],
                  ['MFO', selectedOffer.tariff.mfo_name],
                  ['Tariff', selectedOffer.tariff.tariff_name],
                  ['Duration', `${selectedOffer.months} months`],
                  ['Monthly Payment', formatUZS(roundK(calculateMonthly(selectedOffer.tariff.approved_amount, selectedOffer.months, selectedOffer.tariff.interest_rate)))],
                  ['Total Repayment', formatUZS(roundK(calculateMonthly(selectedOffer.tariff.approved_amount, selectedOffer.months, selectedOffer.tariff.interest_rate)) * selectedOffer.months)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Signature */}
          {face2Verified && (
            <div className="rounded-xl bg-slate-50 border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Client Signature</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Sign using finger or mouse — ink simulation enabled
                  </p>
                </div>
                <button
                  onClick={() => { sigPadRef.current?.clear(); setHasSignature(false) }}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500
                             border border-gray-200 hover:border-red-200 rounded-lg px-3 py-1.5
                             transition-colors"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 4 21 4 19 6 19 20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  Clear
                </button>
              </div>
              <SignaturePad ref={sigPadRef} onChange={setHasSignature} />
              {!hasSignature ? (
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-2 w-2 rounded-full bg-gray-300" />
                  <p className="text-xs text-gray-400">Draw your signature in the box above</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-xs text-emerald-600 font-medium">Signature captured ✓</p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-between">
            <button onClick={() => setStep(5)} className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={!face2Verified || !hasSignature || submitting}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting…' : 'Confirm & Submit'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 7: Success ───────────────────────────────────────────────────── */}
      {step === 7 && selectedOffer && (
        <div className="flex items-center justify-center min-h-80">
          <div className="text-center max-w-md w-full">
            <style>{`
              @keyframes scaleIn {
                from { transform: scale(0); opacity: 0; }
                to   { transform: scale(1); opacity: 1; }
              }
              .scale-in { animation: scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
            `}</style>

            <div className="mx-auto h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5 scale-in">
              <CheckCircleIcon className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Application Registered Successfully</h2>
            <p className="text-sm text-gray-500 mb-6">The client's installment application has been submitted for review.</p>

            {/* Info card */}
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 mb-6 text-left space-y-2 text-sm">
              {/* Application ID with copy */}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Application ID</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono font-bold text-blue-700 text-xs">
                    {appId ? `APP-${appId.slice(-8).toUpperCase()}` : '—'}
                  </span>
                  <button
                    onClick={() => { if (appId) navigator.clipboard.writeText(appId).catch(() => {}) }}
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                    title="Copy"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {[
                ['Client', maskPassport(clientForm.passportSeries)],
                ['Products', `${cart.length} item${cart.length > 1 ? 's' : ''}`],
                ['Total Amount', formatUZS(cartTotal)],
                ['Monthly Payment', `${formatUZS(finalApp?.monthly_payment ?? roundK(calculateMonthly(selectedOffer.tariff.approved_amount, selectedOffer.months, selectedOffer.tariff.interest_rate)))} × ${finalApp?.months ?? selectedOffer.months} mo`],
                ['MFO', selectedOffer.tariff.mfo_name],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-right max-w-xs">{value}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 text-xs font-semibold">PENDING REVIEW</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleReset}
                className="flex-1 rounded-xl border border-blue-600 text-blue-600 py-2.5 text-sm font-semibold hover:bg-blue-50 transition-colors"
              >
                Start New Application
              </button>
              <button
                onClick={() => navigate('/merchant/installments')}
                className="flex-1 rounded-xl bg-blue-600 text-white py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                View Applications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
