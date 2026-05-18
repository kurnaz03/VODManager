import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  Edit2,
  Film,
  Folder,
  FolderOpen,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  X,
} from 'lucide-react'
import {
  BrowseResult,
  Episode,
  EpisodeCreate,
  FileEntry,
  Season,
  SeriesContent,
  SeriesContentCreate,
  TmdbSeason,
  episodeDownloadUrl,
  filesApi,
  seriesApi,
  tmdbApi,
} from '../services/contentApi'
import { downloadsApi, TmdbTv } from '../../downloads/services/downloadsApi'
import { serversApi, Server as ServerModel } from '../../servers/services/serversApi'

type View = 'series' | 'seasons' | 'episodes'

export default function SeriesPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const [view, setView] = useState<View>('series')
  const [selectedSeries, setSelectedSeries] = useState<SeriesContent | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null)
  const [showAddSeries, setShowAddSeries] = useState(false)
  const [showAddSeason, setShowAddSeason] = useState(false)
  const [showAddEpisode, setShowAddEpisode] = useState(false)
  const [editEpisode, setEditEpisode] = useState<Episode | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: number } | null>(null)

  // Series filter state
  const [dayFilter, setDayFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Edit series state
  const [editSeries, setEditSeries] = useState<SeriesContent | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editBroadcastDay, setEditBroadcastDay] = useState('')
  const [editBroadcastChannel, setEditBroadcastChannel] = useState('')
  const [editChannelLogoUrl, setEditChannelLogoUrl] = useState('')
  const [editPosterUrl, setEditPosterUrl] = useState('')
  const [editBackdropUrl, setEditBackdropUrl] = useState('')
  const [editReleaseYear, setEditReleaseYear] = useState('')
  const [editRating, setEditRating] = useState('')
  const [editServerId, setEditServerId] = useState<number | null>(null)
  const [tmdbImportResult, setTmdbImportResult] = useState<string | null>(null)
  const [showTmdbImportConfirm, setShowTmdbImportConfirm] = useState(false)
  const [pendingTmdbSeasons, setPendingTmdbSeasons] = useState<TmdbSeason[] | null>(null)
  const [tmdbFetching, setTmdbFetching] = useState(false)

  const seriesQuery = useQuery({
    queryKey: ['series'],
    queryFn: () => seriesApi.list(),
  })

  const serversQuery = useQuery({
    queryKey: ['servers'],
    queryFn: () => serversApi.list(),
  })

  const seasonsQuery = useQuery({
    queryKey: ['seasons', selectedSeries?.id],
    queryFn: () => seriesApi.listSeasons(selectedSeries!.id),
    enabled: view === 'seasons' && !!selectedSeries,
  })

  const episodesQuery = useQuery({
    queryKey: ['episodes', selectedSeason?.id],
    queryFn: () => seriesApi.listEpisodes(selectedSeason!.id),
    enabled: view === 'episodes' && !!selectedSeason,
  })

  const createSeriesMutation = useMutation({
    mutationFn: (payload: SeriesContentCreate) => seriesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] })
      setShowAddSeries(false)
    },
  })

  const deleteSeriesMutation = useMutation({
    mutationFn: (id: number) => seriesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] })
      setDeleteTarget(null)
    },
  })

  const updateSeriesMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<SeriesContentCreate> }) =>
      seriesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] })
      setEditSeries(null)
    },
  })

  const createSeasonMutation = useMutation({
    mutationFn: ({ seriesId, payload }: { seriesId: number; payload: { season_number: number; title?: string | null } }) =>
      seriesApi.createSeason(seriesId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons'] })
      setShowAddSeason(false)
    },
  })

  const deleteSeasonMutation = useMutation({
    mutationFn: ({ seriesId, seasonId }: { seriesId: number; seasonId: number }) =>
      seriesApi.deleteSeason(seriesId, seasonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons'] })
      setDeleteTarget(null)
    },
  })

  const createEpisodeMutation = useMutation({
    mutationFn: ({ seasonId, payload }: { seasonId: number; payload: EpisodeCreate }) =>
      seriesApi.createEpisode(seasonId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
      setShowAddEpisode(false)
    },
  })

  const updateEpisodeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<EpisodeCreate> }) =>
      seriesApi.updateEpisode(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
      setEditEpisode(null)
    },
  })

  const deleteEpisodeMutation = useMutation({
    mutationFn: (id: number) => seriesApi.deleteEpisode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] })
      setDeleteTarget(null)
    },
  })

  // TMDB bulk import
  const tmdbImportMutation = useMutation({
    mutationFn: async (seasons: TmdbSeason[]) => {
      if (!selectedSeries) throw new Error('Seri secilmedi')
      let created = 0
      for (const s of seasons) {
        const season = await seriesApi.createSeason(selectedSeries.id, {
          season_number: s.season_number,
          title: s.name ?? undefined,
        })
        for (const ep of s.episodes) {
          await seriesApi.createEpisode(season.id, {
            episode_number: ep.episode_number,
            title: ep.name ?? undefined,
            duration: ep.runtime ?? undefined,
          })
          created++
        }
      }
      return created
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['seasons'] })
      queryClient.invalidateQueries({ queryKey: ['series'] })
      setShowTmdbImportConfirm(false)
      setPendingTmdbSeasons(null)
      setTmdbImportResult(`${count} bolum basariyla olusturuldu.`)
      setTimeout(() => setTmdbImportResult(null), 5000)
    },
    onError: (e: Error) => {
      setShowTmdbImportConfirm(false)
      setTmdbImportResult(`Hata: ${e.message}`)
      setTimeout(() => setTmdbImportResult(null), 5000)
    },
  })

  const handleTmdbImportClick = async () => {
    if (!selectedSeries?.tmdb_id) return
    setTmdbFetching(true)
    try {
      const seasons = await tmdbApi.getTvSeasons(selectedSeries.tmdb_id)
      setPendingTmdbSeasons(seasons)
      const existingSeasons = seasonsQuery.data ?? []
      if (existingSeasons.length > 0) {
        setShowTmdbImportConfirm(true)
      } else {
        tmdbImportMutation.mutate(seasons)
      }
    } catch (e) {
      setTmdbImportResult(`TMDB hatasi: ${(e as Error).message}`)
      setTimeout(() => setTmdbImportResult(null), 5000)
    } finally {
      setTmdbFetching(false)
    }
  }

  const seriesList: SeriesContent[] = seriesQuery.data ?? []
  const seasons: Season[] = seasonsQuery.data ?? []
  const episodes: Episode[] = episodesQuery.data ?? []
  const servers: ServerModel[] = serversQuery.data ?? []

  // Filter derived values
  const uniqueChannels = Array.from(
    new Set(seriesList.map((s) => s.broadcast_channel).filter(Boolean))
  ) as string[]

  const filteredSeriesList = seriesList.filter((s) => {
    if (dayFilter && s.broadcast_day !== dayFilter) return false
    if (channelFilter && s.broadcast_channel !== channelFilter) return false
    if (searchQuery && !s.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  // Auto-navigate to series detail when coming from dashboard
  useEffect(() => {
    const state = location.state as { seriesId?: number } | null
    if (state?.seriesId && seriesQuery.data) {
      const found = seriesQuery.data.find((s) => s.id === state.seriesId)
      if (found) {
        setSelectedSeries(found)
        setView('seasons')
        // Clear state so navigating back works clean
        window.history.replaceState({}, '')
      }
    }
  }, [location.state, seriesQuery.data])

  function goBack() {
    if (view === 'episodes') { setView('seasons'); setSelectedSeason(null) }
    else if (view === 'seasons') { setView('series'); setSelectedSeries(null) }
  }

  const breadcrumbs = [
    { label: 'Seriler', active: view === 'series', onClick: () => { setView('series'); setSelectedSeries(null); setSelectedSeason(null) } },
    ...(selectedSeries ? [{ label: selectedSeries.title, active: view === 'seasons', onClick: () => { setView('seasons'); setSelectedSeason(null) } }] : []),
    ...(selectedSeason ? [{ label: `Sezon ${selectedSeason.season_number}`, active: view === 'episodes', onClick: () => {} }] : []),
  ]

  return (
    <div className="space-y-6">
      <section className="glass-panel p-4 sm:p-6 sm:p-7">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Icerik Yonetimi</div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">Series</h2>
            <nav className="mt-3 flex flex-wrap items-center gap-1 text-sm text-slate-500">
              {breadcrumbs.map((b, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={14} />}
                  <button
                    type="button"
                    onClick={b.onClick}
                    className={b.active ? 'font-semibold text-slate-900' : 'hover:text-slate-700'}
                  >
                    {b.label}
                  </button>
                </span>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {view !== 'series' && (
              <button type="button" className="secondary-button" onClick={goBack}>
                <ArrowLeft size={16} /> Geri
              </button>
            )}
            {view === 'series' && (
              <button type="button" className="primary-button" onClick={() => setShowAddSeries(true)}>
                <Plus size={16} /> Seri Ekle
              </button>
            )}
            {view === 'seasons' && selectedSeries && (
              <>
                {selectedSeries.tmdb_id && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleTmdbImportClick}
                    disabled={tmdbFetching || tmdbImportMutation.isPending}
                  >
                    <RefreshCw size={16} className={(tmdbFetching || tmdbImportMutation.isPending) ? 'animate-spin' : ''} />
                    {(tmdbFetching || tmdbImportMutation.isPending) ? 'Getiriliyor...' : 'TMDB Sezonlari Getir'}
                  </button>
                )}
                <button type="button" className="primary-button" onClick={() => setShowAddSeason(true)}>
                  <Plus size={16} /> Sezon Ekle
                </button>
              </>
            )}
            {view === 'episodes' && (
              <button type="button" className="primary-button" onClick={() => setShowAddEpisode(true)}>
                <Plus size={16} /> Bolum Ekle
              </button>
            )}
          </div>
        </div>
        {tmdbImportResult && (
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700">
            {tmdbImportResult}
          </div>
        )}
      </section>

      {/* Seasons view: backdrop hero banner */}
      {view === 'seasons' && selectedSeries && selectedSeries.backdrop_url && (
        <div className="relative overflow-hidden rounded-3xl" style={{ height: '220px' }}>
          <img
            src={selectedSeries.backdrop_url}
            alt={selectedSeries.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.92) 100%)' }}
          />
          <div className="absolute bottom-0 left-0 right-0 flex items-end gap-4 p-6">
            {selectedSeries.poster_url && (
              <img
                src={selectedSeries.poster_url}
                alt={selectedSeries.title}
                className="h-20 w-14 flex-shrink-0 rounded-xl object-cover shadow-lg"
              />
            )}
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-white truncate">{selectedSeries.title}</h3>
              {selectedSeries.description && (
                <p className="mt-1 text-sm text-slate-300 line-clamp-2">{selectedSeries.description}</p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                {selectedSeries.release_year && <span>{selectedSeries.release_year}</span>}
                <span>{seasons.length} Sezon</span>
                {selectedSeries.rating && <span>★ {selectedSeries.rating.toFixed(1)}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="glass-panel p-4 sm:p-6">
        {/* Series view */}
        {view === 'series' && (
          <div>
            {/* Filter row */}
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 sm:w-auto sm:min-w-[180px]"
                placeholder="Dizi ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 sm:w-auto"
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
              >
                <option value="">Tum Gunler</option>
                {BROADCAST_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 sm:w-auto"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
              >
                <option value="">Tum Kanallar</option>
                {uniqueChannels.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
              </select>
              {(dayFilter || channelFilter || searchQuery) && (
                <button
                  type="button"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 sm:w-auto"
                  onClick={() => { setDayFilter(''); setChannelFilter(''); setSearchQuery('') }}
                >
                  Temizle
                </button>
              )}
            </div>
            <div className="table-shell overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="table-head text-left">
                  <th className="px-4 py-3 font-semibold text-slate-500">ID</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Cover</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Dizi Adi</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Sezon</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Yayin Gunu</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Kanal</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Kategori</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Islemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSeriesList.map((s) => (
                  <tr
                    key={s.id}
                    className="table-zebra cursor-pointer hover:bg-slate-50"
                    onClick={() => { setSelectedSeries(s); setView('seasons') }}
                  >
                    <td className="px-4 py-3 text-slate-600">#{s.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex h-14 w-10 items-center justify-center overflow-hidden rounded-lg bg-slate-200">
                        {s.poster_url ? (
                          <img src={s.poster_url} alt={s.title} className="h-full w-full object-cover" />
                        ) : (
                          <Film size={14} className="text-slate-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{s.title}</td>
                    <td className="px-4 py-3 text-slate-600">{s.season_count}</td>
                    <td className="px-4 py-3 text-slate-600">{s.broadcast_day ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {s.channel_logo_url && (
                          <img src={s.channel_logo_url} alt={s.broadcast_channel ?? ''} className="h-5 w-auto object-contain" />
                        )}
                        <span className="text-slate-600 text-sm">{s.broadcast_channel ?? '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.category_name ?? '-'}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-1"
                          onClick={() => {
                            setEditSeries(s)
                            setEditTitle(s.title)
                            setEditDescription(s.description ?? '')
                            setEditBroadcastDay(s.broadcast_day ?? '')
                            setEditBroadcastChannel(s.broadcast_channel ?? '')
                            setEditChannelLogoUrl(s.channel_logo_url ?? '')
                            setEditPosterUrl(s.poster_url ?? '')
                            setEditBackdropUrl(s.backdrop_url ?? '')
                            setEditReleaseYear(s.release_year != null ? String(s.release_year) : '')
                            setEditRating(s.rating != null ? String(s.rating) : '')
                            setEditServerId(s.server_id)
                          }}
                        >
                          <Edit2 size={13} /> Duzenle
                        </button>
                        <button
                          type="button"
                          className="danger-button px-2 py-1.5 text-xs"
                          onClick={() => setDeleteTarget({ type: 'series', id: s.id })}
                        >
                          <Trash2 size={13} /> Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSeriesList.length === 0 && !seriesQuery.isLoading && (
                  <tr><td colSpan={8} className="px-6 py-16 text-center text-sm text-slate-500">
                    {seriesList.length === 0 ? 'Dizi bulunamadi.' : 'Filtreye uyan dizi yok.'}
                  </td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Seasons view */}
        {view === 'seasons' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {seasons.map((season) => (
              <button
                key={season.id}
                type="button"
                onClick={() => { setSelectedSeason(season); setView('episodes') }}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    {season.title || `Sezon ${season.season_number}`}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{season.episode_count} bolum</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 p-1.5 text-rose-500 hover:bg-rose-50"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'season', id: season.id }) }}
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={18} className="text-slate-400" />
                </div>
              </button>
            ))}
            {seasons.length === 0 && !seasonsQuery.isLoading && (
              <div className="col-span-3 py-16 text-center text-sm text-slate-500">Sezon eklenmemis.</div>
            )}
          </div>
        )}

        {/* Episodes view */}
        {view === 'episodes' && (
          <div className="table-shell overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="table-head text-left">
                  <th className="px-4 py-3 font-semibold text-slate-500">Bolum</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Baslik</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Sure</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Cozunurluk</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Dosya</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Islemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {episodes.map((ep) => (
                  <tr key={ep.id} className="table-zebra hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">B{ep.episode_number}</td>
                    <td className="px-4 py-3 text-slate-600">{ep.title || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{ep.duration ? `${ep.duration}s` : '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{ep.resolution ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-[140px] truncate" title={ep.file_path ?? ''}>
                      {ep.file_path ? ep.file_path.split('/').pop() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-1"
                          onClick={() => setEditEpisode(ep)}
                        >
                          <Edit2 size={12} /> Duzenle
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs text-rose-500 hover:bg-rose-50 flex items-center gap-1"
                          onClick={() => setDeleteTarget({ type: 'episode', id: ep.id })}
                        >
                          <Trash2 size={12} /> Sil
                        </button>
                        {ep.file_path ? (
                          <a
                            href={episodeDownloadUrl(ep.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-1"
                          >
                            <Download size={12} /> Indir
                          </a>
                        ) : (
                          <span className="rounded-xl border border-slate-100 px-2 py-1.5 text-xs text-slate-300 flex items-center gap-1 cursor-not-allowed">
                            <Download size={12} /> Dosya Yok
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {episodes.length === 0 && !episodesQuery.isLoading && (
                  <tr><td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-500">Bolum eklenmemis.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add Series Modal */}
      {showAddSeries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Yeni Seri Ekle</h3>
              <button type="button" onClick={() => setShowAddSeries(false)}><X size={20} /></button>
            </div>
            <AddSeriesForm
              onSubmit={(p) => createSeriesMutation.mutate(p)}
              isPending={createSeriesMutation.isPending}
              servers={servers}
            />
          </div>
        </div>
      )}

      {/* Add Season Modal */}
      {showAddSeason && selectedSeries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Sezon Ekle</h3>
              <button type="button" onClick={() => setShowAddSeason(false)}><X size={20} /></button>
            </div>
            <AddSeasonForm
              seriesId={selectedSeries.id}
              onSubmit={(p) => createSeasonMutation.mutate({ seriesId: selectedSeries.id, payload: p })}
              isPending={createSeasonMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Add Episode Modal */}
      {showAddEpisode && selectedSeason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Bolum Ekle</h3>
              <button type="button" onClick={() => setShowAddEpisode(false)}><X size={20} /></button>
            </div>
            <EpisodeForm
              seasonId={selectedSeason.id}
              onSubmit={(p) => createEpisodeMutation.mutate({ seasonId: selectedSeason.id, payload: p })}
              isPending={createEpisodeMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Edit Episode Modal */}
      {editEpisode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Bolum Duzenle — B{editEpisode.episode_number}</h3>
              <button type="button" onClick={() => setEditEpisode(null)}><X size={20} /></button>
            </div>
            <EpisodeForm
              initial={editEpisode}
              onSubmit={(p) => updateEpisodeMutation.mutate({ id: editEpisode.id, payload: p })}
              isPending={updateEpisodeMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* TMDB Import Confirm */}
      {showTmdbImportConfirm && pendingTmdbSeasons && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Mevcut Sezonlar Var</h3>
            <p className="mt-2 text-sm text-slate-600">
              Bu dizide zaten {seasonsQuery.data?.length ?? 0} sezon mevcut. TMDB verilerini eklemek istiyor musunuz?
              (Mevcut sezonlarin uzerine yazilmaz, yeni sezonlar eklenir.)
            </p>
            <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {pendingTmdbSeasons.length} sezon &middot; toplam {pendingTmdbSeasons.reduce((a, s) => a + s.episodes.length, 0)} bolum
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="secondary-button" onClick={() => { setShowTmdbImportConfirm(false); setPendingTmdbSeasons(null) }}>
                <X size={16} /> Iptal
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => tmdbImportMutation.mutate(pendingTmdbSeasons)}
                disabled={tmdbImportMutation.isPending}
              >
                <Check size={16} /> Devam Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Series Modal */}
      {editSeries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-4 sm:p-6 shadow-xl overflow-y-auto" style={{ maxHeight: '90vh' }}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Dizi Duzenle</h3>
              <button type="button" onClick={() => setEditSeries(null)}><X size={20} /></button>
            </div>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                updateSeriesMutation.mutate({
                  id: editSeries.id,
                  payload: {
                    title: editTitle,
                    description: editDescription || null,
                    broadcast_day: editBroadcastDay || null,
                    broadcast_channel: editBroadcastChannel || null,
                    channel_logo_url: editChannelLogoUrl || null,
                    poster_url: editPosterUrl || null,
                    backdrop_url: editBackdropUrl || null,
                    release_year: editReleaseYear ? Number(editReleaseYear) : null,
                    rating: editRating ? parseFloat(editRating) : null,
                    server_id: editServerId,
                  },
                })
              }}
            >
              <div>
                <label className="panel-label">Dizi Adi</label>
                <input className="panel-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              </div>
              <div>
                <label className="panel-label">Aciklama</label>
                <textarea className="panel-input" rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="panel-label">Yayin Gunu</label>
                  <select className="panel-input w-full" value={editBroadcastDay} onChange={(e) => setEditBroadcastDay(e.target.value)}>
                    <option value="">Secilmedi</option>
                    {BROADCAST_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="panel-label">Kanal</label>
                  <input className="panel-input w-full" value={editBroadcastChannel} onChange={(e) => setEditBroadcastChannel(e.target.value)} placeholder="TRT1, ATV..." />
                </div>
              </div>
              <div>
                <label className="panel-label">Sunucu</label>
                <select
                  className="panel-input w-full"
                  value={editServerId ?? ''}
                  onChange={(e) => setEditServerId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Main Server (varsayilan)</option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.ip_address})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="panel-label">Kanal Logo URL</label>
                <input className="panel-input" value={editChannelLogoUrl} onChange={(e) => setEditChannelLogoUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label className="panel-label">Poster URL</label>
                <input className="panel-input" value={editPosterUrl} onChange={(e) => setEditPosterUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label className="panel-label">Backdrop URL</label>
                <input className="panel-input" value={editBackdropUrl} onChange={(e) => setEditBackdropUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="panel-label">Cikis Yili</label>
                  <input type="number" className="panel-input w-full" value={editReleaseYear} onChange={(e) => setEditReleaseYear(e.target.value)} placeholder="2024" />
                </div>
                <div>
                  <label className="panel-label">Puan</label>
                  <input type="number" step="0.1" min="0" max="10" className="panel-input w-full" value={editRating} onChange={(e) => setEditRating(e.target.value)} placeholder="7.5" />
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button type="button" className="secondary-button" onClick={() => setEditSeries(null)}>
                  <X size={16} /> Iptal
                </button>
                <button type="submit" className="primary-button" disabled={updateSeriesMutation.isPending}>
                  <Check size={16} /> {updateSeriesMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-4 sm:p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Silme Onay</h3>
            <p className="mt-2 text-sm text-slate-600">Bu kaydı silmek istediginize emin misiniz?</p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" className="secondary-button" onClick={() => setDeleteTarget(null)}>
                <X size={16} /> Iptal
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => {
                  if (deleteTarget.type === 'series') deleteSeriesMutation.mutate(deleteTarget.id)
                  else if (deleteTarget.type === 'season' && selectedSeries)
                    deleteSeasonMutation.mutate({ seriesId: selectedSeries.id, seasonId: deleteTarget.id })
                  else if (deleteTarget.type === 'episode') deleteEpisodeMutation.mutate(deleteTarget.id)
                }}
              >
                <Trash2 size={16} /> Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Add Series Form ────────────────────────────────────────────────────────────

const BROADCAST_DAYS = ['Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi', 'Pazar']

function AddSeriesForm({
  onSubmit,
  isPending,
  servers,
}: {
  onSubmit: (p: SeriesContentCreate) => void
  isPending: boolean
  servers: ServerModel[]
}) {
  const [title, setTitle] = useState('')
  const [tmdbQuery, setTmdbQuery] = useState('')
  const [selectedTmdb, setSelectedTmdb] = useState<TmdbTv | null>(null)
  const [broadcastDay, setBroadcastDay] = useState<string>('')
  const [broadcastChannel, setBroadcastChannel] = useState('')
  const [channelLogoUrl, setChannelLogoUrl] = useState('')
  const [serverId, setServerId] = useState<number | null>(null)

  const tmdbSearch = useQuery({
    queryKey: ['tmdb-tv-search', tmdbQuery],
    queryFn: () => downloadsApi.searchTmdbTv(tmdbQuery),
    enabled: tmdbQuery.trim().length >= 2,
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          title: selectedTmdb?.title || title,
          description: selectedTmdb?.overview ?? null,
          category_id: null,
          tmdb_id: selectedTmdb?.id ?? null,
          poster_url: selectedTmdb?.poster_url ?? null,
          backdrop_url: selectedTmdb?.backdrop_url ?? null,
          release_year: selectedTmdb?.first_air_year ?? null,
          rating: selectedTmdb?.rating ?? null,
          broadcast_day: broadcastDay || null,
          broadcast_channel: broadcastChannel || null,
          channel_logo_url: channelLogoUrl || null,
          server_id: serverId,
        })
      }}
    >
      <div className="relative">
        <label className="panel-label">Dizi Adi (TMDB otomatik arar)</label>
        <input
          className="panel-input"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setTmdbQuery(e.target.value); if (selectedTmdb) setSelectedTmdb(null) }}
          placeholder="Dizi adini yazin..."
          required
        />
        {(tmdbSearch.data ?? []).length > 0 && !selectedTmdb && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
            {(tmdbSearch.data ?? []).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setSelectedTmdb(m); setTitle(m.title); setTmdbQuery('') }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                {m.poster_url && <img src={m.poster_url} alt={m.title} className="h-10 w-7 rounded object-cover" />}
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{m.title}</div>
                  <div className="text-xs text-slate-500">{m.first_air_year}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {selectedTmdb && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          {selectedTmdb.poster_url && <img src={selectedTmdb.poster_url} alt={selectedTmdb.title} className="h-14 w-10 rounded object-cover" />}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900 text-sm">{selectedTmdb.title}</div>
            <div className="text-xs text-slate-500">{selectedTmdb.first_air_year}</div>
            {selectedTmdb.overview && (
              <div className="mt-1 text-xs text-slate-600 line-clamp-2">{selectedTmdb.overview}</div>
            )}
          </div>
          <button type="button" onClick={() => { setSelectedTmdb(null); setTitle('') }} className="text-slate-400 hover:text-slate-600 flex-shrink-0"><X size={16} /></button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="panel-label">Yayin Gunu</label>
          <select className="panel-input w-full" value={broadcastDay} onChange={(e) => setBroadcastDay(e.target.value)}>
            <option value="">Secilmedi</option>
            {BROADCAST_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="panel-label">Kanal</label>
          <input className="panel-input" value={broadcastChannel} onChange={(e) => setBroadcastChannel(e.target.value)} placeholder="TRT1, ATV, Star TV..." />
        </div>
      </div>
      <div>
        <label className="panel-label">Sunucu</label>
        <select
          className="panel-input w-full"
          value={serverId ?? ''}
          onChange={(e) => setServerId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Main Server (varsayilan)</option>
          {servers.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.ip_address})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="panel-label">Kanal Logosu URL (opsiyonel)</label>
        <input className="panel-input" value={channelLogoUrl} onChange={(e) => setChannelLogoUrl(e.target.value)} placeholder="https://..." />
      </div>
      <div className="flex justify-end">
        <button type="submit" className="primary-button" disabled={isPending}>
          <Check size={16} /> {isPending ? 'Ekleniyor...' : 'Ekle'}
        </button>
      </div>
    </form>
  )
}

// ── Add Season Form ────────────────────────────────────────────────────────────

function AddSeasonForm({
  onSubmit,
  isPending,
}: {
  seriesId?: number
  onSubmit: (p: { season_number: number; title?: string }) => void
  isPending: boolean
}) {
  const [seasonNum, setSeasonNum] = useState(1)
  const [title, setTitle] = useState('')
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ season_number: seasonNum, title: title || undefined }) }}>
      <div>
        <label className="panel-label">Sezon Numarasi</label>
        <input type="number" className="panel-input" value={seasonNum} min={1} onChange={(e) => setSeasonNum(Number(e.target.value))} required />
      </div>
      <div>
        <label className="panel-label">Baslik (isteğe bagli)</label>
        <input className="panel-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sezon 1" />
      </div>
      <div className="flex justify-end">
        <button type="submit" className="primary-button" disabled={isPending}>
          <Check size={16} /> {isPending ? 'Ekleniyor...' : 'Ekle'}
        </button>
      </div>
    </form>
  )
}

// ── Episode Form (Add & Edit) ─────────────────────────────────────────────────

function EpisodeForm({
  initial,
  onSubmit,
  isPending,
}: {
  seasonId?: number
  initial?: Episode
  onSubmit: (p: EpisodeCreate) => void
  isPending: boolean
}) {
  const [epNum, setEpNum] = useState(initial?.episode_number ?? 1)
  const [epTitle, setEpTitle] = useState(initial?.title ?? '')
  const [filePath, setFilePath] = useState(initial?.file_path ?? '')
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url ?? '')
  const [showBrowser, setShowBrowser] = useState(false)

  return (
    <>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit({
            episode_number: epNum,
            title: epTitle || null,
            file_path: filePath || null,
            source_url: sourceUrl || null,
            duration: initial?.duration ?? null,
            resolution: initial?.resolution ?? null,
            audio_bitrate: initial?.audio_bitrate ?? null,
          })
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="panel-label">Bolum No</label>
            <input type="number" className="panel-input" value={epNum} min={1} onChange={(e) => setEpNum(Number(e.target.value))} required />
          </div>
          <div>
            <label className="panel-label">Baslik</label>
            <input className="panel-input" value={epTitle} onChange={(e) => setEpTitle(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="panel-label">Dosya Yolu</label>
          <div className="flex gap-2">
            <input
              className="panel-input flex-1"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="/var/www/vod-manager/shared/..."
            />
            <button
              type="button"
              className="secondary-button whitespace-nowrap"
              onClick={() => setShowBrowser(true)}
            >
              <FolderOpen size={14} /> Sunucudan Sec
            </button>
          </div>
        </div>
        <div>
          <label className="panel-label">URL</label>
          <input className="panel-input" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="primary-button" disabled={isPending}>
            <Check size={16} /> {isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>

      {showBrowser && (
        <FileBrowserModal
          onSelect={(path) => { setFilePath(path); setShowBrowser(false) }}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </>
  )
}

// ── File Browser Modal ─────────────────────────────────────────────────────────

function FileBrowserModal({
  onSelect,
  onClose,
}: {
  onSelect: (path: string) => void
  onClose: () => void
}) {
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null)
  const [currentPath, setCurrentPath] = useState('/var/www/vod-manager/shared')

  const serversQuery = useQuery({
    queryKey: ['servers-file-browser'],
    queryFn: serversApi.list,
  })
  const servers: ServerModel[] = serversQuery.data ?? []
  const lbServers = servers.filter((s) => s.server_type === 'loadbalancer')

  const browseQuery = useQuery({
    queryKey: ['files-browse', currentPath, selectedServerId],
    queryFn: () => filesApi.browse(currentPath, selectedServerId ?? undefined),
    retry: false,
  })

  const data: BrowseResult | undefined = browseQuery.data

  function handleServerChange(val: string) {
    const id = val === 'local' ? null : Number(val)
    setSelectedServerId(id)
    setCurrentPath('/var/www/vod-manager/shared')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-900">Sunucu Dosya Gezgini</h3>
            <p className="mt-0.5 text-xs text-slate-400 font-mono truncate max-w-xs">{currentPath}</p>
          </div>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Server selector */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-2.5">
          <Server size={14} className="text-slate-400 flex-shrink-0" />
          <select
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={selectedServerId == null ? 'local' : String(selectedServerId)}
            onChange={(e) => handleServerChange(e.target.value)}
          >
            <option value="local">Ana Sunucu (Lokal)</option>
            {lbServers.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name} ({s.ip_address})
              </option>
            ))}
          </select>
        </div>

        {/* Navigation bar */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-2">
          {data?.parent_path && (
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
              onClick={() => setCurrentPath(data.parent_path!)}
            >
              <ArrowLeft size={12} /> Ust Dizin
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {browseQuery.isLoading && (
            <div className="py-12 text-center text-sm text-slate-400">Yukleniyor...</div>
          )}
          {browseQuery.isError && (
            <div className="py-12 text-center text-sm text-rose-500">
              {(browseQuery.error as Error).message}
            </div>
          )}
          {data && (
            <div className="space-y-0.5">
              {data.dirs.map((d: FileEntry) => (
                <button
                  key={d.path}
                  type="button"
                  onClick={() => setCurrentPath(d.path)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                >
                  <Folder size={16} className="text-blue-400 flex-shrink-0" />
                  <span className="text-sm text-slate-800">{d.name}</span>
                </button>
              ))}
              {data.files.map((f: FileEntry) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => onSelect(f.path)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-emerald-50"
                >
                  <Film size={16} className="text-emerald-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-800 truncate">{f.name}</div>
                    {f.size != null && (
                      <div className="text-xs text-slate-400">{(f.size / 1024 / 1024).toFixed(1)} MB</div>
                    )}
                  </div>
                </button>
              ))}
              {data.dirs.length === 0 && data.files.length === 0 && (
                <div className="py-12 text-center text-sm text-slate-400">Bu dizin bos veya video dosyasi yok.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
