import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileVideo,
  Loader2,
  Magnet,
  Pause,
  Play,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import { torrentApi, TorrentItem, TorrentStatus } from '../services/torrentApi'
import { contentApi, Category } from '../../content/services/contentApi'

// ─── Status helpers ───────────────────────────────────────────────────────────

const statusLabels: Record<TorrentStatus, string> = {
  queued: 'Kuyrukta',
  downloading: 'Indiriliyor',
  seeding: 'Paylasiliyor',
  completed: 'Tamamlandi',
  paused: 'Duraklatildi',
  error: 'Hata',
}

const statusClasses: Record<TorrentStatus, string> = {
  queued: 'bg-amber-100 text-amber-700',
  downloading: 'bg-emerald-100 text-emerald-700',
  seeding: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-slate-200 text-slate-600',
  error: 'bg-rose-100 text-rose-700',
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatSize(bytes: number | null): string {
  if (!bytes) return '-'
  const gb = bytes / 1024 / 1024 / 1024
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  const mb = bytes / 1024 / 1024
  return `${mb.toFixed(1)} MB`
}

function formatSpeed(mbps: number | null): string {
  if (!mbps) return '-'
  return `${mbps.toFixed(2)} MB/s`
}

function formatEta(seconds: number | null): string {
  if (!seconds) return '-'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

// ─── File list sub-component ─────────────────────────────────────────────────

function TorrentFileList({ torrentId }: { torrentId: number }) {
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['torrent-files', torrentId],
    queryFn: () => torrentApi.files(torrentId),
  })

  if (isLoading) return <div className="py-2 text-sm text-slate-500">Dosyalar yukleniyor...</div>
  if (!files.length) return <div className="py-2 text-sm text-slate-400">Metadata henuz hazir degil.</div>

  return (
    <div className="mt-2 space-y-1">
      {files.map((f) => (
        <div key={f.index} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs">
          <FileVideo size={13} className="shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 truncate text-slate-700">{f.path}</span>
          <span className="shrink-0 text-slate-400">{formatSize(f.size)}</span>
          <span className="shrink-0 font-medium text-slate-600">{f.progress}%</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TorrentPage() {
  const qc = useQueryClient()

  const [magnetLink, setMagnetLink] = useState('')
  const [torrentName, setTorrentName] = useState('')
  const [category, setCategory] = useState<'movie' | 'series'>('movie')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [removeFiles, setRemoveFiles] = useState(false)

  // Movie categories for dropdown
  const { data: movieCats = [] } = useQuery<Category[]>({
    queryKey: ['movie-categories'],
    queryFn: () => contentApi.listCategories('movies'),
  })

  // Series categories for dropdown
  const { data: seriesCats = [] } = useQuery<Category[]>({
    queryKey: ['series-categories'],
    queryFn: () => contentApi.listCategories('series'),
  })

  const activeCats = category === 'movie' ? movieCats : seriesCats

  // Poll torrent list every 5 seconds
  const { data: torrents = [], isLoading } = useQuery<TorrentItem[]>({
    queryKey: ['torrents'],
    queryFn: torrentApi.list,
    refetchInterval: 5000,
  })

  const addMutation = useMutation({
    mutationFn: torrentApi.add,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['torrents'] })
      setMagnetLink('')
      setTorrentName('')
    },
  })

  const pauseMutation = useMutation({
    mutationFn: torrentApi.pause,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['torrents'] }),
  })

  const resumeMutation = useMutation({
    mutationFn: torrentApi.resume,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['torrents'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, rf }: { id: number; rf: boolean }) => torrentApi.delete(id, rf),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['torrents'] })
      setDeleteConfirmId(null)
    },
  })

  const handleAdd = () => {
    if (!magnetLink.trim()) return
    addMutation.mutate({
      magnet_link: magnetLink.trim(),
      name: torrentName.trim() || undefined,
      category,
      category_id: categoryId !== '' ? Number(categoryId) : undefined,
    })
  }

  const isAdding = addMutation.isPending

  return (
    <div className="space-y-6">
      {/* ── Add torrent card ── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Magnet size={18} className="text-blue-500" />
          <h2 className="text-base font-semibold text-slate-900">Yeni Torrent Ekle</h2>
        </div>

        <div className="space-y-4">
          {/* Magnet link input */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Magnet Link</label>
            <input
              type="text"
              value={magnetLink}
              onChange={(e) => setMagnetLink(e.target.value)}
              placeholder="magnet:?xt=urn:btih:..."
              className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {/* Optional name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Isim <span className="text-slate-400">(opsiyonel)</span>
            </label>
            <input
              type="text"
              value={torrentName}
              onChange={(e) => setTorrentName(e.target.value)}
              placeholder="Torrent adi (bos birakirsaniz otomatik alinir)"
              className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Category type */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Kategori Tipi</label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as 'movie' | 'series')
                  setCategoryId('')
                }}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="movie">Film</option>
                <option value="series">Dizi</option>
              </select>
            </div>

            {/* Sub-category */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Alt Kategori <span className="text-slate-400">(opsiyonel)</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">-- Kategori Sec --</option>
                {activeCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {addMutation.isError && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              <AlertCircle size={15} />
              {(addMutation.error as Error)?.message || 'Hata olustu'}
            </div>
          )}

          <button
            type="button"
            onClick={handleAdd}
            disabled={isAdding || !magnetLink.trim()}
            className="flex h-11 items-center gap-2 rounded-2xl bg-blue-500 px-6 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            {isAdding ? <Loader2 size={15} className="animate-spin" /> : <Magnet size={15} />}
            {isAdding ? 'Ekleniyor...' : 'Indirmeyi Baslat'}
          </button>
        </div>
      </div>

      {/* ── Downloads table ── */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Torrent Indirmeleri
            {torrents.length > 0 && (
              <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {torrents.length}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey: ['torrents'] })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          >
            <RefreshCcw size={15} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : torrents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
            <Magnet size={32} className="opacity-30" />
            <p className="text-sm">Henuz torrent indirmesi yok</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {torrents.map((t) => {
              const isExpanded = expandedId === t.id
              const isActive = t.status === 'downloading' || t.status === 'seeding'
              const isDone = t.status === 'completed'
              const isPaused = t.status === 'paused'
              const isError = t.status === 'error'

              return (
                <div key={t.id} className="px-6 py-4">
                  {/* Row */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="max-w-xs truncate text-sm font-medium text-slate-900">{t.name}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses[t.status]}`}>
                          {statusLabels[t.status]}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
                          {t.category === 'movie' ? 'Film' : 'Dizi'}
                        </span>
                        {isDone && (
                          <CheckCircle2 size={15} className="text-emerald-500" />
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2 w-full max-w-lg">
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                          <span>
                            {t.size_downloaded != null && t.size_total != null
                              ? `${formatSize(t.size_downloaded)} / ${formatSize(t.size_total)}`
                              : formatSize(t.size_total)}
                          </span>
                          <span className="font-medium">{t.progress.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-500' : isError ? 'bg-rose-400' : isPaused ? 'bg-slate-400' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(t.progress, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Speeds + ETA */}
                      {isActive && (
                        <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-slate-500">
                          <span>↓ {formatSpeed(t.download_speed)}</span>
                          <span>↑ {formatSpeed(t.upload_speed)}</span>
                          {t.eta_seconds != null && <span>ETA: {formatEta(t.eta_seconds)}</span>}
                        </div>
                      )}

                      {isError && t.error_message && (
                        <div className="mt-1.5 text-xs text-rose-500">{t.error_message}</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-2">
                      {isActive && (
                        <button
                          type="button"
                          onClick={() => pauseMutation.mutate(t.id)}
                          disabled={pauseMutation.isPending}
                          title="Duraklat"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 transition hover:bg-amber-100"
                        >
                          <Pause size={14} />
                        </button>
                      )}
                      {isPaused && (
                        <button
                          type="button"
                          onClick={() => resumeMutation.mutate(t.id)}
                          disabled={resumeMutation.isPending}
                          title="Devam Et"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                        >
                          <Play size={14} />
                        </button>
                      )}

                      {/* Expand files */}
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : t.id)}
                        title="Dosyalar"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100"
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      {/* Delete */}
                      {deleteConfirmId === t.id ? (
                        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-1.5">
                          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-rose-600">
                            <input
                              type="checkbox"
                              checked={removeFiles}
                              onChange={(e) => setRemoveFiles(e.target.checked)}
                              className="accent-rose-500"
                            />
                            Dosyalari sil
                          </label>
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate({ id: t.id, rf: removeFiles })}
                            disabled={deleteMutation.isPending}
                            className="rounded-xl bg-rose-500 px-2 py-1 text-xs font-medium text-white hover:bg-rose-600"
                          >
                            Evet
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="rounded-xl bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Iptal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(t.id)}
                          title="Sil"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 transition hover:bg-rose-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded files */}
                  {isExpanded && <TorrentFileList torrentId={t.id} />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
