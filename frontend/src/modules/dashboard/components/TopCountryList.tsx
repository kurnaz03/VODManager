import type { CountryStat } from '../services/viewerMapApi'

// Simple flag emoji from country code
function flagEmoji(code: string): string {
  const upper = code.toUpperCase()
  if (upper.length !== 2) return '🌐'
  const cp = [...upper].map((c) => 0x1f1e0 + c.charCodeAt(0) - 65)
  return String.fromCodePoint(...cp)
}

interface TopCountryListProps {
  countries: CountryStat[]
  onCountryClick: (code: string) => void
}

export default function TopCountryList({ countries, onCountryClick }: TopCountryListProps) {
  const top10 = countries.slice(0, 10)

  if (top10.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 text-slate-400 text-sm">
        <span>Henüz bağlı izleyici yok</span>
      </div>
    )
  }

  const maxCount = top10[0]?.viewer_count ?? 1

  return (
    <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 340 }}>
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex-shrink-0">
        Top 10 Ülke
      </h4>
      {top10.map((c, i) => (
        <button
          key={c.country_code}
          type="button"
          className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-blue-50 transition-colors group text-left w-full"
          onClick={() => onCountryClick(c.country_code)}
        >
          {/* Rank */}
          <span className="w-4 text-[11px] text-slate-400 font-medium flex-shrink-0">
            {i + 1}
          </span>
          {/* Flag */}
          <span className="text-lg leading-none flex-shrink-0">{flagEmoji(c.country_code)}</span>
          {/* Name */}
          <span className="flex-1 text-sm font-medium text-slate-700 group-hover:text-blue-700 truncate">
            {c.country_name}
          </span>
          {/* Bar */}
          <div className="w-14 h-1.5 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${(c.viewer_count / maxCount) * 100}%` }}
            />
          </div>
          {/* Count */}
          <span className="w-8 text-right text-xs font-semibold text-slate-600 group-hover:text-blue-700 flex-shrink-0">
            {c.viewer_count}
          </span>
        </button>
      ))}
    </div>
  )
}
