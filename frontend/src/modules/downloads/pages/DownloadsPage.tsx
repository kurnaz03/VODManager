import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Download, Film, LoaderCircle, RefreshCcw, Trash2, XCircle, ListX, Tv } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { contentApi, Category, seriesApi, SeriesContent, Season } from '../../content/services/contentApi'
import { DownloadCreatePayload, DownloadItem, DownloadResolution, TmdbMovie, downloadsApi } from '../services/downloadsApi'
import { vpnApi, VpnClient } from '../../vpn/services/vpnApi'

// Form degerlerinin tipi – hem film hem dizi modunu kapsar
interface DownloadFormValues {
  url: string
  title: string
  category_id: number
  resolution: DownloadResolution
  use_vpn: boolean
  vpn_client_id: number
  // Dizi modu icin ek alanlar
  series_id: number
  season_id: number
  episode_number: number
}

const statusLabels: Record<DownloadItem['status'], string> = {
  queued: 'Kuyrukta',
  approved: 'Onaylandi',
  downloading: 'Indiriliyor',
  completed: 'Tamamlandi',
  failed: 'Hata',
  cancelled: 'Iptal',
}

const statusClasses: Record<DownloadItem['status'], string> = {
  queued: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  downloading: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-200 text-slate-600',
}

function isYoutubeUrl(url: string) {
  const value = url.toLowerCase()
  return value.includes('youtube.com') || value.includes('youtu.be')
}

function formatSpeed(value: number | null) {
  if (value == null) return '-'
  return `${value.toFixed(2)} MB/s`
}

function formatSize(value: number | null) {
  if (!value) return '-'
  const mb = value / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function DownloadsPage() {
  const queryClient = useQueryClient()

  // Kategori tipi secimi: 'movies' (varsayilan) veya 'series'
  const [categoryType, setCategoryType] = useState<'movies' | 'series'>('movies')

  // Film modu TMDB state'leri
  const [selectedTmdb, setSelectedTmdb] = useState<TmdbMovie | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Dizi modu — TMDB arama kaldirildi, sadece dizi/sezon/bolum secimi var

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const { register, handleSubmit, setValue, watch, reset } = useForm<DownloadFormValues>({
    defaultValues: {
      url: '',
      title: '',
      category_id: 0,
      resolution: '1080',
      use_vpn: false,
      vpn_client_id: 0,
      series_id: 0,
      season_id: 0,
      episode_number: 1,
    },
  })

  const currentUrl = watch('url')
  const currentTitle = watch('title')
  const useVpn = watch('use_vpn')
  const selectedSeriesId = watch('series_id')
  const isYoutube = isYoutubeUrl(currentUrl || '')
  const debouncedTitle = useDebounce(currentTitle, 300)

  // Kategori tipi degisince formu sifirla
  const handleCategoryTypeChange = (newType: 'movies' | 'series') => {
    setCategoryType(newType)
    setSelectedTmdb(null)
    setDropdownOpen(false)
    reset({
      url: '',
      title: '',
      category_id: 0,
      resolution: '1080',
      use_vpn: false,
      vpn_client_id: 0,
      series_id: 0,
      season_id: 0,
      episode_number: 1,
    })
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  const downloadsQuery = useQuery({
    queryKey: ['downloads', statusFilter],
    queryFn: () => downloadsApi.listDownloads(statusFilter === 'all' ? undefined : { status: statusFilter }),
    refetchInterval: 3000,
  })

  // Film kategorileri (hem film hem dizi modunda category_id icin kullanilir – dosya yolu icin)
  const categoriesQuery = useQuery({
    queryKey: ['categories', 'movies'],
    queryFn: () => contentApi.listCategories('movies'),
  })

  const vpnClientsQuery = useQuery({
    queryKey: ['vpn-clients'],
    queryFn: vpnApi.listClients,
  })

  // Dizi listesi – sadece dizi modu aktifken yukle
  const seriesListQuery = useQuery({
    queryKey: ['series-list'],
    queryFn: () => seriesApi.list(),
    enabled: categoryType === 'series',
  })

  // Secilen dizinin sezonlari
  const seasonsQuery = useQuery({
    queryKey: ['series-seasons', selectedSeriesId],
    queryFn: () => seriesApi.listSeasons(Number(selectedSeriesId)),
    enabled: categoryType === 'series' && Number(selectedSeriesId) > 0,
  })

  // Film TMDB araması – sadece film modunda
  const tmdbSearchQuery = useQuery({
    queryKey: ['tmdb-movie-search', debouncedTitle],
    queryFn: () => downloadsApi.searchTmdbMovies(debouncedTitle),
    enabled: categoryType === 'movies' && debouncedTitle.trim().length >= 2 && !selectedTmdb,
  })

  // Film dropdown ac
  useEffect(() => {
    if (tmdbSearchQuery.data && tmdbSearchQuery.data.length > 0 && !selectedTmdb) {
      setDropdownOpen(true)
    }
  }, [tmdbSearchQuery.data, selectedTmdb])

  // Film dropdown disariya tiklaninca kapat
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: DownloadCreatePayload) => downloadsApi.createDownload(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads'] })
      reset({ url: '', title: '', category_id: 0, resolution: '1080', use_vpn: false, vpn_client_id: 0, series_id: 0, season_id: 0, episode_number: 1 })
      setSelectedTmdb(null)
      setDropdownOpen(false)
    },
  })

  const approveMutation = useMutation({
    mutationFn: (downloadId: number) => downloadsApi.approveDownload(downloadId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads'] }),
  })

  const cancelMutation = useMutation({
    mutationFn: (downloadId: number) => downloadsApi.cancelDownload(downloadId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads'] }),
  })

  const retryMutation = useMutation({
    mutationFn: (downloadId: number) => downloadsApi.retryDownload(downloadId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (downloadId: number) => downloadsApi.deleteDownload(downloadId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['downloads'] }),
  })

  const clearMutation = useMutation({
    mutationFn: () => downloadsApi.clearDownloads(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads'] })
      setShowClearConfirm(false)
    },
  })

  // ── Form submit ───────────────────────────────────────────────────────────────

  const onSubmit = (values: DownloadFormValues) => {
    // Dizi modunda secilen dizinin adini title olarak kullan
    const seriesTitle = seriesList.find((s: SeriesContent) => s.id === Number(values.series_id))?.title
    const basePayload = {
      url: values.url,
      title: categoryType === 'movies' ? (selectedTmdb?.title || values.title) : (seriesTitle || values.title || 'Bolum'),
      category_id: categoryType === 'movies' ? Number(values.category_id) : null,
      resolution: isYoutube ? values.resolution : 'auto' as DownloadResolution,
      vpn_client_id: values.use_vpn && values.vpn_client_id ? Number(values.vpn_client_id) : null,
    }

    if (categoryType === 'series') {
      createMutation.mutate({
        ...basePayload,
        category_type: 'series',
        series_id: Number(values.series_id) || null,
        season_id: Number(values.season_id) || null,
        episode_number: Number(values.episode_number) || null,
      })
    } else {
      createMutation.mutate({
        ...basePayload,
        category_type: 'movies',
        tmdb_id: selectedTmdb?.id ?? null,
        tmdb_title: selectedTmdb?.title ?? null,
        tmdb_overview: selectedTmdb?.overview ?? null,
        tmdb_poster_url: selectedTmdb?.poster_url ?? null,
        tmdb_backdrop_url: selectedTmdb?.backdrop_url ?? null,
        tmdb_year: selectedTmdb?.release_year ?? null,
        tmdb_rating: selectedTmdb?.rating ?? null,
      })
    }
  }

  // ── Computed values ───────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const items = downloadsQuery.data ?? []
    return {
      total: items.length,
      queued: items.filter((item) => item.status === 'queued').length,
      downloading: items.filter((item) => item.status === 'downloading').length,
      completed: items.filter((item) => item.status === 'completed').length,
    }
  }, [downloadsQuery.data])

  const movieCategories = categoriesQuery.data ?? []
  const activeVpnClients = (vpnClientsQuery.data ?? []).filter((c: VpnClient) => c.is_active)
  const seriesList: SeriesContent[] = seriesListQuery.data ?? []
  const seasonsList: Season[] = seasonsQuery.data ?? []

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <section className="glass-panel p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Icerik Yonetimi</div>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Downloader</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              URL, YouTube ve m3u8 kaynaklarini TMDB bilgileriyle kuyruga ekleyin, onaylayin ve canli ilerlemeyi izleyin.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Toplam" value={summary.total} />
            <SummaryCard label="Bekleyen" value={summary.queued} />
            <SummaryCard label="Indiriliyor" value={summary.downloading} />
            <SummaryCard label="Tamamlanan" value={summary.completed} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="glass-panel p-5">
          <div className="mb-5 flex items-center gap-3">
            <Download size={18} className="vm-primary-text" />
            <h3 className="text-lg font-semibold text-slate-900">Yeni indirme ekle</h3>
          </div>

          {/* Kategori tipi secici – Film / Dizi toggle */}
          <div className="mb-5 flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => handleCategoryTypeChange('movies')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                categoryType === 'movies'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Film size={15} />
              Film
            </button>
            <button
              type="button"
              onClick={() => handleCategoryTypeChange('series')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                categoryType === 'series'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Tv size={15} />
              Dizi Bolumu
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* URL */}
            <div>
              <label className="panel-label">URL</label>
              <input
                className="panel-input"
                placeholder="YouTube, direkt video veya m3u8 baglantisi"
                {...register('url', { required: true })}
              />
            </div>

            {/* ── FILM MODU ── */}
            {categoryType === 'movies' && (
              <>
                {/* Film adi + TMDB dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <label className="panel-label">Film adi</label>
                  <input
                    className="panel-input"
                    placeholder="Film adini yazin (TMDB otomatik arar)"
                    {...register('title', { required: true })}
                    onChange={(e) => {
                      setValue('title', e.target.value)
                      if (selectedTmdb) setSelectedTmdb(null)
                      setDropdownOpen(true)
                    }}
                    autoComplete="off"
                  />
                  {tmdbSearchQuery.isFetching && (
                    <div className="pointer-events-none absolute right-3 top-[38px]">
                      <LoaderCircle size={16} className="animate-spin text-slate-400" />
                    </div>
                  )}
                  {dropdownOpen && (tmdbSearchQuery.data ?? []).length > 0 && !selectedTmdb && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
                      {(tmdbSearchQuery.data ?? []).map((movie) => (
                        <button
                          key={movie.id}
                          type="button"
                          onClick={() => {
                            setSelectedTmdb(movie)
                            setValue('title', movie.title)
                            setDropdownOpen(false)
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                        >
                          <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-200">
                            {movie.poster_url ? (
                              <img src={movie.poster_url} alt={movie.title} className="h-full w-full object-cover" />
                            ) : (
                              <Film size={14} className="text-slate-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-slate-900">{movie.title}</div>
                            <div className="text-xs text-slate-500">
                              {movie.release_year ?? 'Yil yok'} &middot; {movie.rating?.toFixed(1) ?? '-'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Secilen film onizleme */}
                {selectedTmdb && (
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-24 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white">
                        {selectedTmdb.poster_url ? (
                          <img src={selectedTmdb.poster_url} alt={selectedTmdb.title} className="h-full w-full object-cover" />
                        ) : (
                          <Film size={18} className="text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-base font-semibold text-slate-900">{selectedTmdb.title}</div>
                          <button
                            type="button"
                            onClick={() => { setSelectedTmdb(null); setValue('title', '') }}
                            className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-emerald-100 hover:text-slate-600"
                          >
                            <XCircle size={16} />
                          </button>
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {selectedTmdb.release_year ?? 'Yil yok'} - {selectedTmdb.rating?.toFixed(1) ?? 'Puan yok'}
                        </div>
                        <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{selectedTmdb.overview || 'Aciklama yok'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── DiZi MODU ── */}
            {categoryType === 'series' && (
              <>
                {/* Dizi secimi */}
                <div>
                  <label className="panel-label">Dizi</label>
                  <select
                    className="panel-select"
                    {...register('series_id', { required: true, valueAsNumber: true })}
                    onChange={(e) => {
                      setValue('series_id', Number(e.target.value))
                      setValue('season_id', 0)
                    }}
                  >
                    <option value={0}>Dizi secin</option>
                    {seriesList.map((s: SeriesContent) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                  {seriesListQuery.isLoading && <p className="mt-1 text-xs text-slate-400">Diziler yukleniyor...</p>}
                </div>

                {/* Sezon secimi – sadece dizi secilince goster */}
                {Number(selectedSeriesId) > 0 && (
                  <div>
                    <label className="panel-label">Sezon</label>
                    <select
                      className="panel-select"
                      {...register('season_id', { required: true, valueAsNumber: true })}
                    >
                      <option value={0}>Sezon secin</option>
                      {seasonsList.map((season: Season) => (
                        <option key={season.id} value={season.id}>
                          Sezon {season.season_number}{season.title ? ` — ${season.title}` : ''}
                        </option>
                      ))}
                    </select>
                    {seasonsQuery.isLoading && <p className="mt-1 text-xs text-slate-400">Sezonlar yukleniyor...</p>}
                  </div>
                )}

                {/* Bolum numarasi */}
                <div>
                  <label className="panel-label">Bolum numarasi</label>
                  <input
                    type="number"
                    min={1}
                    className="panel-input"
                    placeholder="Ornek: 1"
                    {...register('episode_number', { required: true, valueAsNumber: true, min: 1 })}
                  />
                </div>
              </>
            )}

            {/* Kategori secimi + Cozunurluk (ortak) */}
            <div className="grid gap-4 md:grid-cols-2">
              {categoryType === 'movies' && (
              <div>
                <label className="panel-label">Kategori</label>
                <select className="panel-select" {...register('category_id', { valueAsNumber: true, required: true })}>
                  <option value={0}>Movie kategorisi secin</option>
                  {movieCategories.map((category: Category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              )}

              {isYoutube && (
                <div>
                  <label className="panel-label">Cozunurluk</label>
                  <select className="panel-select" {...register('resolution')}>
                    <option value="2160">2160p (4K)</option>
                    <option value="1080">1080p (Full HD)</option>
                    <option value="720">720p (HD)</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>
              )}
            </div>

            {/* VPN – sadece YouTube linklerinde */}
            {isYoutube && (
              <div className="space-y-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                    {...register('use_vpn')}
                  />
                  <span className="text-sm font-medium text-slate-700">VPN Kullan</span>
                </label>
                {useVpn && (
                  <div>
                    <label className="panel-label">VPN Istemcisi</label>
                    {activeVpnClients.length === 0 ? (
                      <p className="text-sm text-rose-600">Aktif VPN istemcisi bulunamadi.</p>
                    ) : (
                      <select className="panel-select" {...register('vpn_client_id', { valueAsNumber: true })}>
                        <option value={0}>VPN istemcisi secin</option>
                        {activeVpnClients.map((client: VpnClient) => (
                          <option key={client.id} value={client.id}>
                            {client.name}{client.description ? ` — ${client.description}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button type="submit" className="primary-button" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Ekleniyor...' : 'Kuyruga Ekle'}
              </button>
            </div>
          </form>
        </div>

        {/* Indirme kuyrugu listesi */}
        <div className="glass-panel p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Indirme kuyrugu</h3>
              <p className="mt-1 text-sm text-slate-500">Progress her 3 saniyede bir yenilenir.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="danger-button px-3 py-2 text-sm"
                onClick={() => setShowClearConfirm(true)}
              >
                <ListX size={15} />
                Kuyrugu Temizle
              </button>
              <select
                className="panel-select max-w-[180px]"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">Tum durumlar</option>
                <option value="queued">Kuyrukta</option>
                <option value="approved">Onaylandi</option>
                <option value="downloading">Indiriliyor</option>
                <option value="completed">Tamamlandi</option>
                <option value="failed">Hata</option>
                <option value="cancelled">Iptal</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {(downloadsQuery.data ?? []).map((item) => (
              <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="flex h-20 w-14 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                      {item.tmdb_poster_url ? (
                        <img src={item.tmdb_poster_url} alt={item.title} className="h-full w-full object-cover" />
                      ) : item.category_type === 'series' ? (
                        <Tv size={18} className="text-slate-500" />
                      ) : (
                        <Film size={18} className="text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold text-slate-900">
                          #{item.file_number.toString().padStart(5, '0')} - {item.tmdb_title || item.title}
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[item.status]}`}>
                          {item.status === 'downloading' && <LoaderCircle size={12} className="mr-1 inline animate-spin" />}
                          {statusLabels[item.status]}
                        </span>
                        {/* Dizi rozeti */}
                        {item.category_type === 'series' && (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                            Dizi{item.episode_number ? ` B${item.episode_number}` : ''}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                        <span>Kategori: {item.category_name || '-'}</span>
                        <span>Kaynak: {item.source_type}</span>
                        <span>Cozunurluk: {item.source_type === 'youtube' ? `${item.resolution}p` : 'auto'}</span>
                        <span>Boyut: {formatSize(item.file_size_bytes)}</span>
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                          <span>Ilerleme</span>
                          <span>%{item.progress_percent}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${item.status === 'failed' ? 'bg-rose-500' : 'bg-blue-500'}`}
                            style={{ width: `${item.progress_percent}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>Hiz: {formatSpeed(item.speed_mbps)}</span>
                        <span>ETA: {item.eta_seconds != null ? `${item.eta_seconds}s` : '-'}</span>
                      </div>
                      {item.error_message && (
                        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                          {item.error_message}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {(item.status === 'queued' || item.status === 'failed') && (
                      <button
                        type="button"
                        className="primary-button px-3 py-2"
                        onClick={() => approveMutation.mutate(item.id)}
                      >
                        <CheckCircle2 size={15} />
                        Onayla
                      </button>
                    )}
                    {(item.status === 'approved' || item.status === 'downloading') && (
                      <button
                        type="button"
                        className="secondary-button px-3 py-2"
                        onClick={() => cancelMutation.mutate(item.id)}
                      >
                        <XCircle size={15} />
                        Iptal
                      </button>
                    )}
                    {(item.status === 'failed' || item.status === 'cancelled') && (
                      <button
                        type="button"
                        className="secondary-button px-3 py-2"
                        onClick={() => retryMutation.mutate(item.id)}
                      >
                        <RefreshCcw size={15} />
                        Tekrar Dene
                      </button>
                    )}
                    {item.status !== 'downloading' && (
                      <button
                        type="button"
                        className="danger-button px-3 py-2"
                        onClick={() => deleteMutation.mutate(item.id)}
                      >
                        <Trash2 size={15} />
                        Sil
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {(downloadsQuery.data ?? []).length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
                Henuz indirme kuyrugu bos.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Kuyrugu temizle onay diyalogu */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Kuyrugu Temizle</h3>
            <p className="mt-2 text-sm text-slate-600">
              Tamamlanmis, basarisiz ve iptal edilen tum indirmeler listeden kaldirilacak. Dosyalar silinmez. Emin misiniz?
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="secondary-button" onClick={() => setShowClearConfirm(false)}>
                <XCircle size={16} /> Iptal
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
              >
                <Trash2 size={16} /> {clearMutation.isPending ? 'Temizleniyor...' : 'Temizle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{label}</div>
    </div>
  )
}
