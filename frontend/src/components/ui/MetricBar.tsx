interface MetricBarProps {
  label: string
  value: number
  tone?: 'blue' | 'green' | 'amber' | 'red'
  suffix?: string
  displayValue?: string
}

const toneMap = {
  blue: 'from-blue-500 to-sky-400',
  green: 'from-emerald-500 to-green-400',
  amber: 'from-amber-500 to-orange-400',
  red: 'from-rose-500 to-red-400',
}

export default function MetricBar({ label, value, tone = 'blue', suffix = '%', displayValue }: MetricBarProps) {
  const clampedValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-slate-500">
        <span>{label}</span>
        <span className="text-slate-700">{displayValue ?? `${clampedValue.toFixed(0)}${suffix}`}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${toneMap[tone]} shadow-[0_0_22px_rgba(59,130,246,0.18)] transition-all duration-500`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  )
}
