import { useQuery } from '@tanstack/react-query'
import { X, Loader2, AlertCircle } from 'lucide-react'
import { viewerMapApi } from '../services/viewerMapApi'
import type { TimeRange } from '../services/viewerMapApi'

function flagEmoji(code: string): string {
  const upper = code.toUpperCase()
  if (upper.length !== 2) return '🌐'
  const cp = [...upper].map((c) => 0x1f1e0 + c.charCodeAt(0) - 65)
  return String.fromCodePoint(...cp)
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface CountryDetailModalProps {
  countryCode: string
  countryName: string
  timeRange: TimeRange
  onClose: () => void
}

export default function CountryDetailModal({
  countryCode,
  countryName,
  timeRange,
  onClose,
}: CountryDetailModalProps) {
  const detailQuery = useQuery({
    queryKey: ['viewer-map-detail', countryCode, timeRange],
    queryFn: () => viewerMapApi.getCountryDetail(countryCode, timeRange),
    staleTime: 10_000,
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{flagEmoji(countryCode)}</span>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{countryName}</h3>
              <p className="text-xs text-slate-500">
                {detailQuery.data
                  ? `${detailQuery.data.total} aktif bağlantı`
                  : 'Yükleniyor...'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {detailQuery.isLoading && (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 size={24} className="animate-spin mr-2" />
              <span className="text-sm">Bağlantılar yükleniyor...</span>
            </div>
          )}

          {detailQuery.isError && (
            <div className="flex items-center gap-2 py-8 text-red-500 justify-center">
              <AlertCircle size={18} />
              <span className="text-sm">Veri alınamadı</span>
            </div>
          )}

          {detailQuery.data && detailQuery.data.connections.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
              Bu ülkede aktif bağlantı bulunamadı
            </div>
          )}

          {detailQuery.data && detailQuery.data.connections.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                  <th className="pb-2 font-medium">IP Adresi</th>
                  <th className="pb-2 font-medium">Kullanıcı</th>
                  <th className="pb-2 font-medium">İçerik</th>
                  <th className="pb-2 font-medium">Tür</th>
                  <th className="pb-2 font-medium text-right">Süre</th>
                </tr>
              </thead>
              <tbody>
                {detailQuery.data.connections.map((conn, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2 pr-3 font-mono text-xs text-slate-600">
                      {conn.ip_address || '—'}
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-800">
                      {conn.username || '—'}
                    </td>
                    <td className="py-2 pr-3 text-slate-600 max-w-[180px] truncate">
                      {conn.stream_name || '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          conn.stream_type === 'live'
                            ? 'bg-emerald-100 text-emerald-700'
                            : conn.stream_type === 'movie'
                              ? 'bg-blue-100 text-blue-700'
                              : conn.stream_type === 'series'
                                ? 'bg-purple-100 text-purple-700'
                                : conn.stream_type === 'radio'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {conn.stream_type || '—'}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono text-xs text-slate-500">
                      {formatDuration(conn.duration_seconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex-shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
