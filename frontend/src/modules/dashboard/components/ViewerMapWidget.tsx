import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Maximize2, Minimize2, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { viewerMapApi } from '../services/viewerMapApi'
import type { TimeRange } from '../services/viewerMapApi'
import TopCountryList from './TopCountryList'
import CountryDetailModal from './CountryDetailModal'
import FullscreenModal from './FullscreenModal'

// Lazy-load the heavy SVG map to avoid blocking initial render
const WorldMap = lazy(() => import('./WorldMap'))

const RANGE_LABELS: { value: TimeRange; label: string }[] = [
  { value: 'now', label: 'ANLIK' },
  { value: '24h', label: 'SON 24H' },
  { value: '7d', label: 'SON 7G' },
]

interface MapContentProps {
  timeRange: TimeRange
  onCountryClick: (code: string) => void
  compact?: boolean
}

function MapContent({ timeRange, onCountryClick, compact = false }: MapContentProps) {
  const summaryQuery = useQuery({
    queryKey: ['viewer-map', timeRange],
    queryFn: () => viewerMapApi.getSummary(timeRange),
    refetchInterval: 30_000,
    staleTime: 5_000,
  })

  const countries = summaryQuery.data?.countries ?? []
  const totalViewers = summaryQuery.data?.total_viewers ?? 0
  const totalCountries = summaryQuery.data?.total_countries ?? 0

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Map + List */}
      <div
        className={`grid gap-4 flex-1 ${
          compact
            ? 'grid-cols-1'
            : 'grid-cols-1 sm:grid-cols-[2fr,1fr]'
        }`}
        style={{ minHeight: compact ? 400 : 280 }}
      >
        {/* Map area */}
        <div className="relative bg-slate-50 rounded-xl overflow-hidden border border-slate-100" style={{ minHeight: 240 }}>
          {summaryQuery.isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
              <Loader2 size={28} className="animate-spin text-blue-500" />
            </div>
          )}
          {summaryQuery.isError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
              <AlertCircle size={28} />
              <span className="text-sm">Harita verileri alınamadı</span>
            </div>
          )}
          {!summaryQuery.isError && (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-slate-400">
                  <Loader2 size={24} className="animate-spin" />
                </div>
              }
            >
              <WorldMap countries={countries} onCountryClick={onCountryClick} />
            </Suspense>
          )}
        </div>

        {/* Top 10 */}
        <div className="flex flex-col">
          <TopCountryList countries={countries} onCountryClick={onCountryClick} />
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between text-sm text-slate-500 border-t border-slate-100 pt-2">
        <span>
          {summaryQuery.isLoading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />
              Yükleniyor...
            </span>
          ) : (
            <>
              <span className="font-semibold text-slate-800">{totalViewers}</span> izleyici ·{' '}
              <span className="font-semibold text-slate-800">{totalCountries}</span> ülke
            </>
          )}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-slate-400">
          <RefreshCw size={11} />
          30sn otomatik yenile
        </span>
      </div>
    </div>
  )
}

export default function ViewerMapWidget() {
  const [timeRange, setTimeRange] = useState<TimeRange>('now')
  const [selectedCountry, setSelectedCountry] = useState<{ code: string; name: string } | null>(
    null,
  )
  const [isFullscreen, setIsFullscreen] = useState(false)

  // We need country names available when a country is clicked from the map
  const summaryQuery = useQuery({
    queryKey: ['viewer-map', timeRange],
    queryFn: () => viewerMapApi.getSummary(timeRange),
    staleTime: 5_000,
    refetchInterval: 30_000,
  })

  const handleCountryClick = (code: string) => {
    const stat = summaryQuery.data?.countries.find((c) => c.country_code === code)
    setSelectedCountry({ code, name: stat?.country_name ?? code })
  }

  const innerContent = (compact: boolean) => (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-slate-900">Canlı İzleyici Haritası</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Time range toggle */}
          <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
            {RANGE_LABELS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTimeRange(value)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  timeRange === value
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            title={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
          >
            {isFullscreen ? (
              <Minimize2 size={15} className="text-slate-500" />
            ) : (
              <Maximize2 size={15} className="text-slate-500" />
            )}
          </button>
        </div>
      </div>

      <MapContent timeRange={timeRange} onCountryClick={handleCountryClick} compact={compact} />
    </div>
  )

  return (
    <>
      <div className="glass-panel p-5 flex flex-col" style={{ minHeight: 380 }}>
        {innerContent(false)}
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <FullscreenModal onClose={() => setIsFullscreen(false)}>
          <div className="h-full" style={{ minHeight: '70vh' }}>
            {innerContent(true)}
          </div>
        </FullscreenModal>
      )}

      {/* Country detail modal */}
      {selectedCountry && (
        <CountryDetailModal
          countryCode={selectedCountry.code}
          countryName={selectedCountry.name}
          timeRange={timeRange}
          onClose={() => setSelectedCountry(null)}
        />
      )}
    </>
  )
}
