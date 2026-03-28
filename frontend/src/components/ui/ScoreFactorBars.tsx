import { ScoreBreakdown } from '../../types'
import clsx from 'clsx'

interface Props {
  breakdown: ScoreBreakdown
}

const FACTORS = [
  { key: 'f1_affordability' as const, label: 'F1 Affordability', color: 'bg-emerald-500' },
  { key: 'f2_credit'        as const, label: 'F2 Credit History', color: 'bg-blue-500'   },
  { key: 'f3_behavioral'    as const, label: 'F3 Behavioral',     color: 'bg-amber-500'  },
  { key: 'f4_demographic'   as const, label: 'F4 Demographic',    color: 'bg-violet-500' },
]

const WEIGHT_KEYS = ['w1', 'w2', 'w3', 'w4'] as const

export default function ScoreFactorBars({ breakdown }: Props) {
  const values = [
    breakdown.f1_affordability,
    breakdown.f2_credit,
    breakdown.f3_behavioral,
    breakdown.f4_demographic,
  ]

  return (
    <div className="space-y-3">
      {FACTORS.map((factor, i) => {
        const val = Math.round(values[i] ?? 0)
        const w   = breakdown.weights?.[WEIGHT_KEYS[i]] ?? 0
        return (
          <div key={factor.key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-gray-700">
                {factor.label}
                <span className="ml-1 text-gray-400 font-normal">({Math.round(w * 100)}%)</span>
              </span>
              <span className="font-bold text-gray-900">{val}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all', factor.color)}
                style={{ width: `${val}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
