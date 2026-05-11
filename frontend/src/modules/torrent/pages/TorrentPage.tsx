import { useCallback, useEffect, useRef, useState } from 'react'
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
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { torrentApi, TorrentItem, TorrentStatus, TMDBResult } from '../services/torrentApi'
import { contentApi, Category, seriesApi, SeriesContent } from '../../content/services/contentApi'

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

// ─── TMDB Autocomplete ────────────────────────────────────────────────────────

function TMDBAutocomplete({
  value,
  onChange,
  onSelect,
}: {
  value: string
  onChange: (title: string) => void
  onSelect?: (result: TMDBResult | null) => void
}) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<TMDBResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    setSearching(true)
    try {
      const data = await torrentApi.tmdbSearch(q)
      setResults(data)
      setOpen(data.length > 0)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (result: TMDBResult) => {
    const title = result.title || result.original_title
    setQuery(title)
    onChange(title)
    onSelect?.(result)
    setOpen(false)
    setResults([])
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            onChange(e.target.value)
            onSelect?.(null)
          }}
          placeholder="Film / dizi adi yaz, TMDB'den oner gelir..."
          className="h-11 w-full rounded-2xl border border-slate-200 px-4 pr-10 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
        <div className="pointer-events-none absolute right-3 text-slate-400">
          {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        </div>
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {results.map((r) => (
            <button
              key={r.tmdb_id}
              type="button"
              onClick={() => select(r)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-slate-50"
            >
              {r.poster_url ? (
                <img src={r.poster_url} alt="" className="h-12 w-8 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                  <FileVideo size={14} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-900">{r.title}</div>
                {r.original_title && r.original_title !== r.title && (
                  <div className="truncate text-xs text-slate-500">{r.original_title}</div>
                )}
                <div className="text-xs text-slate-400">{r.year ?? '?'}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type InputMode = 'magnet' | 'file'

export default function TorrentPage() {
  const qc = useQueryClient()

  // Form state
  const [inputMode, setInputMode] = useState<InputMode>('magnet')
  const [magnetLink, setMagnetLink] = useState('')
  const [torrentFile, setTorrentFile] = useState<File | null>(null)
  const [torrentName, setTorrentName] = useState('')
  const [selectedTmdb, setSelectedTmdb] = useState<TMDBResult | null>(null)
  const [category, setCategory] = useState<'movie' | 'series'>('movie')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [seasonNumber, setSeasonNumber] = useState<number | ''>('')
  const [episodeNumber, setEpisodeNumber] = useState<number | ''>('')
  const [noSeed, setNoSeed] = useState(true) // default: seeding OFF
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [removeFiles, setRemoveFiles] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Movie categories
  const { data: movieCats = [] } = useQuery<Category[]>({
    queryKey: ['movie-categories'],
    queryFn: () => contentApi.listCategories('movies'),
  })

  // All existing series (for picking which series to add episodes into)
  const { data: seriesList = [] } = useQuery<SeriesContent[]>({
    queryKey: ['series-list-all'],
    queryFn: () => seriesApi.list(),
    enabled: category === 'series',
  })

  // Poll torrent list every 5 seconds
  const { data: torrents = [], isLoading } = useQuery<TorrentItem[]>({
    queryKey: ['torrents'],
    queryFn: torrentApi.list,
    refetchInterval: 5000,
  })

  const addMagnetMutation = useMutation({
    mutationFn: torrentApi.add,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['torrents'] })
      setMagnetLink('')
      setTorrentName('')
      setSelectedTmdb(null)
    },
  })

  const addFileMutation = useMutation({
    mutationFn: torrentApi.addFile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['torrents'] })
      setTorrentFile(null)
      setTorrentName('')
      setSelectedTmdb(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
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
    if (inputMode === 'magnet') {
      if (!magnetLink.trim()) return
      addMagnetMutation.mutate({
        magnet_link: magnetLink.trim(),
        name: torrentName.trim() || undefined,
        category,
        category_id: categoryId !== '' ? Number(categoryId) : undefined,
        season_number: seasonNumber !== '' ? Number(seasonNumber) : undefined,
        episode_number: episodeNumber !== '' ? Number(episodeNumber) : undefined,
        no_seed: noSeed,
        tmdb_id: selectedTmdb?.tmdb_id ?? null,
        tmdb_poster_url: selectedTmdb?.poster_url ?? null,
        tmdb_overview: selectedTmdb?.overview ?? null,
        tmdb_rating: null,
        tmdb_release_year: selectedTmdb?.year ?? null,
      })
    } else {
      if (!torrentFile) return
      const fd = new FormData()
      fd.append('file', torrentFile)
      if (torrentName.trim()) fd.append('name', torrentName.trim())
      fd.append('category', category)
      if (categoryId !== '') fd.append('category_id', String(categoryId))
      if (seasonNumber !== '') fd.append('season_number', String(seasonNumber))
      if (episodeNumber !== '') fd.append('episode_number', String(episodeNumber))
      fd.append('no_seed', String(noSeed))
      if (selectedTmdb?.tmdb_id != null) fd.append('tmdb_id', String(selectedTmdb.tmdb_id))
      if (selectedTmdb?.poster_url != null) fd.append('tmdb_poster_url', selectedTmdb.poster_url)
      if (selectedTmdb?.overview != null) fd.append('tmdb_overview', selectedTmdb.overview)
      if (selectedTmdb?.year != null) fd.append('tmdb_release_year', String(selectedTmdb.year))
      addFileMutation.mutate(fd)
    }
  }

  const isAdding = addMagnetMutation.isPending || addFileMutation.isPending
  const addError = addMagnetMutation.error || addFileMutation.error
  const hasSource = inputMode === 'magnet' ? !!magnetLink.trim() : !!torrentFile
  const hasRequiredTarget =
    category === 'movie'
      ? categoryId !== ''
      : categoryId !== '' && seasonNumber !== ''
  const canAdd = hasSource && hasRequiredTarget

  return (
    <div className="space-y-6">
      {/* ── Add torrent card ── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Magnet size={18} className="text-blue-500" />
          <h2 className="text-base font-semibold text-slate-900">Yeni Torrent Ekle</h2>
        </div>

        {/* Input mode tabs */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setInputMode('magnet')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              inputMode === 'magnet'
                ? 'bg-blue-500 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Magnet size={14} />
            Magnet Link
          </button>
          <button
            type="button"
            onClick={() => setInputMode('file')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              inputMode === 'file'
                ? 'bg-blue-500 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Upload size={14} />
            .torrent Dosyasi
          </button>
        </div>

        <div className="space-y-4">
          {/* Magnet link or file upload */}
          {inputMode === 'magnet' ? (
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
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">.torrent Dosyasi</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-500"
              >
                <Upload size={20} />
                <span className="text-sm">
                  {torrentFile ? torrentFile.name : 'Dosya sec veya surukle'}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".torrent"
                className="hidden"
                onChange={(e) => setTorrentFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          {/* Name with TMDB autocomplete */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Isim <span className="text-slate-400">(opsiyonel — TMDB'den ara)</span>
            </label>
            <TMDBAutocomplete
              value={torrentName}
              onChange={setTorrentName}
              onSelect={setSelectedTmdb}
            />
          </div>

          <div className={`grid grid-cols-1 gap-4 ${category === 'series' && categoryId !== '' ? 'lg:grid-cols-4 sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
            {/* Category type */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Kategori Tipi</label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as 'movie' | 'series')
                  setCategoryId('')
                  setSeasonNumber('')
                  setEpisodeNumber('')
                }}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="movie">Film</option>
                <option value="series">Series</option>
              </select>
            </div>

            {/* Sub-category */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {category === 'series' ? 'Dizi Sec' : 'Film Kategorisi'}
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value === '' ? '' : Number(e.target.value))
                  setSeasonNumber('')
                  setEpisodeNumber('')
                }}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">-- {category === 'series' ? 'Dizi Sec' : 'Kategori Sec'} --</option>
                {category === 'series'
                  ? seriesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))
                  : movieCats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
              </select>
            </div>

            {/* Manual season / episode inputs — only when a series is selected */}
            {category === 'series' && categoryId !== '' && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Sezon No</label>
                  <input
                    type="number"
                    min={1}
                    value={seasonNumber}
                    onChange={(e) => setSeasonNumber(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ornek: 1"
                    className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Bolum No</label>
                  <input
                    type="number"
                    min={1}
                    value={episodeNumber}
                    onChange={(e) => setEpisodeNumber(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Bos = otomatik numaralama"
                    className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Bos birakirsan torrent icindeki video dosyalari Bolum 1, 2, 3 olarak kaydedilir.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Seeding toggle */}
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={!noSeed}
                onChange={(e) => setNoSeed(!e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-slate-200 transition peer-checked:bg-blue-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
            </label>
            <div>
              <div className="text-sm font-medium text-slate-700">
                Indirdikten sonra paylasma (seed etme)
              </div>
              <div className="text-xs text-slate-400">
                {noSeed
                  ? 'Seeding kapali — indirme tamamlaninca otomatik durur'
                  : 'Seeding acik — diger kullanicilara paylasim yapilir'}
              </div>
            </div>
          </div>

          {addError && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              <AlertCircle size={15} />
              {(addError as Error)?.message || 'Hata olustu'}
            </div>
          )}

          <button
            type="button"
            onClick={handleAdd}
            disabled={isAdding || !canAdd}
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="max-w-xs truncate text-sm font-medium text-slate-900">{t.name}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses[t.status]}`}>
                          {statusLabels[t.status]}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
                          {t.category === 'movie' ? 'Film' : 'Series'}
                        </span>
                        {t.category === 'series' && t.season_number != null && (
                          <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs text-violet-700">
                            S{t.season_number}{t.episode_number != null ? ` • B${t.episode_number}` : ' • Tum Sezon'}
                          </span>
                        )}
                        {t.no_seed && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                            seed yok
                          </span>
                        )}
                        {isDone && <CheckCircle2 size={15} className="text-emerald-500" />}
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
                            className={`h-full rounded-full transition-all ${
                              isDone
                                ? 'bg-emerald-500'
                                : isError
                                ? 'bg-rose-400'
                                : isPaused
                                ? 'bg-slate-400'
                                : 'bg-blue-500'
                            }`}
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
