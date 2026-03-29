import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip,
  Cell as BarCell,
} from 'recharts'
import Button from '../../components/ui/Button'
import { apiScoringConfig, apiScore } from '../../api'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'

interface Config {
  w_affordability: number
  w_credit_history: number
  w_behavioral: number
  w_demographic: number
  min_score: number
  partial_threshold: number
  partial_ratio: number
  hard_dti_min: number
  max_open_loans: number
  max_overdue_days: number
  bankruptcy_reject: boolean
}

interface ScoreResult {
  hard_reject: boolean
  hard_reject_reason: string | null
  f1_affordability: number
  f2_credit: number
  f3_behavioral: number
  f4_demographic: number
  total_score: number
  decision: 'APPROVED' | 'PARTIAL' | 'REJECTED'
  approved_ratio: number
  reason_codes: string[]
}

const WEIGHT_KEYS = ['w_affordability', 'w_credit_history', 'w_behavioral', 'w_demographic'] as const
const WEIGHT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6']

const DEFAULT_CONFIG: Config = {
  w_affordability: 40,
  w_credit_history: 30,
  w_behavioral: 20,
  w_demographic: 10,
  min_score: 70,
  partial_threshold: 50,
  partial_ratio: 70,
  hard_dti_min: 1.5,
  max_open_loans: 5,
  max_overdue_days: 90,
  bankruptcy_reject: true,
}

function inputCls(disabled?: boolean) {
  return `w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 ${
    disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''
  }`
}

function ScoreGauge({ score }: { score: number }) {
  const pct = Math.min(Math.max(score, 0), 100) / 100
  const r = 50, cx = 70, cy = 62
  const angle = Math.PI * (1 - pct)
  const fillX = cx + r * Math.cos(angle)
  const fillY = cy - r * Math.sin(angle)
  const color = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const needleX = cx + (r - 10) * Math.cos(angle)
  const needleY = cy - (r - 10) * Math.sin(angle)
  const bg = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`
  const fill = pct <= 0
    ? null
    : pct >= 1
    ? `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`
    : `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${fillX} ${fillY}`
  return (
    <svg width="140" height="78" viewBox="0 0 140 78">
      <path d={bg} fill="none" stroke="#e5e7eb" strokeWidth={10} strokeLinecap="round" />
      {fill && <path d={fill} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#374151" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={4} fill="#374151" />
    </svg>
  )
}

export default function MFOScoringSettings() {
  const { tariffId } = useParams<{ tariffId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const WEIGHT_LABELS = [t('scoring.factorWeights') + ' F1', 'F2', 'F3', 'F4']
  const WEIGHT_LABEL_NAMES = [t('scoring.f1Affordability'), t('scoring.f2CreditHistory'), t('scoring.f3Behavioral'), t('scoring.f4Demographic')]

  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [tariffName, setTariffName] = useState('')
  const [tariffStatus, setTariffStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [preview, setPreview] = useState({
    monthly_income: 3000000,
    monthly_payment: 500000,
    age: 30,
    credit_history: 'GOOD',
  })
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const [calculating, setCalculating] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const hasCalculated = useRef(false)

  useEffect(() => {
    if (!tariffId) return
    Promise.all([
      api.get(`/api/v1/tariffs/${tariffId}`),
      apiScoringConfig.get(tariffId),
    ])
      .then(([tRes, cRes]) => {
        setTariffName(tRes.data.name)
        setTariffStatus(tRes.data.status)
        const c = cRes as Record<string, number | boolean>
        setConfig({
          w_affordability: Math.round((c.w_affordability as number) * 100),
          w_credit_history: Math.round((c.w_credit_history as number) * 100),
          w_behavioral: Math.round((c.w_behavioral as number) * 100),
          w_demographic: Math.round((c.w_demographic as number) * 100),
          min_score: c.min_score as number,
          partial_threshold: c.partial_threshold as number,
          partial_ratio: Math.round((c.partial_ratio as number) * 100),
          hard_dti_min: c.hard_dti_min as number,
          max_open_loans: c.max_open_loans as number,
          max_overdue_days: c.max_overdue_days as number,
          bankruptcy_reject: c.bankruptcy_reject as boolean,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tariffId])

  const weightsTotal =
    config.w_affordability + config.w_credit_history + config.w_behavioral + config.w_demographic
  const weightsValid = weightsTotal === 100
  const isApproved = tariffStatus === 'APPROVED'

  const runCalculate = useCallback(async () => {
    setCalculating(true)
    try {
      const result = await apiScore.calculate({
        monthly_income: preview.monthly_income,
        monthly_payment: preview.monthly_payment,
        age: preview.age,
        credit_history: preview.credit_history,
        open_loans: 0,
        overdue_days: 0,
        has_bankruptcy: false,
        w_affordability: config.w_affordability / 100,
        w_credit: config.w_credit_history / 100,
        w_behavioral: config.w_behavioral / 100,
        w_demographic: config.w_demographic / 100,
        min_score: config.min_score,
        partial_threshold: config.partial_threshold,
        partial_ratio: config.partial_ratio / 100,
        hard_dti_min: config.hard_dti_min,
        max_open_loans: config.max_open_loans,
        max_overdue_days: config.max_overdue_days,
        bankruptcy_reject: config.bankruptcy_reject,
      })
      setScoreResult(result as ScoreResult)
      hasCalculated.current = true
    } catch {
      // silent
    } finally {
      setCalculating(false)
    }
  }, [config, preview])

  useEffect(() => {
    if (!hasCalculated.current) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(runCalculate, 300)
    return () => clearTimeout(debounceRef.current)
  }, [
    config.w_affordability, config.w_credit_history, config.w_behavioral, config.w_demographic,
    config.min_score, config.partial_threshold, config.partial_ratio,
  ])

  const handleSave = async () => {
    if (!weightsValid || isApproved || !tariffId) return
    setSaving(true)
    setToast(null)
    try {
      await apiScoringConfig.update(tariffId, {
        w_affordability: config.w_affordability / 100,
        w_credit_history: config.w_credit_history / 100,
        w_behavioral: config.w_behavioral / 100,
        w_demographic: config.w_demographic / 100,
        min_score: config.min_score,
        partial_threshold: config.partial_threshold,
        partial_ratio: config.partial_ratio / 100,
        hard_dti_min: config.hard_dti_min,
        max_open_loans: config.max_open_loans,
        max_overdue_days: config.max_overdue_days,
        bankruptcy_reject: config.bankruptcy_reject,
      })
      setToast({ type: 'success', msg: t('scoring.savedSuccess') })
      setTimeout(() => setToast(null), 3500)
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to save'
      setToast({ type: 'error', msg: String(detail) })
    } finally {
      setSaving(false)
    }
  }

  const pieData = WEIGHT_KEYS.map((k, i) => ({ name: WEIGHT_LABEL_NAMES[i], value: config[k] }))

  const barData = scoreResult
    ? [
        { name: 'F1 Afford.', score: scoreResult.f1_affordability, fill: '#10b981' },
        { name: 'F2 Credit', score: scoreResult.f2_credit, fill: '#3b82f6' },
        { name: 'F3 Behav.', score: scoreResult.f3_behavioral, fill: '#f59e0b' },
        { name: 'F4 Demo.', score: scoreResult.f4_demographic, fill: '#8b5cf6' },
      ]
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/mfo/tariffs')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900">{t('scoring.title')}</h1>
          <p className="text-sm text-gray-500">{tariffName}</p>
        </div>
        {isApproved && (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg font-medium">
            {t('scoring.approvedReadOnly')}
          </span>
        )}
      </div>

      {toast && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-medium border ${
          toast.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {toast.type === 'success'
            ? <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
            : <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-5">
          {/* Factor Weights */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">{t('scoring.factorWeights')}</h2>
            <div className="flex gap-5">
              <div className="flex-1 space-y-4">
                {WEIGHT_KEYS.map((key, i) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-gray-700">{WEIGHT_LABEL_NAMES[i]}</label>
                      <span className="text-sm font-bold tabular-nums" style={{ color: WEIGHT_COLORS[i] }}>
                        {config[key]}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5} max={60} step={5}
                      value={config[key]}
                      disabled={isApproved}
                      onChange={e => setConfig(c => ({ ...c, [key]: parseInt(e.target.value) }))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed"
                      style={{ accentColor: WEIGHT_COLORS[i] }}
                    />
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-500 font-medium">{t('scoring.total')}</span>
                    <span className={`font-bold tabular-nums ${weightsValid ? 'text-emerald-600' : 'text-red-500'}`}>
                      {weightsTotal}% / 100%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${weightsValid ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(weightsTotal, 100)}%` }}
                    />
                  </div>
                  {!weightsValid && (
                    <p className="text-xs text-red-500 mt-1.5">
                      {weightsTotal > 100
                        ? t('scoring.over', { n: weightsTotal - 100 })
                        : t('scoring.remaining', { n: 100 - weightsTotal })}
                    </p>
                  )}
                </div>
              </div>
              <div className="w-28 flex-shrink-0 flex flex-col items-center">
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={46} paddingAngle={2} dataKey="value" isAnimationActive={false}>
                      {pieData.map((_, idx) => (<Cell key={idx} fill={WEIGHT_COLORS[idx]} />))}
                    </Pie>
                    <PieTooltip formatter={(v) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 w-full">
                  {WEIGHT_LABEL_NAMES.map((label, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: WEIGHT_COLORS[i] }} />
                      <span className="text-xs text-gray-500 truncate">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Decision Thresholds */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">{t('scoring.decisionThresholds')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scoring.fullApproval')}</label>
                <input type="number" min={50} max={90} value={config.min_score} disabled={isApproved}
                  onChange={e => setConfig(c => ({ ...c, min_score: parseInt(e.target.value) || 70 }))}
                  className={inputCls(isApproved)} />
                <p className="text-xs text-gray-400 mt-1">{t('scoring.range50_90')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scoring.partialFloor')}</label>
                <input type="number" min={30} max={65} value={config.partial_threshold} disabled={isApproved}
                  onChange={e => setConfig(c => ({ ...c, partial_threshold: parseInt(e.target.value) || 50 }))}
                  className={inputCls(isApproved)} />
                <p className="text-xs text-gray-400 mt-1">{t('scoring.range30_65')}</p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">{t('scoring.partialAmount')}</label>
                <span className="text-sm font-bold tabular-nums text-emerald-600">{config.partial_ratio}%</span>
              </div>
              <input type="range" min={50} max={90} step={5} value={config.partial_ratio} disabled={isApproved}
                onChange={e => setConfig(c => ({ ...c, partial_ratio: parseInt(e.target.value) }))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed"
                style={{ accentColor: '#10b981' }} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">{t('scoring.scoreViz')}</p>
              <div className="relative h-7 rounded-lg overflow-hidden bg-gray-100 select-none">
                <div className="absolute left-0 top-0 h-full bg-red-100 flex items-center justify-center" style={{ width: `${config.partial_threshold}%` }}>
                  <span className="text-xs text-red-400 font-medium px-1 truncate">REJECTED</span>
                </div>
                <div className="absolute top-0 h-full bg-amber-100 flex items-center justify-center" style={{ left: `${config.partial_threshold}%`, width: `${config.min_score - config.partial_threshold}%` }}>
                  {config.min_score - config.partial_threshold > 8 && <span className="text-xs text-amber-600 font-medium px-1 truncate">PARTIAL</span>}
                </div>
                <div className="absolute top-0 right-0 h-full bg-emerald-100 flex items-center justify-center" style={{ left: `${config.min_score}%` }}>
                  {100 - config.min_score > 8 && <span className="text-xs text-emerald-600 font-medium px-1 truncate">APPROVED</span>}
                </div>
                <div className="absolute top-0 w-0.5 h-full bg-amber-500 z-10" style={{ left: `${config.partial_threshold}%` }} />
                <div className="absolute top-0 w-0.5 h-full bg-emerald-600 z-10" style={{ left: `${config.min_score}%` }} />
              </div>
              <div className="flex text-xs mt-1.5 text-gray-500">
                <span>0</span>
                <span className="ml-auto mr-auto text-amber-600 font-medium">{config.partial_threshold}</span>
                <span className="text-emerald-600 font-medium" style={{ marginLeft: `${config.min_score - config.partial_threshold - 4}%` }}>{config.min_score}</span>
                <span className="ml-auto">100</span>
              </div>
            </div>
          </div>

          {/* Hard Reject Rules */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">{t('scoring.hardRejectRules')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scoring.minDti')}</label>
                <select value={config.hard_dti_min} disabled={isApproved}
                  onChange={e => setConfig(c => ({ ...c, hard_dti_min: parseFloat(e.target.value) }))}
                  className={inputCls(isApproved).replace('focus:ring-2 focus:ring-emerald-100 ', '')}>
                  {[1.0, 1.5, 2.0, 2.5, 3.0].map(v => <option key={v} value={v}>{v}x</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">{t('scoring.incomePayment')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scoring.maxOpenLoans')}</label>
                <input type="number" min={0} max={10} value={config.max_open_loans} disabled={isApproved}
                  onChange={e => setConfig(c => ({ ...c, max_open_loans: parseInt(e.target.value) || 0 }))}
                  className={inputCls(isApproved)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scoring.maxOverdue')}</label>
                <input type="number" min={0} max={999} value={config.max_overdue_days} disabled={isApproved}
                  onChange={e => setConfig(c => ({ ...c, max_overdue_days: parseInt(e.target.value) || 0 }))}
                  className={inputCls(isApproved)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scoring.rejectBankruptcy')}</label>
                <div className="flex items-center gap-3 mt-2">
                  <button type="button" disabled={isApproved}
                    onClick={() => !isApproved && setConfig(c => ({ ...c, bankruptcy_reject: !c.bankruptcy_reject }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-300 ${config.bankruptcy_reject ? 'bg-emerald-500' : 'bg-gray-300'} ${isApproved ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${config.bankruptcy_reject ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className={`text-sm font-medium ${config.bankruptcy_reject ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {config.bankruptcy_reject ? t('common.enabled') : t('common.disabled')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            {!weightsValid && (
              <p className="text-sm text-red-500 mb-3 flex items-center gap-1.5">
                <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />
                {t('scoring.weightsError')}
              </p>
            )}
            <Button variant="primary" color="emerald" className="w-full" onClick={handleSave}
              disabled={!weightsValid || isApproved || saving} loading={saving}>
              {saving ? t('scoring.savingConfig') : t('scoring.saveConfig')}
            </Button>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">{t('scoring.livePreview')}</h2>
            <p className="text-xs text-gray-400">{t('scoring.livePreviewDesc')}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scoring.monthlyIncome')}</label>
                <input type="number" value={preview.monthly_income}
                  onChange={e => setPreview(p => ({ ...p, monthly_income: parseInt(e.target.value) || 0 }))}
                  className={inputCls()} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scoring.monthlyPayment')}</label>
                <input type="number" value={preview.monthly_payment}
                  onChange={e => setPreview(p => ({ ...p, monthly_payment: parseInt(e.target.value) || 0 }))}
                  className={inputCls()} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scoring.age')}</label>
                <input type="number" min={18} max={80} value={preview.age}
                  onChange={e => setPreview(p => ({ ...p, age: parseInt(e.target.value) || 18 }))}
                  className={inputCls()} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('scoring.creditHistory')}</label>
                <select value={preview.credit_history}
                  onChange={e => setPreview(p => ({ ...p, credit_history: e.target.value }))}
                  className={inputCls().replace('focus:ring-2 focus:ring-emerald-100 ', '')}>
                  {['GOOD', 'FAIR', 'NONE', 'BAD'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <Button variant="primary" color="emerald" className="w-full" onClick={runCalculate}
              loading={calculating} disabled={calculating}>
              {calculating ? t('scoring.calculating') : t('scoring.calculateScore')}
            </Button>
          </div>

          {scoreResult && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{t('scoring.decision')}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  scoreResult.decision === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                  scoreResult.decision === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {scoreResult.decision}
                  {scoreResult.decision === 'PARTIAL' && ` — ${Math.round(scoreResult.approved_ratio * 100)}% of amount`}
                </span>
              </div>

              {scoreResult.hard_reject && scoreResult.hard_reject_reason && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />
                  {t('scoring.hardReject')}: <strong>{scoreResult.hard_reject_reason}</strong>
                </div>
              )}

              <div className="flex flex-col items-center gap-1">
                <ScoreGauge score={scoreResult.total_score} />
                <p className={`text-3xl font-bold tabular-nums ${
                  scoreResult.total_score >= 70 ? 'text-emerald-600' :
                  scoreResult.total_score >= 50 ? 'text-amber-600' : 'text-red-500'
                }`}>
                  {scoreResult.total_score}
                </p>
                <p className="text-xs text-gray-400">{t('scoring.totalScore')}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">{t('scoring.factorBreakdown')}</p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={barData} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <BarTooltip formatter={(v: number) => [v, 'Score']} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {barData.map((entry, i) => <BarCell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">{t('scoring.weightedContrib')}</p>
                {[
                  { label: `F1 ${t('scoring.f1Affordability')}`, raw: scoreResult.f1_affordability, w: config.w_affordability, color: '#10b981' },
                  { label: `F2 ${t('scoring.f2CreditHistory')}`, raw: scoreResult.f2_credit, w: config.w_credit_history, color: '#3b82f6' },
                  { label: `F3 ${t('scoring.f3Behavioral')}`, raw: scoreResult.f3_behavioral, w: config.w_behavioral, color: '#f59e0b' },
                  { label: `F4 ${t('scoring.f4Demographic')}`, raw: scoreResult.f4_demographic, w: config.w_demographic, color: '#8b5cf6' },
                ].map(({ label, raw, w, color }) => {
                  const contrib = Math.round(raw * w / 100)
                  return (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-gray-600 w-32 truncate">{label}</span>
                      <span className="text-gray-400">{raw} × {w}%</span>
                      <span className="ml-auto font-bold tabular-nums" style={{ color }}>+{contrib}</span>
                    </div>
                  )
                })}
              </div>

              {scoreResult.reason_codes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">{t('scoring.reasonCodes')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {scoreResult.reason_codes.map(code => (
                      <span key={code} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{code}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
