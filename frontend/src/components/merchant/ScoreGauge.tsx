interface Props {
  score: number
  maxScore?: number
  size?: number
}

export default function ScoreGauge({ score, maxScore = 100, size = 160 }: Props) {
  const pct = Math.min(1, Math.max(0, score / maxScore))
  const color = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'

  const cx = size / 2
  const cy = size / 2
  const r = size * 0.375
  const strokeWidth = size * 0.075
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference * (1 - pct)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Score ${score}`}>
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
      />
      {/* Arc */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90, ${cx}, ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      {/* Score number */}
      <text
        x={cx} y={cy - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.175}
        fontWeight="700"
        fill={color}
        fontFamily="system-ui, sans-serif"
      >
        {score}
      </text>
      {/* Label */}
      <text
        x={cx} y={cy + size * 0.145}
        textAnchor="middle"
        fontSize={size * 0.075}
        fill="#9ca3af"
        fontFamily="system-ui, sans-serif"
      >
        / {maxScore}
      </text>
    </svg>
  )
}
