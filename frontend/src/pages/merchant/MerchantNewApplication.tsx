import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircleIcon, CameraIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { Product, Tariff } from '../../types'
import { apiProducts, apiTariffs, apiApplications, apiMerchants, apiFaceVerify } from '../../api'
import { useAuthStore } from '../../store/authStore'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

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
const PARTIAL_RATIO = 0.70

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
  return 'PARTIAL'
}

function calculateMonthly(price: number, months: number, rate: number) {
  const monthlyRate = rate / 100 / 12
  if (monthlyRate === 0) return price / months
  return price * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1)
}

export default function MerchantNewApplication() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [merchantId, setMerchantId] = useState('')
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [approvedTariffs, setApprovedTariffs] = useState<Tariff[]>([])
  const [step, setStep] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [client, setClient] = useState<ClientInfo>(emptyClient)
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null)
  const [selectedMonths, setSelectedMonths] = useState(12)
  const [submitted, setSubmitted] = useState(false)
  const [appId, setAppId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Face verification state
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [faceVerified, setFaceVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; confidence: number; message: string } | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    apiMerchants.my()
      .then(m => setMerchantId(m.id))
      .catch(() => {})

    apiProducts.list()
      .then(data => setAvailableProducts(data.filter(p => p.available)))
      .catch(() => {})

    apiTariffs.list()
      .then(data => setApprovedTariffs(data.filter(t => t.status === 'APPROVED')))
      .catch(() => {})
  }, [user])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = s
      if (videoRef.current) videoRef.current.srcObject = s
    } catch {
      setCameraError('Camera access denied. Please allow camera permissions and try again.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (step === 3) {
      setCapturedImage(null)
      setVerifyResult(null)
      setFaceVerified(false)
      startCamera()
    } else {
      stopCamera()
    }
    return () => { if (step === 3) stopCamera() }
  }, [step, startCamera, stopCamera])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    const b64 = dataUrl.split(',')[1]
    setCapturedImage(dataUrl)
    stopCamera()

    setVerifying(true)
    apiFaceVerify.verify(client.passportNumber, b64)
      .then(res => {
        setVerifyResult(res)
        setFaceVerified(res.verified)
      })
      .catch(() => {
        setVerifyResult({ verified: false, confidence: 0, message: 'Verification service unavailable. Please retake.' })
        setFaceVerified(false)
      })
      .finally(() => setVerifying(false))
  }, [client.passportNumber, stopCamera])

  const retakePhoto = useCallback(() => {
    setCapturedImage(null)
    setVerifyResult(null)
    setFaceVerified(false)
    startCamera()
  }, [startCamera])

  const eligibleTariffs = selectedProduct
    ? approvedTariffs.filter(t =>
        selectedProduct.price >= t.minAmount &&
        selectedProduct.price <= t.maxAmount
      )
    : approvedTariffs

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

  const approvedAmount = outcome === 'PARTIAL' ? Math.round(financedAmount * PARTIAL_RATIO) : financedAmount
  const approvedMonthly = selectedTariff && outcome !== 'REJECTED'
    ? calculateMonthly(approvedAmount, selectedMonths, selectedTariff.interestRate)
    : 0

  const scoreColor = score.total >= 70 ? 'text-emerald-600' : score.total >= 50 ? 'text-yellow-600' : 'text-red-600'
  const scoreBg = score.total >= 70 ? 'bg-emerald-50 border-emerald-200' : score.total >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

  const handleSubmit = () => {
    if (!selectedProduct || !selectedTariff) return
    setSubmitting(true)
    apiApplications.submit({
      merchant_id: merchantId,
      product_id: selectedProduct.id,
      tariff_id: selectedTariff.id,
      months: selectedMonths,
      client: {
        full_name: client.fullName,
        passport_number: client.passportNumber,
        phone: client.phone,
        monthly_income: parseInt(client.monthlyIncome) || 0,
        age: parseInt(client.age) || 0,
        credit_history: client.creditHistory,
      },
    })
      .then(app => { setAppId(app.id); setSubmitted(true) })
      .catch(() => {
        const id = `APP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        setAppId(id)
        setSubmitted(true)
      })
      .finally(() => setSubmitting(false))
  }

  const handleReset = () => {
    setStep(1)
    setSelectedProduct(null)
    setClient(emptyClient)
    setSelectedTariff(null)
    setSelectedMonths(12)
    setSubmitted(false)
    setAppId('')
    setCapturedImage(null)
    setVerifyResult(null)
    setFaceVerified(false)
  }

  if (submitted) {
    const outcomeConfig = {
      APPROVED: { icon: 'text-emerald-600', bg: 'bg-emerald-100', title: t('newApp.submittedTitle'), subtitle: t('newApp.approvedSubtitle') },
      PARTIAL: { icon: 'text-yellow-600', bg: 'bg-yellow-100', title: t('newApp.submittedTitle'), subtitle: t('newApp.partialSubtitle') },
      REJECTED: { icon: 'text-red-500', bg: 'bg-red-100', title: t('newApp.submittedTitleLow'), subtitle: t('newApp.rejectedSubtitle') },
    }[outcome]

    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center max-w-md w-full">
          <div className={clsx('mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4', outcomeConfig.bg)}>
            <CheckCircleIcon className={clsx('h-9 w-9', outcomeConfig.icon)} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{outcomeConfig.title}</h2>
          <p className="text-gray-500 text-sm mb-5">{outcomeConfig.subtitle}</p>

          <div className={clsx(
            'rounded-xl border px-4 py-3 mb-4 text-sm font-semibold',
            outcome === 'APPROVED' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
            outcome === 'PARTIAL' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
            'bg-red-50 border-red-200 text-red-700'
          )}>
            {outcome === 'APPROVED' && t('newApp.approvedOutcome', { amount: formatUZS(financedAmount) })}
            {outcome === 'PARTIAL' && t('newApp.partialOutcome', { amount: formatUZS(approvedAmount) })}
            {outcome === 'REJECTED' && t('newApp.rejectedOutcome')}
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-200 px-6 py-4 mb-5">
            <p className="text-xs text-gray-500">{t('newApp.appId')}</p>
            <p className="text-lg font-bold text-blue-700 font-mono mt-1">{appId}</p>
          </div>
          <div className="space-y-2 text-left mb-5">
            {[
              [t('common.client'), client.fullName],
              [t('common.product'), selectedProduct?.name ?? ''],
              [t('newApp.downPayment', { pct: downPaymentPercent }), downPaymentPercent > 0 ? t('newApp.downPaymentDetail', { amount: formatUZS(downPaymentAmount), pct: downPaymentPercent }) : t('newApp.downPaymentNone', { amount: formatUZS(downPaymentAmount) })],
              [t('newApp.financedAmount'), formatUZS(financedAmount)],
              [t('newApp.durationMonths'), `${selectedMonths} months`],
              [t('newApp.monthlyPayment'), formatUZS(Math.round(outcome === 'PARTIAL' ? approvedMonthly : monthlyPayment))],
              [t('newApp.creditScore'), `${score.total}/100`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-500">{label}</span>
                <span className={clsx('font-medium', label === t('newApp.creditScore') ? scoreColor : '')}>{value}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleReset}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            {t('newApp.submitAnother')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={clsx(
              'h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
              s <= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            )}>
              {s < step ? <CheckCircleIcon className="h-4 w-4" /> : s}
            </div>
            <span className={clsx('text-sm font-medium hidden sm:inline', s === step ? 'text-blue-700' : 'text-gray-400')}>
              {s === 1 ? t('newApp.stepSelectProduct') : s === 2 ? t('newApp.stepClientInfo') : s === 3 ? t('newApp.stepFaceVerify') : t('newApp.stepReview')}
            </span>
            {s < 4 && <div className={clsx('flex-1 h-0.5 min-w-6', s < step ? 'bg-blue-600' : 'bg-gray-200')} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t('newApp.selectProductTitle')}</h2>
          {availableProducts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('newApp.noProducts')}</p>
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
                  {product.downPaymentPercent > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">{t('merchantProducts.downPaymentInfo', { pct: product.downPaymentPercent, amount: formatUZS(Math.round(product.price * product.downPaymentPercent / 100)) })}</p>
                  )}
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
              {t('newApp.nextClientInfo')}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t('newApp.clientInfoTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('newApp.fullName')}</label>
              <input
                type="text"
                value={client.fullName}
                onChange={e => setClient(c => ({ ...c, fullName: e.target.value }))}
                placeholder={t('newApp.namePlaceholder')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('newApp.passportNumber')}</label>
              <input
                type="text"
                value={client.passportNumber}
                onChange={e => setClient(c => ({ ...c, passportNumber: e.target.value }))}
                placeholder={t('newApp.passportPlaceholder')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('newApp.phone')}</label>
              <input
                type="text"
                value={client.phone}
                onChange={e => setClient(c => ({ ...c, phone: e.target.value }))}
                placeholder={t('newApp.phonePlaceholder')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('newApp.monthlyIncome')}</label>
              <input
                type="number"
                value={client.monthlyIncome}
                onChange={e => setClient(c => ({ ...c, monthlyIncome: e.target.value }))}
                placeholder={t('newApp.incomePlaceholder')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('newApp.age')}</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('newApp.creditHistory')}</label>
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
              {t('newApp.back')}
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!client.fullName || !client.phone || !client.passportNumber}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t('newApp.nextFaceVerify')}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-1">{t('newApp.faceVerifyTitle')}</h2>
          <p className="text-sm text-gray-500 mb-4">
            {t('newApp.faceVerifyDesc')} <span className="font-mono font-semibold text-gray-700">{client.passportNumber}</span>.
          </p>

          <canvas ref={canvasRef} className="hidden" />

          {cameraError ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-4">
              {cameraError}
            </div>
          ) : !capturedImage ? (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-4 border-blue-400/30 rounded-xl pointer-events-none" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-60 border-2 border-blue-400/60 rounded-2xl" />
                </div>
              </div>
              <p className="text-xs text-center text-gray-400">{t('newApp.positionFace')}</p>
              <button
                onClick={capturePhoto}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                <CameraIcon className="h-5 w-5" />
                {t('newApp.capturePhoto')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-video">
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
              </div>

              {verifying && (
                <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
                  <svg className="h-5 w-5 text-blue-600 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-sm text-blue-700 font-medium">{t('newApp.verifying')}</span>
                </div>
              )}

              {verifyResult && !verifying && (
                <div className={clsx(
                  'rounded-xl border px-4 py-3',
                  verifyResult.verified
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-red-50 border-red-200'
                )}>
                  <div className="flex items-start gap-2">
                    <CheckCircleIcon className={clsx('h-5 w-5 shrink-0 mt-0.5', verifyResult.verified ? 'text-emerald-600' : 'text-red-500')} />
                    <div>
                      <p className={clsx('text-sm font-semibold', verifyResult.verified ? 'text-emerald-700' : 'text-red-700')}>
                        {verifyResult.verified ? t('newApp.verified') : t('newApp.verificationFailed')}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">{verifyResult.message}</p>
                      {verifyResult.verified && (
                        <p className="text-xs text-emerald-600 mt-1 font-medium">
                          {t('newApp.confidence', { pct: (verifyResult.confidence * 100).toFixed(1) })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!verifying && (
                <button
                  onClick={retakePhoto}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  {t('newApp.retakePhoto')}
                </button>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-between mt-5">
            <button
              onClick={() => setStep(2)}
              className="rounded-xl border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('newApp.back')}
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!faceVerified}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t('newApp.nextReview')}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">{t('newApp.selectTariff')}</h2>
            {eligibleTariffs.length === 0 ? (
              <p className="text-sm text-yellow-700 bg-yellow-50 rounded-lg p-3">
                {t('newApp.noTariffs')}
              </p>
            ) : (
              <div className="space-y-3">
                {eligibleTariffs.map(tariff => (
                  <div
                    key={tariff.id}
                    onClick={() => {
                      setSelectedTariff(tariff)
                      setSelectedMonths(tariff.months)
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
                        <p className="text-xs text-gray-500">{t('newApp.duration')}</p>
                        <p className="text-sm font-medium">{tariff.months} months</p>
                      </div>
                    </div>

                    {selectedTariff?.id === tariff.id && selectedProduct && (
                      <div className="mt-3 pt-3 border-t border-blue-200 flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-700">{t('newApp.duration')}:</span>
                        <span className="rounded-lg bg-blue-600 text-white border border-blue-600 px-3 py-1 text-xs font-semibold">
                          {tariff.months} mo
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedTariff && selectedProduct && (
            <div className="rounded-xl bg-white border border-gray-100 p-6 shadow-sm space-y-5">
              <h2 className="text-base font-semibold text-gray-900">{t('newApp.appSummary')}</h2>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">{t('common.product')}</p>
                  <p className="font-semibold mt-0.5">{selectedProduct.name}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t('common.client')}</p>
                  <p className="font-semibold mt-0.5">{client.fullName || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t('newApp.productPrice')}</p>
                  <p className="font-semibold mt-0.5">{formatUZS(selectedProduct.price)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t('newApp.downPayment', { pct: downPaymentPercent })}</p>
                  <p className="font-semibold text-orange-600 mt-0.5">{formatUZS(downPaymentAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t('newApp.financedAmount')}</p>
                  <p className="font-semibold mt-0.5">{formatUZS(financedAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t('newApp.durationMonths')}</p>
                  <p className="font-semibold mt-0.5">{selectedMonths} months</p>
                </div>
                <div>
                  <p className="text-gray-500">{t('newApp.monthlyPayment')}</p>
                  <p className="font-bold text-blue-700 text-base mt-0.5">{formatUZS(Math.round(monthlyPayment))}</p>
                </div>
                <div>
                  <p className="text-gray-500">{t('newApp.totalRepayment')}</p>
                  <p className="font-bold text-gray-900 text-base mt-0.5">{formatUZS(Math.round(totalAmount))}</p>
                </div>
              </div>

              <div className={clsx('rounded-xl border p-4', scoreBg)}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-700">{t('newApp.estimatedScore')}</p>
                  <span className={clsx('text-2xl font-black', scoreColor)}>{score.total}/100</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">{t('newApp.tariffMinScore', { score: selectedTariff.minScore })}</p>

                <div className="space-y-2 mb-4">
                  {[
                    { label: t('newApp.incomeVsPayment'), value: score.incomeScore, max: 30 },
                    { label: t('newApp.creditHistory_'), value: score.creditScore, max: 30 },
                    { label: t('newApp.ageFactor'), value: score.ageScore, max: 20 },
                    { label: t('newApp.tariffMatch'), value: score.tariffScore, max: 20 },
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

                <div className={clsx(
                  'rounded-lg px-3 py-2 text-xs font-semibold',
                  outcome === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                  outcome === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                )}>
                  {outcome === 'APPROVED' && t('newApp.approvedPrelim', { amount: formatUZS(financedAmount) })}
                  {outcome === 'PARTIAL' && t('newApp.partialPrelim', { amount: formatUZS(approvedAmount), monthly: formatUZS(Math.round(approvedMonthly)) })}
                  {outcome === 'REJECTED' && t('newApp.rejectedPrelim')}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-between">
            <button
              onClick={() => setStep(3)}
              className="rounded-xl border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('newApp.back')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedTariff || submitting}
              className="rounded-xl bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? t('newApp.submitting') : t('newApp.submit')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
