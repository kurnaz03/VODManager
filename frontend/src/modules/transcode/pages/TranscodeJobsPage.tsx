import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Play,
  Square,
  Trash2,
  Eye,
  ListChecks,
  Eraser,
  Film,
  X,
  Loader2,
} from 'lucide-react'
import { contentApi, Category, moviesApi, MovieContent } from '../../content/services/contentApi'
import { transcodeApi, TranscodeProfile } from '../services/transcodeApi'
import { serversApi, Server } from '../../servers/services/serversApi'
import { transcodeJobApi, TranscodeJob, TranscodeJobCreate } from '../services/transcodeJobApi'

// ── Constants ────────────────────────────────────────────────────────────────

const TEXT_POSITIONS = [
  { value: 'top-left', label: 'Sol Ust' },
  { value: 'top-right', label: 'Sag Ust' },
  { value: 'bottom-left', label: 'Sol Alt' },
  { value: 'bottom-right', label: 'Sag Alt' },
  { value: 'center', label: 'Orta' },
  { value: 'center-bottom', label: 'Orta Alt' },
  { value: 'center-top', label: 'Orta Ust' },
]

const COUNTDOWN_POSITIONS = [
  { value: 'top-left', label: 'Sol Ust' },
  { value: 'top-right', label: 'Sag Ust' },
  { value: 'bottom-left', label: 'Sol Alt' },
  { value: 'bottom-right', label: 'Sag Alt' },
]

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  queued: 'Kuyrukta',
  previewing: 'Onizleme',
  transcoding: 'Transcode Ediliyor',
  completed: 'Tamamlandi',
  failed: 'Basarisiz',
  cancelled: 'Durduruldu',
  paused: 'Duraklatildi',
}

const STATUS_CLASSES: Record<string, string> = {
  queued: 'bg-slate-100 text-slate-600',
  previewing: 'bg-purple-100 text-purple-700 animate-pulse',
  transcoding: 'bg-blue-100 text-blue-700 animate-pulse',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-amber-100 text-amber-700',
  paused: 'bg-orange-100 text-orange-700',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEta(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
            Onayla
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Preview Modal ─────────────────────────────────────────────────────────────

function PreviewModal({ jobId, onClose }: { jobId: number; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    transcodeJobApi.previewFileBlob(jobId)
      .then((url) => {
        objectUrl = url
        setBlobUrl(url)
        setLoading(false)
      })
      .catch(() => {
        setError('Onizleme dosyasi yuklenemedi')
        setLoading(false)
      })
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [jobId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900 p-4 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20 transition"
        >
          <X size={16} />
        </button>
        <p className="mb-3 text-sm text-slate-400">10 Saniye Onizleme</p>
        {loading && (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            <span className="text-sm">Yukleniyor...</span>
          </div>
        )}
        {error && <div className="py-8 text-center text-sm text-rose-400">{error}</div>}
        {blobUrl && (
          <video
            src={blobUrl}
            controls
            autoPlay
            className="w-full rounded-xl"
            style={{ maxHeight: '70vh' }}
          />
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TranscodeJobsPage() {
  const queryClient = useQueryClient()

  // Form state
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('')
  const [selectedMovieId, setSelectedMovieId] = useState<number | ''>('')
  const [selectedProfileId, setSelectedProfileId] = useState<number | ''>('')
  const [selectedServerId, setSelectedServerId] = useState<number | ''>('')
  const [overlayText, setOverlayText] = useState('')
  const [textPosition, setTextPosition] = useState('bottom-right')
  const [textSize, setTextSize] = useState(24)
  const [textColor, setTextColor] = useState('#FFFFFF')
  const [textBgEnabled, setTextBgEnabled] = useState(false)
  const [textBgColor, setTextBgColor] = useState('#000000')
  const [countdownEnabled, setCountdownEnabled] = useState(false)
  const [countdownPosition, setCountdownPosition] = useState('top-right')

  // UI state
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [previewJobId, setPreviewJobId] = useState<number | null>(null)
  const [pendingPreviewId, setPendingPreviewId] = useState<number | null>(null)
  const [seenPreviewing, setSeenPreviewing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  const categoriesQ = useQuery({
    queryKey: ['categories', 'movies'],
    queryFn: () => contentApi.listCategories('movies'),
  })

  const moviesQ = useQuery({
    queryKey: ['movies', selectedCategoryId],
    queryFn: () => moviesApi.list(selectedCategoryId !== '' ? selectedCategoryId : undefined),
    enabled: true,
  })

  const profilesQ = useQuery({
    queryKey: ['transcode-profiles'],
    queryFn: () => transcodeApi.list(),
  })

  const serversQ = useQuery({
    queryKey: ['servers'],
    queryFn: () => serversApi.list(),
  })

  const jobsQ = useQuery({
    queryKey: ['transcode-jobs'],
    queryFn: () => transcodeJobApi.list(),
    refetchInterval: 3000,
  })

  // ── Derived ──────────────────────────────────────────────────────────────

  const categories: Category[] = categoriesQ.data ?? []
  const allMovies: MovieContent[] = moviesQ.data ?? []
  const filteredMovies = selectedCategoryId !== ''
    ? allMovies.filter((m) => m.category_id === selectedCategoryId)
    : allMovies
  const profiles: TranscodeProfile[] = profilesQ.data ?? []
  const servers: Server[] = serversQ.data ?? []
  const jobs: TranscodeJob[] = jobsQ.data ?? []

  const selectedMovie = filteredMovies.find((m) => m.id === selectedMovieId) ?? null

  // ── Preview polling ───────────────────────────────────────────────────────
  // After triggering preview, watch job status: "previewing" → "queued" means done

  useEffect(() => {
    if (pendingPreviewId === null) return
    const job = jobs.find((j) => j.id === pendingPreviewId)
    if (!job) return

    if (job.status === 'previewing') {
      setSeenPreviewing(true)
    } else if (job.status !== 'previewing' && seenPreviewing) {
      // Preview task finished (success or failure)
      setPendingPreviewId(null)
      setSeenPreviewing(false)
      if (job.error_message && job.error_message.startsWith('Onizleme hatasi')) {
        showToast(job.error_message.slice(0, 120), 'err')
      } else {
        setPreviewJobId(pendingPreviewId)
      }
    }
  }, [jobs, pendingPreviewId, seenPreviewing])

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMut = useMutation({
    mutationFn: (payload: TranscodeJobCreate) => transcodeJobApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] })
      showToast('Job kuyruga eklendi')
    },
    onError: (e: any) => showToast(e?.response?.data?.detail ?? 'Hata', 'err'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => transcodeJobApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] })
      showToast('Job silindi')
    },
    onError: (e: any) => showToast(e?.response?.data?.detail ?? 'Silinemedi', 'err'),
  })

  const startMut = useMutation({
    mutationFn: (id: number) => transcodeJobApi.start(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] })
      showToast('Basladi')
    },
    onError: (e: any) => showToast(e?.response?.data?.detail ?? 'Baslanamadi', 'err'),
  })

  const stopMut = useMutation({
    mutationFn: (id: number) => transcodeJobApi.stop(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] })
      showToast('Durduruldu')
    },
    onError: (e: any) => showToast(e?.response?.data?.detail ?? 'Durdurulamadi', 'err'),
  })

  const startQueueMut = useMutation({
    mutationFn: () => transcodeJobApi.startQueue(),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] })
      showToast(r.started ? 'Kuyruk baslatildi' : (r.message ?? 'Bos kuyruk'))
    },
    onError: (e: any) => showToast(e?.response?.data?.detail ?? 'Hata', 'err'),
  })

  const clearMut = useMutation({
    mutationFn: () => transcodeJobApi.clear(),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] })
      showToast(`${r.cleared} job temizlendi`)
      setConfirmClear(false)
    },
    onError: (e: any) => showToast(e?.response?.data?.detail ?? 'Hata', 'err'),
  })

  const previewMut = useMutation({
    mutationFn: (id: number) => transcodeJobApi.preview(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] })
      showToast('Onizleme olusturuluyor...')
      setPendingPreviewId(id)
      setSeenPreviewing(false)
    },
    onError: (e: any) => showToast(e?.response?.data?.detail ?? 'Onizleme hatasi', 'err'),
  })

  // ── Form submit ───────────────────────────────────────────────────────────

  function handleAddJob(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMovieId || !selectedProfileId) {
      showToast('Film ve profil seciniz', 'err')
      return
    }
    const payload: TranscodeJobCreate = {
      movie_content_id: selectedMovieId as number,
      transcode_profile_id: selectedProfileId as number,
      server_id: selectedServerId !== '' ? (selectedServerId as number) : null,
      overlay_text: overlayText.trim() || null,
      text_position: textPosition,
      text_size: textSize,
      text_color: textColor,
      text_bg_enabled: textBgEnabled,
      text_bg_color: textBgColor,
      countdown_enabled: countdownEnabled,
      countdown_position: countdownPosition,
    }
    createMut.mutate(payload)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl px-5 py-3 text-sm font-medium shadow-xl transition ${
            toast.type === 'ok'
              ? 'bg-emerald-500 text-white'
              : 'bg-rose-500 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Confirm dialogs */}
      {confirmDelete !== null && (
        <ConfirmDialog
          title="Job Sil"
          message="Bu transcode jobunu silmek istediginizden emin misiniz?"
          onConfirm={() => {
            deleteMut.mutate(confirmDelete)
            setConfirmDelete(null)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {confirmClear && (
        <ConfirmDialog
          title="Kuyrugu Temizle"
          message="Tamamlanmis ve basarisiz tum joblar silinecek. Emin misiniz?"
          onConfirm={() => clearMut.mutate()}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {/* Preview modal */}
      {previewJobId !== null && (
        <PreviewModal jobId={previewJobId} onClose={() => setPreviewJobId(null)} />
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Transcode Kuyrugu</h1>
        <p className="mt-1 text-sm text-slate-500">FFmpeg ile video transcode islemlerini yonetin</p>
      </div>

      {/* ── 2-Column Layout ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* ── LEFT: Add Job Form ── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-base font-semibold text-slate-700">Yeni Job Ekle</h2>
          <form onSubmit={handleAddJob} className="space-y-5">
            {/* Row 1: Video selection */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Category */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Kategori</label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  value={selectedCategoryId}
                  onChange={(e) => {
                    setSelectedCategoryId(e.target.value === '' ? '' : Number(e.target.value))
                    setSelectedMovieId('')
                  }}
                >
                  <option value="">-- Tum Kategoriler --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {/* Movie */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Film Sec *</label>
                <select
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  value={selectedMovieId}
                  onChange={(e) => setSelectedMovieId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">-- Film Seciniz --</option>
                  {filteredMovies.map((m) => (
                    <option key={m.id} value={m.id} disabled={!m.file_path}>
                      {m.title}{!m.file_path ? ' (dosya yok)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* File path preview */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Dosya Yolu</label>
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-xs text-slate-500 min-h-[38px] break-all">
                {selectedMovie?.file_path ?? <span className="italic">Film secilmedi</span>}
              </div>
            </div>

            {/* Row 2: Profile & Server */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Transcode Profili *</label>
                <select
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">-- Profil Seciniz --</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Sunucu</label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  value={selectedServerId}
                  onChange={(e) => setSelectedServerId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">Lokal Sunucu</option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.ip_address})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Overlay Text */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Yazi Overlay</p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Yazi (bos birakilabilir)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                      placeholder="Ornek: Ozel Kanal HD"
                      value={overlayText}
                      onChange={(e) => setOverlayText(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => { if (selectedMovie) setOverlayText(selectedMovie.title) }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition whitespace-nowrap"
                      title="Film basligini kullan"
                    >
                      <Film size={14} className="inline mr-1" />
                      Film Basligi
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Pozisyon</label>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                      value={textPosition}
                      onChange={(e) => setTextPosition(e.target.value)}
                    >
                      {TEXT_POSITIONS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Yazi Boyutu (px)</label>
                    <input
                      type="number"
                      min={6}
                      max={200}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                      value={textSize}
                      onChange={(e) => setTextSize(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Yazi Rengi</label>
                    <input
                      type="color"
                      className="h-9 w-16 cursor-pointer rounded-xl border border-slate-200"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Arka Plan</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTextBgEnabled((v) => !v)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${textBgEnabled ? 'bg-blue-500' : 'bg-slate-200'}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${textBgEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                      </button>
                      {textBgEnabled && (
                        <input
                          type="color"
                          className="h-9 w-16 cursor-pointer rounded-xl border border-slate-200"
                          value={textBgColor}
                          onChange={(e) => setTextBgColor(e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 4: Countdown */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Kalan Sure Sayaci (HH:MM:SS)</p>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCountdownEnabled((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${countdownEnabled ? 'bg-blue-500' : 'bg-slate-200'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${countdownEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                  <span className="text-sm text-slate-600">
                    {countdownEnabled ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                {countdownEnabled && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Pozisyon</label>
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                      value={countdownPosition}
                      onChange={(e) => setCountdownPosition(e.target.value)}
                    >
                      {COUNTDOWN_POSITIONS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={createMut.isPending}
                className="rounded-2xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
              >
                {createMut.isPending ? 'Ekleniyor...' : 'Kuyruga Ekle'}
              </button>
            </div>
          </form>
        </div>

        {/* ── RIGHT: Queue List ── */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm flex flex-col">
          {/* Queue header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 flex-shrink-0">
            <h2 className="text-base font-semibold text-slate-700">
              Transcode Kuyrugu
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
                {jobs.length}
              </span>
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => startQueueMut.mutate()}
                disabled={startQueueMut.isPending}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
              >
                <ListChecks size={13} />
                Kuyrugu Baslat
              </button>
              <button
                onClick={() => setConfirmClear(true)}
                disabled={clearMut.isPending}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 transition"
              >
                <Eraser size={13} />
                Temizle
              </button>
            </div>
          </div>

          {/* Table */}
          {jobsQ.isLoading ? (
            <div className="p-10 text-center text-sm text-slate-400">Yukleniyor...</div>
          ) : jobs.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">Kuyrukta job yok.</div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Video</th>
                    <th className="px-4 py-3">Profil</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3 min-w-[120px]">Ilerleme</th>
                    <th className="px-4 py-3 whitespace-nowrap">Kalan Sure</th>
                    <th className="px-4 py-3 text-right">Aksiyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {jobs.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      onStart={() => startMut.mutate(job.id)}
                      onStop={() => stopMut.mutate(job.id)}
                      onDelete={() => setConfirmDelete(job.id)}
                      onPreview={() => previewMut.mutate(job.id)}
                      onShowPreview={() => setPreviewJobId(job.id)}
                      previewPending={pendingPreviewId === job.id}
                      previewLoading={previewMut.isPending && previewMut.variables === job.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Job Row ───────────────────────────────────────────────────────────────────

function JobRow({
  job,
  onStart,
  onStop,
  onDelete,
  onPreview,
  onShowPreview,
  previewPending,
  previewLoading,
}: {
  job: TranscodeJob
  onStart: () => void
  onStop: () => void
  onDelete: () => void
  onPreview: () => void
  onShowPreview: () => void
  previewPending: boolean
  previewLoading: boolean
}) {
  const canStart = job.status === 'queued' || job.status === 'paused' || job.status === 'failed'
  const canStop = job.status === 'transcoding'
  const canPreview = (job.status === 'queued' || job.status === 'paused' || job.status === 'failed') && !previewPending

  return (
    <tr className="hover:bg-slate-50/60 transition">
      <td className="px-4 py-3 text-xs text-slate-400 font-mono">
        {String(job.unique_number).padStart(5, '0')}
      </td>
      <td className="px-4 py-3 max-w-[160px]">
        <div className="font-medium text-slate-700 truncate text-xs">{job.movie_title ?? '—'}</div>
        {job.server_name && (
          <div className="mt-0.5 text-xs text-slate-400 truncate">{job.server_name}</div>
        )}
        {job.overlay_text && (
          <div className="mt-0.5 text-xs text-slate-400 truncate italic">"{job.overlay_text}"</div>
        )}
      </td>
      <td className="px-4 py-3 text-slate-600 text-xs truncate max-w-[80px]">{job.profile_name ?? '—'}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_CLASSES[job.status] ?? 'bg-slate-100 text-slate-600'}`}>
          {STATUS_LABELS[job.status] ?? job.status}
        </span>
        {job.error_message && !job.error_message.startsWith('Onizleme hatasi') && (
          <div className="mt-1 max-w-[120px] truncate text-xs text-rose-500" title={job.error_message}>
            {job.error_message.slice(0, 50)}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="relative h-2 flex-1 rounded-full bg-slate-100 overflow-hidden min-w-[60px]">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                job.status === 'completed' ? 'bg-emerald-400' :
                job.status === 'failed' ? 'bg-rose-400' :
                job.status === 'transcoding' ? 'bg-blue-500' : 'bg-slate-300'
              }`}
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <span className="w-9 text-right text-xs text-slate-500">
            {job.progress.toFixed(0)}%
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">
        {job.status === 'transcoding' ? formatEta(job.eta_seconds) : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {/* Preview (create) */}
          {canPreview && (
            <button
              onClick={onPreview}
              disabled={previewLoading}
              title="10sn onizleme olustur"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-purple-50 hover:text-purple-600 disabled:opacity-50 transition"
            >
              <Eye size={14} />
            </button>
          )}
          {/* Preview pending indicator */}
          {previewPending && (
            <span title="Onizleme hazirlaniyor..." className="rounded-lg p-1.5 text-purple-500">
              <Loader2 size={14} className="animate-spin" />
            </span>
          )}
          {/* Show preview file */}
          {(job.status === 'queued' || job.status === 'paused') && !previewPending && (
            <button
              onClick={onShowPreview}
              title="Onizleme goster"
              className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 transition"
            >
              Goster
            </button>
          )}
          {/* Start */}
          {canStart && (
            <button
              onClick={onStart}
              title="Baslat"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition"
            >
              <Play size={14} />
            </button>
          )}
          {/* Stop */}
          {canStop && (
            <button
              onClick={onStop}
              title="Durdur"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition"
            >
              <Square size={14} />
            </button>
          )}
          {/* Delete */}
          <button
            onClick={onDelete}
            title="Sil"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
            disabled={job.status === 'transcoding'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}
