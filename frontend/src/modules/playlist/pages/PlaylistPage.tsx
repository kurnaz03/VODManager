import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronLeft,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Film,
  ListVideo,
  Pencil,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Square,
  Timer,
  X,
} from 'lucide-react'
import { playlistApi, EpgProgram, Playlist, PlaylistItem } from '../services/playlistApi'
import { transcodeApi } from '../../transcode/services/transcodeApi'
import { serversApi } from '../../servers/services/serversApi'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDurationLong(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <div
      className={`fixed right-6 top-6 z-50 rounded-2xl px-5 py-3 text-sm font-medium shadow-xl ${
        type === 'ok' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
      }`}
    >
      {msg}
    </div>
  )
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-2 text-base font-semibold text-slate-800">{title}</h3>
        <p className="mb-6 text-sm text-slate-500">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
          >
            Iptal
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 transition"
          >
            Sil
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create Playlist Modal ─────────────────────────────────────────────────────

function CreatePlaylistModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (pl: Playlist) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loop, setLoop] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Playlist adi zorunlu'); return }
    setLoading(true)
    try {
      const pl = await playlistApi.create({ name: name.trim(), description: description.trim() || null, loop })
      onCreated(pl)
    } catch {
      setError('Olusturulamadi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Yeni Playlist Olustur</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Playlist Adi *</label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
              placeholder="Aksiyon Kanal 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Aciklama</label>
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
              placeholder="Opsiyonel aciklama"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLoop((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${loop ? 'bg-blue-500' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${loop ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-slate-600">Son videoda basa don (Loop)</span>
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              Iptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
            >
              {loading ? 'Olusturuluyor...' : 'Olustur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── EPG Modal ─────────────────────────────────────────────────────────────────

function EpgModal({
  playlistId,
  playlistName,
  onClose,
}: {
  playlistId: number
  playlistName: string
  onClose: () => void
}) {
  const currentRef = useRef<HTMLDivElement>(null)

  const { data: programs, isLoading } = useQuery({
    queryKey: ['epg-programs', playlistId],
    queryFn: () => playlistApi.getEpgPrograms(playlistId),
  })

  useEffect(() => {
    if (currentRef.current) {
      setTimeout(() => {
        currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [programs])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[82vh] rounded-2xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-800">EPG — {playlistName}</h3>
            <p className="text-xs text-slate-400 mt-0.5">24 saatlik program akisi</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/v1/playlists/${playlistId}/epg.xml`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              <Download size={13} />
              XMLTV Indir
            </a>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-slate-400">EPG yukleniyor...</div>
          ) : !programs || programs.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">EPG verisi bulunamadi (playlist bos olabilir)</div>
          ) : (
            <div className="space-y-1">
              {programs.map((prog: EpgProgram, idx: number) => (
                <div
                  key={idx}
                  ref={prog.is_current ? currentRef : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                    prog.is_current
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  {prog.poster ? (
                    <img
                      src={prog.poster}
                      alt={prog.title}
                      className="h-12 w-8 rounded-lg object-cover shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="h-12 w-8 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center">
                      <Film size={12} className="text-slate-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-slate-400 shrink-0">
                        {formatTime(prog.start)} – {formatTime(prog.stop)}
                      </span>
                      {prog.is_current && (
                        <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white animate-pulse">
                          CANLI
                        </span>
                      )}
                    </div>
                    <div className="truncate text-sm font-semibold text-slate-800">{prog.title}</div>
                    {prog.desc && (
                      <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">{prog.desc}</div>
                    )}
                  </div>
                  <div className="shrink-0 text-xs text-slate-400 font-mono">
                    {formatDuration(prog.duration_seconds)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Add Videos Modal ──────────────────────────────────────────────────────────

function AddVideosModal({
  playlistId,
  onClose,
  onToast,
}: {
  playlistId: number
  onClose: () => void
  onToast: (msg: string, type: 'ok' | 'err') => void
}) {
  const queryClient = useQueryClient()
  const [selectedProfileId, setSelectedProfileId] = useState<number | ''>('')

  const profilesQ = useQuery({
    queryKey: ['transcode-profiles'],
    queryFn: () => transcodeApi.list(),
  })

  const jobsQ = useQuery({
    queryKey: ['playlist-jobs', selectedProfileId],
    queryFn: () => playlistApi.jobsByProfile(selectedProfileId as number),
    enabled: selectedProfileId !== '',
  })

  const addItemMut = useMutation({
    mutationFn: (jobId: number) => playlistApi.addItem(playlistId, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] })
      queryClient.invalidateQueries({ queryKey: ['playlist-jobs', selectedProfileId] })
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      onToast('Video eklendi', 'ok')
    },
    onError: (e: any) => onToast(e?.response?.data?.detail ?? 'Eklenemedi', 'err'),
  })

  const profiles = profilesQ.data ?? []
  const jobs = jobsQ.data ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[72vh] rounded-2xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800">Playlist'e Video Ekle</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition">
            <X size={16} />
          </button>
        </div>
        <div className="px-4 pt-4 pb-2">
          <select
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">-- Transcode Kategorisi Seciniz --</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {selectedProfileId === '' ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Film size={28} className="mb-2 opacity-40" />
              <p className="text-xs">Kategori seciniz</p>
            </div>
          ) : jobsQ.isLoading ? (
            <div className="py-8 text-center text-sm text-slate-400">Yukleniyor...</div>
          ) : jobs.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">Bu kategoride tamamlanmis video yok</div>
          ) : (
            <div className="space-y-1.5">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition ${
                    job.is_in_playlist
                      ? 'bg-slate-50 opacity-50 cursor-not-allowed'
                      : 'bg-slate-50 hover:bg-blue-50 cursor-pointer'
                  }`}
                  onClick={() => !job.is_in_playlist && addItemMut.mutate(job.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-700">
                      {job.movie_title ?? `Job #${job.id}`}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      #{String(job.id).padStart(5, '0')}
                      {job.is_in_playlist && <span className="ml-2 text-amber-500">Zaten playlist'te</span>}
                    </div>
                  </div>
                  {!job.is_in_playlist && (
                    <button
                      className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition"
                      onClick={(e) => { e.stopPropagation(); addItemMut.mutate(job.id) }}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Playlist List View (Xtream Codes Table Style) ────────────────────────────

function UptimeBadge({ startedAt }: { startedAt: string | null }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) { setElapsed(0); return }
    const start = new Date(startedAt).getTime()
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [startedAt])

  if (!startedAt) return <span className="text-xs text-slate-400">—</span>

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  const label = `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-mono font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      {label}
    </span>
  )
}

function StreamInfoBadges({ info }: { info: any }) {
  if (!info) return <span className="text-xs text-slate-400">—</span>
  return (
    <div className="flex flex-wrap items-center gap-1">
      {info.video_codec && (
        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase">{info.video_codec}</span>
      )}
      {info.audio_codec && (
        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 uppercase">{info.audio_codec}</span>
      )}
      {info.fps && (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{info.fps} FPS</span>
      )}
      {info.bitrate && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{info.bitrate}</span>
      )}
      {info.width && info.height && (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{info.width}×{info.height}</span>
      )}
    </div>
  )
}

function PlayerModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Stream URL</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition"><X size={15} /></button>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 mb-4">
          <code className="text-xs text-slate-700 break-all">{url}</code>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            <Copy size={14} />
            {copied ? 'Kopyalandi!' : 'Kopyala'}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition"
          >
            <ExternalLink size={14} />
            Ac
          </a>
        </div>
      </div>
    </div>
  )
}

function PlaylistListView({
  playlists,
  loading,
  onSelect,
  onCreate,
  onDelete,
  onStart,
  onStop,
  startingId,
  stoppingId,
}: {
  playlists: Playlist[]
  loading: boolean
  onSelect: (pl: Playlist) => void
  onCreate: () => void
  onDelete: (id: number) => void
  onStart: (id: number) => void
  onStop: (id: number) => void
  startingId: number | null
  stoppingId: number | null
}) {
  const [epgPlaylist, setEpgPlaylist] = useState<Playlist | null>(null)
  const [playerUrl, setPlayerUrl] = useState<string | null>(null)

  return (
    <div className="space-y-4 p-6">
      {epgPlaylist && (
        <EpgModal
          playlistId={epgPlaylist.id}
          playlistName={epgPlaylist.name}
          onClose={() => setEpgPlaylist(null)}
        />
      )}
      {playerUrl && <PlayerModal url={playerUrl} onClose={() => setPlayerUrl(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">VOD Channel / Playlist</h1>
          <p className="mt-1 text-sm text-slate-500">Transcode edilmis videolardan kanal playlist'leri olusturun</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          Yeni Playlist
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Yukleniyor...</div>
      ) : playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 py-20">
          <ListVideo size={40} className="mb-4 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Henuz playlist yok</p>
          <button
            onClick={onCreate}
            className="mt-5 flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            <Plus size={16} />
            Playlist Olustur
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">ID</th>
                  <th className="px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">ICON</th>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">NAME</th>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">SOURCE</th>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">CLIENTS</th>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">UPTIME</th>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ACTIONS</th>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">PLAYER</th>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">EPG</th>
                  <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">STREAM INFO</th>
                </tr>
              </thead>
              <tbody>
                {playlists.map((pl, idx) => {
                  const isPlaying = pl.status === 'playing'
                  const isStarting = startingId === pl.id
                  const isStopping = stoppingId === pl.id
                  const si = (pl as any).stream_info

                  return (
                    <tr
                      key={pl.id}
                      className={`border-b border-slate-100 transition hover:bg-slate-50 ${idx === playlists.length - 1 ? 'border-b-0' : ''}`}
                    >
                      {/* ID */}
                      <td className="px-3 py-3">
                        <span className="text-xs font-mono font-medium text-slate-500">{pl.id}</span>
                      </td>

                      {/* ICON */}
                      <td className="px-2 py-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                          {pl.name.charAt(0).toUpperCase()}
                        </div>
                      </td>

                      {/* NAME */}
                      <td className="px-3 py-3 min-w-[160px]">
                        <div
                          className="cursor-pointer"
                          onClick={() => onSelect(pl)}
                        >
                          <div className="font-semibold text-slate-800 hover:text-blue-600 transition leading-tight">
                            {pl.name}
                          </div>
                          {pl.description && (
                            <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{pl.description}</div>
                          )}
                          {si?.profile_name && !pl.description && (
                            <div className="text-xs text-slate-400 mt-0.5">{si.profile_name}</div>
                          )}
                        </div>
                      </td>

                      {/* SOURCE */}
                      <td className="px-3 py-3 max-w-[160px]">
                        {pl.stream_url ? (
                          <span className="text-xs text-slate-500 font-mono truncate block max-w-[150px]" title={pl.stream_url}>
                            {pl.stream_url.replace('http://', '').slice(0, 30)}…
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Ana Sunucu</span>
                        )}
                      </td>

                      {/* CLIENTS */}
                      <td className="px-3 py-3">
                        <span className="text-xs font-mono text-slate-600">0</span>
                      </td>

                      {/* UPTIME */}
                      <td className="px-3 py-3">
                        {isPlaying ? (
                          <UptimeBadge startedAt={pl.started_at ?? null} />
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Durmus
                          </span>
                        )}
                      </td>

                      {/* ACTIONS */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          {/* Stop */}
                          <button
                            onClick={() => onStop(pl.id)}
                            disabled={!isPlaying || isStopping}
                            title="Durdur"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            <Square size={12} fill="currentColor" />
                          </button>
                          {/* Start */}
                          <button
                            onClick={() => onStart(pl.id)}
                            disabled={isPlaying || isStarting || pl.item_count === 0}
                            title={pl.item_count === 0 ? 'Once video ekleyin' : 'Baslat'}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            {isStarting ? (
                              <RefreshCw size={11} className="animate-spin" />
                            ) : (
                              <Play size={12} fill="currentColor" />
                            )}
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => onSelect(pl)}
                            title="Duzenle"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                          >
                            <Pencil size={12} />
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => onDelete(pl.id)}
                            title="Sil"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-500 hover:bg-rose-200 transition"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </td>

                      {/* PLAYER */}
                      <td className="px-3 py-3">
                        <button
                          onClick={() => pl.stream_url && setPlayerUrl(pl.stream_url)}
                          disabled={!isPlaying || !pl.stream_url}
                          title={isPlaying && pl.stream_url ? 'Stream URL goster' : 'Yayin aktif degil'}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                        >
                          <Play size={12} fill="currentColor" />
                        </button>
                      </td>

                      {/* EPG */}
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setEpgPlaylist(pl)}
                          title="EPG"
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition"
                        >
                          <Calendar size={12} />
                        </button>
                      </td>

                      {/* STREAM INFO */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                          <StreamInfoBadges info={si} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Playlist Detail View (WMP Style) ──────────────────────────────────────────

function PlaylistDetailView({
  playlist,
  onBack,
  onToast,
}: {
  playlist: Playlist
  onBack: () => void
  onToast: (msg: string, type: 'ok' | 'err') => void
}) {
  const queryClient = useQueryClient()
  const [pendingItems, setPendingItems] = useState<PlaylistItem[]>(playlist.items)
  const [dirty, setDirty] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showEpg, setShowEpg] = useState(false)
  const [showAddVideos, setShowAddVideos] = useState(false)
  const [liveElapsed, setLiveElapsed] = useState(0)

  const [lastPlaylistId, setLastPlaylistId] = useState(playlist.id)
  if (playlist.id !== lastPlaylistId) {
    setLastPlaylistId(playlist.id)
    setPendingItems(playlist.items)
    setDirty(false)
  }

  const serversQ = useQuery({
    queryKey: ['servers'],
    queryFn: () => serversApi.list(),
  })

  const playlistQ = useQuery({
    queryKey: ['playlist', playlist.id],
    queryFn: () => playlistApi.get(playlist.id),
    initialData: playlist,
    refetchInterval: 10000,
  })

  const currentPlaylist = playlistQ.data ?? playlist
  const isPlaying = currentPlaylist.status === 'playing'

  // Live elapsed counter - updates every second
  useEffect(() => {
    if (!isPlaying || !currentPlaylist.started_at) {
      setLiveElapsed(0)
      return
    }
    const startedAt = new Date(currentPlaylist.started_at).getTime()
    const update = () => setLiveElapsed(Math.floor((Date.now() - startedAt) / 1000))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [isPlaying, currentPlaylist.started_at])

  // Compute current item and progress from live elapsed
  const sortedItems = [...pendingItems].sort((a, b) => a.position - b.position)
  const totalDur = currentPlaylist.total_duration_seconds || sortedItems.reduce((s, i) => s + i.duration_seconds, 0) || 1
  const loopPos = isPlaying ? liveElapsed % totalDur : 0

  let cumulative = 0
  let currentIdx = 0
  let progressInItem = 0
  for (let i = 0; i < sortedItems.length; i++) {
    const dur = sortedItems[i].duration_seconds || 1
    cumulative += dur
    if (loopPos < cumulative) {
      currentIdx = i
      const prevCumulative = cumulative - dur
      progressInItem = (loopPos - prevCumulative) / dur
      break
    }
  }

  const currentItem = isPlaying && sortedItems.length > 0 ? sortedItems[currentIdx] : null
  const nextItem = isPlaying && sortedItems.length > 1 ? sortedItems[(currentIdx + 1) % sortedItems.length] : null

  // Mutations
  const updateMut = useMutation({
    mutationFn: (payload: { server_id?: number | null }) => playlistApi.update(playlist.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', playlist.id] })
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      onToast('Guncellendi', 'ok')
    },
    onError: (e: any) => onToast(e?.response?.data?.detail ?? 'Hata', 'err'),
  })

  const startMut = useMutation({
    mutationFn: () => playlistApi.startBroadcast(playlist.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', playlist.id] })
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      onToast('Yayin baslatildi', 'ok')
    },
    onError: (e: any) => onToast(e?.response?.data?.detail ?? 'Baslatma hatasi', 'err'),
  })

  const stopMut = useMutation({
    mutationFn: () => playlistApi.stopBroadcast(playlist.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', playlist.id] })
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      onToast('Yayin durduruldu', 'ok')
    },
    onError: (e: any) => onToast(e?.response?.data?.detail ?? 'Durdurma hatasi', 'err'),
  })

  const updateListMut = useMutation({
    mutationFn: () => playlistApi.updateBroadcastList(playlist.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', playlist.id] })
      onToast('Liste guncellendi', 'ok')
    },
    onError: (e: any) => onToast(e?.response?.data?.detail ?? 'Hata', 'err'),
  })

  const removeItemMut = useMutation({
    mutationFn: (itemId: number) => playlistApi.removeItem(playlist.id, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlist', playlist.id] })
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      setDirty(false)
      onToast('Video kaldirildi', 'ok')
    },
    onError: (e: any) => onToast(e?.response?.data?.detail ?? 'Kaldirilamadi', 'err'),
  })

  // Sync pendingItems when fresh server data arrives
  const [lastItemsKey, setLastItemsKey] = useState(JSON.stringify(currentPlaylist.items.map(i => i.id)))
  const currentKey = JSON.stringify(currentPlaylist.items.map(i => i.id))
  if (!dirty && currentKey !== lastItemsKey) {
    setLastItemsKey(currentKey)
    setPendingItems(currentPlaylist.items)
  }

  function moveItem(idx: number, dir: -1 | 1) {
    const newItems = [...pendingItems]
    const target = idx + dir
    if (target < 0 || target >= newItems.length) return
    ;[newItems[idx], newItems[target]] = [newItems[target], newItems[idx]]
    setPendingItems(newItems)
    setDirty(true)
  }

  async function saveOrder() {
    setSavingOrder(true)
    try {
      const updated = await playlistApi.reorder(playlist.id, pendingItems.map(i => i.id))
      queryClient.setQueryData(['playlist', playlist.id], updated)
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      setPendingItems(updated.items)
      setDirty(false)
      onToast('Sira guncellendi', 'ok')
    } catch {
      onToast('Sira kaydedilemedi', 'err')
    } finally {
      setSavingOrder(false)
    }
  }

  function copyStreamUrl() {
    const url = currentPlaylist.stream_url
    if (!url) return
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const servers = serversQ.data ?? []
  const streamUrl = currentPlaylist.stream_url ?? null
  const totalSeconds = pendingItems.reduce((s, i) => s + i.duration_seconds, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Modals */}
      {showEpg && (
        <EpgModal
          playlistId={playlist.id}
          playlistName={currentPlaylist.name}
          onClose={() => setShowEpg(false)}
        />
      )}
      {showAddVideos && (
        <AddVideosModal
          playlistId={playlist.id}
          onClose={() => setShowAddVideos(false)}
          onToast={onToast}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
        >
          <ChevronLeft size={16} />
          Geri
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800 truncate">{currentPlaylist.name}</h1>
          {isPlaying && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white animate-pulse shrink-0">
              <Radio size={10} />
              CANLI
            </span>
          )}
          {!isPlaying && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 shrink-0">
              Durmus
            </span>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
            <Film size={12} />
            Toplam Video
          </div>
          <div className="text-2xl font-bold text-slate-800">{currentPlaylist.item_count}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
            <Clock size={12} />
            Toplam Sure
          </div>
          <div className="text-xl font-bold text-slate-800 font-mono">{formatDurationLong(currentPlaylist.total_duration_seconds)}</div>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm ${isPlaying ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
            <Play size={12} />
            Su An Oynayan
          </div>
          <div className="truncate text-sm font-bold text-slate-800" title={currentItem?.tmdb_title || currentItem?.title}>
            {isPlaying ? (currentItem?.tmdb_title || currentItem?.title || 'Hesaplaniyor...') : '—'}
          </div>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm ${isPlaying ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
            <Timer size={12} />
            Ne Zamandir Calisiyor
          </div>
          <div className="text-xl font-bold text-slate-800 font-mono">
            {isPlaying ? formatDurationLong(liveElapsed) : '—'}
          </div>
        </div>
      </div>

      {/* Main 2-column WMP layout */}
      <div className="flex gap-4" style={{ minHeight: '520px' }}>

        {/* LEFT: Light Playlist Panel */}
        <div className="w-[400px] shrink-0 rounded-2xl border border-slate-200 bg-white flex flex-col overflow-hidden shadow-sm">
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <ListVideo size={15} className="text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Playlist</span>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">{pendingItems.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {dirty && !isPlaying && (
                <button
                  onClick={saveOrder}
                  disabled={savingOrder}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
                >
                  <RefreshCw size={10} className={savingOrder ? 'animate-spin' : ''} />
                  Kaydet
                </button>
              )}
              {isPlaying && (
                <button
                  onClick={() => updateListMut.mutate()}
                  disabled={updateListMut.isPending}
                  className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60 transition"
                >
                  <RefreshCw size={10} className={updateListMut.isPending ? 'animate-spin' : ''} />
                  Guncelle
                </button>
              )}
              <button
                onClick={() => setShowAddVideos(true)}
                className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
              >
                <Plus size={11} />
                Video Ekle
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto">
            {pendingItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400">
                <ListVideo size={36} className="mb-3 opacity-30" />
                <p className="text-sm">Playlist bos</p>
                <button
                  onClick={() => setShowAddVideos(true)}
                  className="mt-4 flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
                >
                  <Plus size={12} />
                  Video Ekle
                </button>
              </div>
            ) : (
              <div>
                {pendingItems.map((item, idx) => {
                  const isCurrent = isPlaying && currentIdx === idx
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 transition ${
                        isCurrent
                          ? 'bg-emerald-50 border-l-[3px] border-l-emerald-500'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Index / play indicator */}
                      <span className={`w-5 shrink-0 text-center text-xs font-mono ${isCurrent ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {isCurrent ? '▶' : idx + 1}
                      </span>

                      {/* Small poster */}
                      {item.tmdb_poster_url ? (
                        <img
                          src={item.tmdb_poster_url}
                          alt={item.title}
                          className="h-[54px] w-[36px] rounded-md object-cover shrink-0 shadow-sm"
                          onError={(e) => {
                            const el = e.target as HTMLImageElement
                            el.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="h-[54px] w-[36px] rounded-md bg-slate-100 shrink-0 flex items-center justify-center">
                          <Film size={14} className="text-slate-400" />
                        </div>
                      )}

                      {/* Title + duration + progress */}
                      <div className="min-w-0 flex-1">
                        <div className={`truncate text-xs font-medium leading-snug ${isCurrent ? 'text-emerald-700' : 'text-slate-700'}`}>
                          {item.tmdb_title || item.title}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {formatDuration(item.duration_seconds)}
                        </div>
                        {isCurrent && (
                          <div className="mt-1.5 h-0.5 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                              style={{ width: `${Math.min(progressInItem * 100, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => moveItem(idx, -1)}
                          disabled={idx === 0 || isPlaying}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-20 transition"
                          title="Yukari"
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          onClick={() => moveItem(idx, 1)}
                          disabled={idx === pendingItems.length - 1 || isPlaying}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-20 transition"
                          title="Asagi"
                        >
                          <ArrowDown size={11} />
                        </button>
                        <button
                          onClick={() => removeItemMut.mutate(item.id)}
                          disabled={isPlaying}
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-20 transition"
                          title="Kaldir"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-4 py-2.5 flex items-center justify-between bg-slate-50">
            <span className="text-xs text-slate-500">{pendingItems.length} video</span>
            <span className="text-xs font-mono text-slate-500">{formatDurationLong(totalSeconds)}</span>
          </div>
        </div>

        {/* RIGHT: Now Playing + Controls */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Now Playing Card */}
          <div className="flex-1 rounded-2xl bg-white border border-slate-200 shadow-sm p-5 overflow-hidden">
            {isPlaying && currentItem ? (
              <div className="flex gap-5 h-full">
                {/* Poster */}
                <div className="shrink-0">
                  {currentItem.tmdb_poster_url ? (
                    <img
                      src={currentItem.tmdb_poster_url}
                      alt={currentItem.title}
                      className="rounded-xl object-cover shadow-lg"
                      style={{ height: '270px', width: '180px' }}
                      onError={(e) => {
                        const el = e.target as HTMLImageElement
                        el.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="rounded-xl bg-slate-100 flex items-center justify-center shadow-inner" style={{ height: '270px', width: '180px' }}>
                      <Film size={48} className="text-slate-300" />
                    </div>
                  )}
                </div>


                {/* Info */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-bold text-white">
                      <Radio size={10} />
                      OYNUYOR
                    </span>
                    <span className="text-xs text-slate-400">#{currentIdx + 1} / {sortedItems.length}</span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900 leading-snug mb-1">
                    {currentItem.tmdb_title || currentItem.title}
                  </h2>

                  {currentItem.title !== currentItem.tmdb_title && currentItem.tmdb_title && (
                    <p className="text-xs text-slate-400 mb-2">{currentItem.title}</p>
                  )}

                  {currentItem.tmdb_overview && (
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-4">
                      {currentItem.tmdb_overview}
                    </p>
                  )}

                  {/* Progress bar */}
                  <div className="mt-auto">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-mono">{formatDuration(Math.floor(progressInItem * (currentItem.duration_seconds || 0)))}</span>
                      <span className="font-mono">{formatDuration(currentItem.duration_seconds)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(progressInItem * 100, 100)}%` }}
                      />
                    </div>

                    {nextItem && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                        <span>Siradaki:</span>
                        {nextItem.tmdb_poster_url && (
                          <img
                            src={nextItem.tmdb_poster_url}
                            alt={nextItem.title}
                            className="h-5 w-3 rounded object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        )}
                        <span className="text-slate-600 font-medium truncate">{nextItem.tmdb_title || nextItem.title}</span>
                        <span className="font-mono shrink-0">{formatDuration(nextItem.duration_seconds)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : isPlaying ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <div className="h-20 w-20 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4 shadow-inner">
                  <Radio size={32} className="text-emerald-400 animate-pulse" />
                </div>
                <p className="text-sm font-semibold text-emerald-600">Yayin Aktif</p>
                <p className="text-xs text-slate-400 mt-1">Oynatma listesi yukleniyor...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <div className="h-20 w-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 shadow-inner">
                  <Play size={32} className="text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-400">Yayin Durdurulmus</p>
                <p className="text-xs text-slate-400 mt-1">Yayini baslatmak icin asagidaki butonu kullanin</p>
              </div>
            )}
          </div>

          {/* Controls Panel */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
            <div className="flex flex-wrap items-end gap-3">
              {/* Server Select */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Sunucu</label>
                <select
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                  value={currentPlaylist.server_id ?? ''}
                  disabled={isPlaying}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : Number(e.target.value)
                    updateMut.mutate({ server_id: val })
                  }}
                >
                  <option value="">Ana Sunucu (lokal)</option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.ip_address})</option>
                  ))}
                </select>
              </div>

              {/* Play / Stop */}
              {!isPlaying ? (
                <button
                  onClick={() => startMut.mutate()}
                  disabled={startMut.isPending || currentPlaylist.item_count === 0}
                  className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
                  title={currentPlaylist.item_count === 0 ? 'Once video ekleyin' : undefined}
                >
                  <Play size={15} fill="currentColor" />
                  {startMut.isPending ? 'Baslatiliyor...' : 'Yayini Baslat'}
                </button>
              ) : (
                <button
                  onClick={() => stopMut.mutate()}
                  disabled={stopMut.isPending}
                  className="flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-60 transition"
                >
                  <Square size={15} fill="currentColor" />
                  {stopMut.isPending ? 'Durduruluyor...' : 'Yayini Durdur'}
                </button>
              )}

              {/* EPG */}
              <button
                onClick={() => setShowEpg(true)}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                <Calendar size={14} />
                EPG Goruntule
              </button>

              <a
                href={`/api/v1/playlists/${playlist.id}/epg.xml`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                <Download size={14} />
                EPG Indir
              </a>

              {/* Stream URL copy */}
              {streamUrl && (
                <button
                  onClick={copyStreamUrl}
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition"
                >
                  <Copy size={14} />
                  {copied ? 'Kopyalandi!' : 'Stream URL'}
                </button>
              )}
            </div>

            {/* Stream URL banner */}
            {isPlaying && streamUrl && (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5">
                <Radio size={14} className="shrink-0 text-emerald-600" />
                <code className="flex-1 min-w-0 text-xs text-slate-700 truncate">{streamUrl}</code>
                <button
                  onClick={copyStreamUrl}
                  className="shrink-0 text-xs text-blue-600 hover:text-blue-800 transition font-medium"
                >
                  {copied ? 'Kopyalandi!' : 'Kopyala'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PlaylistPage() {
  const queryClient = useQueryClient()
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const playlistsQ = useQuery({
    queryKey: ['playlists'],
    queryFn: () => playlistApi.list(),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => playlistApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      if (selectedPlaylist && confirmDeleteId === selectedPlaylist.id) {
        setSelectedPlaylist(null)
      }
      setConfirmDeleteId(null)
      showToast('Playlist silindi')
    },
    onError: () => {
      setConfirmDeleteId(null)
      showToast('Silinemedi', 'err')
    },
  })

  const startMut = useMutation({
    mutationFn: (id: number) => playlistApi.startBroadcast(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      showToast('Yayin baslatildi')
    },
    onError: (e: any) => showToast(e?.response?.data?.detail ?? 'Baslatma hatasi', 'err'),
  })

  const stopMut = useMutation({
    mutationFn: (id: number) => playlistApi.stopBroadcast(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      showToast('Yayin durduruldu')
    },
    onError: (e: any) => showToast(e?.response?.data?.detail ?? 'Durdurma hatasi', 'err'),
  })

  const playlists = playlistsQ.data ?? []

  const freshSelected = selectedPlaylist
    ? (playlists.find((p) => p.id === selectedPlaylist.id) ?? null)
    : null

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {confirmDeleteId !== null && (
        <ConfirmDialog
          title="Playlist Sil"
          message="Bu playlist ve icindeki video listesi silinecek. Videolar kategorilere geri donecek. Emin misiniz?"
          onConfirm={() => deleteMut.mutate(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {showCreate && (
        <CreatePlaylistModal
          onClose={() => setShowCreate(false)}
          onCreated={(pl) => {
            queryClient.invalidateQueries({ queryKey: ['playlists'] })
            setShowCreate(false)
            setSelectedPlaylist(pl)
            showToast('Playlist olusturuldu')
          }}
        />
      )}

      {freshSelected ? (
        <PlaylistDetailView
          playlist={freshSelected}
          onBack={() => setSelectedPlaylist(null)}
          onToast={showToast}
        />
      ) : (
        <PlaylistListView
          playlists={playlists}
          loading={playlistsQ.isLoading}
          onSelect={setSelectedPlaylist}
          onCreate={() => setShowCreate(true)}
          onDelete={(id) => setConfirmDeleteId(id)}
          onStart={(id) => startMut.mutate(id)}
          onStop={(id) => stopMut.mutate(id)}
          startingId={startMut.isPending ? (startMut.variables as number) : null}
          stoppingId={stopMut.isPending ? (stopMut.variables as number) : null}
        />
      )}
    </>
  )
}
