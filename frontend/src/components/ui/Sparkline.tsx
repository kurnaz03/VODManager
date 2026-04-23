interface SparklineProps {
  values: number[]
  stroke?: string
}

export default function Sparkline({ values, stroke = '#60a5fa' }: SparklineProps) {
  if (values.length === 0) {
    return <div className="h-20 rounded-2xl bg-slate-100" />
  }

  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 100
    const y = 100 - ((value - min) / range) * 100
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-24 w-full overflow-visible">
      <defs>
        <linearGradient id={`spark-${stroke.replace('#', '')}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={`url(#spark-${stroke.replace('#', '')})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}