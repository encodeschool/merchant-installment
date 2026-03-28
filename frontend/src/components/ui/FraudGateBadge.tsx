interface Props {
  gate: 'PASS' | 'FLAG' | 'BLOCK'
}

const MAP = {
  PASS:  { label: 'PASS',  cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  FLAG:  { label: 'FLAG',  cls: 'bg-yellow-50  text-yellow-700  ring-yellow-200'  },
  BLOCK: { label: 'BLOCK', cls: 'bg-red-50      text-red-700     ring-red-200'     },
}

export default function FraudGateBadge({ gate }: Props) {
  const { label, cls } = MAP[gate] ?? MAP.PASS
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  )
}
