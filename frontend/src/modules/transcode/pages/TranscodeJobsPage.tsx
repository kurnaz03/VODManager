import { useEffect, useRef, useState } from 'react'
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
  ChevronDown,
  Terminal,
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

// Statuses that block a movie from appearing in the add-job dropdown
const ACTIVE_STATUSES = ['queued', 'transcoding', 'previewing', 'paused', 'completed']

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

// ── Log Modal ─────────────────────────────────────────────────────────────────

function LogModal({ jobId, jobStatus, onClose }: { jobId: number; jobStatus: string; onClose: () => void }) {
  const logsQ = useQuery({
    queryKey: ['transcode-job-logs', jobId],
    queryFn: () => transcodeJobApi.getLogs(jobId),
    refetchInterval: jobStatus === 'transcoding' ? 5000 : false,
  })

  const data = logsQ.data
  const hasError = data?.error_message && !data.error_message.startsWith('Onizleme hatasi')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900 shadow-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Terminal size={15} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-200">FFmpeg Log</span>
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
              Job #{jobId}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20 transition"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {logsQ.isLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
              <Loader2 size={16} className="animate-spin" />
              <span>Yukleniyor...</span>
            </div>
          )}

          {/* Error message block */}
          {hasError && (
            <div className="rounded-xl bg-rose-950/60 border border-rose-700/50 p-3">
              <p className="text-xs font-semibold text-rose-400 mb-1.5">Hata Mesaji</p>
              <pre className="text-xs text-rose-300 whitespace-pre-wrap break-all font-mono leading-relaxed">
                {data!.error_message}
              </pre>
            </div>
          )}

          {/* Log output block */}
          {data && (
            <div className="rounded-xl bg-slate-800 border border-slate-700 p-3">
              <p className="text-xs font-semibold text-slate-400 mb-1.5">
                FFmpeg Ciktisi
                {jobStatus === 'transcoding' && (
                  <span className="ml-2 text-blue-400 animate-pulse">• Canli</span>
                )}
              </p>
              {data.log_output ? (
                <pre className="text-xs text-slate-300 whitespace-pre-wrap break-all font-mono leading-relaxed">
                  {data.log_output}
                </pre>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  {jobStatus === 'queued' || jobStatus === 'pending'
                    ? 'Transcode henuz baslamadi.'
                    : 'Log ciktisi yok.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Clear Dropdown ─────────────────────────────────────────────────────────────

type ClearAction = 'completed' | 'failed' | 'queued' | 'selected'

function ClearDropdown({
  isPending,
  hasSelection,
  onSelect,
}: {
  isPending: boolean
  hasSelection: boolean
  onSelect: (action: ClearAction) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const items: { action: ClearAction; label: string; dot: string }[] = [
    { action: 'completed', label: 'Tamamlananlari Temizle', dot: 'bg-emerald-400' },
    { action: 'failed', label: 'Hata Verenleri Temizle', dot: 'bg-rose-400' },
    { action: 'queued', label: 'Bekleyenleri Temizle', dot: 'bg-slate-400' },
    { action: 'selected', label: 'Secilenleri Temizle', dot: 'bg-blue-500' },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 transition"
      >
        <Eraser size={13} />
        Temizle
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.action}
              disabled={item.action === 'selected' && !hasSelection}
              onClick={() => {
                setOpen(false)
                onSelect(item.action)
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${item.dot}`} />
              {item.label}
            </button>
          ))}
        </div>
      )}
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
  // Yazi kenar boslugu (padding)
  const [textPaddingTop, setTextPaddingTop] = useState(0)
  const [textPaddingBottom, setTextPaddingBottom] = useState(0)
  // Yazi fade in/out efekti
  const [textFadeEnabled, setTextFadeEnabled] = useState(false)
  // Interval dakika cinsinden gosterilir, backend'e saniye gonderilir
  const [textFadeIntervalMin, setTextFadeIntervalMin] = useState(10)
  const [textFadeDuration, setTextFadeDuration] = useState(20)
  const [textFadeInTime, setTextFadeInTime] = useState(3)
  const [textFadeOutTime, setTextFadeOutTime] = useState(3)
  const [countdownEnabled, setCountdownEnabled] = useState(false)
  const [countdownPosition, setCountdownPosition] = useState('top-right')

  // UI state
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [confirmClear, setConfirmClear] = useState<{ action: ClearAction; label: string } | null>(null)
  const [previewJobId, setPreviewJobId] = useState<number | null>(null)
  const [pendingPreviewId, setPendingPreviewId] = useState<number | null>(null)
  const [seenPreviewing, setSeenPreviewing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [logJobId, setLogJobId] = useState<number | null>(null)

  // Multi-select state
  const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set())

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  const categoriesQ = useQuery({
    queryKey: ['categories', 'movies', 'all'],
    queryFn: () => contentApi.listCategories('movies', true),
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

  // Ozellik 3: Kuyrukta/aktif/tamamlanan olan filmleri gizle
  const activeJobMovieIds = new Set(
    jobs
      .filter((j) => ACTIVE_STATUSES.includes(j.status))
      .map((j) => j.movie_content_id)
  )
  const availableMovies = filteredMovies.filter((m) => !activeJobMovieIds.has(m.id))

  const selectedMovie = availableMovies.find((m) => m.id === selectedMovieId)
    ?? filteredMovies.find((m) => m.id === selectedMovieId)
    ?? null

  // Ozellik 4: Secili film icin tamamlanan profil id'leri
  const completedProfileIds = new Set(
    jobs
      .filter((j) => j.status === 'completed' && j.movie_content_id === selectedMovieId)
      .map((j) => j.transcode_profile_id)
  )

  // ── Preview polling ───────────────────────────────────────────────────────

  useEffect(() => {
    if (pendingPreviewId === null) return
    const job = jobs.find((j) => j.id === pendingPreviewId)
    if (!job) return

    if (job.status === 'previewing') {
      setSeenPreviewing(true)
    } else if (job.status !== 'previewing' && seenPreviewing) {
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
      // Reset movie selection so the newly queued movie disappears from list
      setSelectedMovieId('')
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
      setConfirmClear(null)
    },
    onError: (e: any) => showToast(e?.response?.data?.detail ?? 'Hata', 'err'),
  })

  const clearByStatusMut = useMutation({
    mutationFn: (statusFilter: string) => transcodeJobApi.clearByStatus(statusFilter),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] })
      showToast(`${r.cleared} job temizlendi`)
      setConfirmClear(null)
    },
    onError: (e: any) => showToast(e?.response?.data?.detail ?? 'Hata', 'err'),
  })

  const clearSelectedMut = useMutation({
    mutationFn: (ids: number[]) => transcodeJobApi.clearSelected(ids),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['transcode-jobs'] })
      showToast(`${r.cleared} job temizlendi`)
      setSelectedJobIds(new Set())
      setConfirmClear(null)
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

  // ── Clear action handler ───────────────────────────────────────────────────

  function handleClearAction(action: ClearAction) {
    const labels: Record<ClearAction, string> = {
      completed: 'Tamamlanmis joblar silinecek. Emin misiniz?',
      failed: 'Hata veren joblar silinecek. Emin misiniz?',
      queued: 'Bekleyen (queued) joblar silinecek. Emin misiniz?',
      selected: `${selectedJobIds.size} secili job silinecek. Emin misiniz?`,
    }
    const titles: Record<ClearAction, string> = {
      completed: 'Tamamlananlari Temizle',
      failed: 'Hata Verenleri Temizle',
      queued: 'Bekleyenleri Temizle',
      selected: 'Secilenleri Temizle',
    }
    setConfirmClear({ action, label: labels[action] })
    // store title for dialog
    void titles
  }

  function executeClear() {
    if (!confirmClear) return
    if (confirmClear.action === 'selected') {
      clearSelectedMut.mutate(Array.from(selectedJobIds))
    } else {
      clearByStatusMut.mutate(confirmClear.action)
    }
  }

  // ── Checkbox helpers ──────────────────────────────────────────────────────

  const allSelectableIds = jobs
    .filter((j) => j.status !== 'transcoding')
    .map((j) => j.id)
  const allSelected = allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedJobIds.has(id))

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedJobIds(new Set())
    } else {
      setSelectedJobIds(new Set(allSelectableIds))
    }
  }

  function toggleJobSelect(id: number) {
    setSelectedJobIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
      text_padding_top: textPaddingTop,
      text_padding_bottom: textPaddingBottom,
      text_fade_enabled: textFadeEnabled,
      text_fade_interval: textFadeIntervalMin * 60,
      text_fade_duration: textFadeDuration,
      text_fade_in_time: textFadeInTime,
      text_fade_out_time: textFadeOutTime,
      countdown_enabled: countdownEnabled,
      countdown_position: countdownPosition,
    }
    createMut.mutate(payload)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const clearIsPending = clearMut.isPending || clearByStatusMut.isPending || clearSelectedMut.isPending

  const CLEAR_TITLES: Record<ClearAction, string> = {
    completed: 'Tamamlananlari Temizle',
    failed: 'Hata Verenleri Temizle',
    queued: 'Bekleyenleri Temizle',
    selected: 'Secilenleri Temizle',
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
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
      {confirmClear !== null && (
        <ConfirmDialog
          title={CLEAR_TITLES[confirmClear.action]}
          message={confirmClear.label}
          onConfirm={executeClear}
          onCancel={() => setConfirmClear(null)}
        />
      )}

      {/* Preview modal */}
      {previewJobId !== null && (
        <PreviewModal jobId={previewJobId} onClose={() => setPreviewJobId(null)} />
      )}

      {/* Log modal */}
      {logJobId !== null && (
        <LogModal
          jobId={logJobId}
          jobStatus={jobs.find((j) => j.id === logJobId)?.status ?? ''}
          onClose={() => setLogJobId(null)}
        />
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
              {/* Movie — Ozellik 3: activeJobMovieIds filtresi */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Film Sec *</label>
                <select
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  value={selectedMovieId}
                  onChange={(e) => setSelectedMovieId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">-- Film Seciniz --</option>
                  {availableMovies.map((m) => (
                    <option key={m.id} value={m.id} disabled={!m.file_path}>
                      {m.title}{!m.file_path ? ' (dosya yok)' : ''}
                    </option>
                  ))}
                </select>
                {activeJobMovieIds.size > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    {activeJobMovieIds.size} film kuyrukta/tamamlandi — listeden gizlendi
                  </p>
                )}
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
              {/* Profil — Ozellik 4: tamamlanan profiller disabled */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Transcode Profili *</label>
                <select
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">-- Profil Seciniz --</option>
                  {profiles.map((p) => {
                    const done = completedProfileIds.has(p.id)
                    return (
                      <option
                        key={p.id}
                        value={p.id}
                        disabled={done}
                        title={done ? 'Bu film bu profille zaten transcode edildi' : undefined}
                      >
                        {p.name}{done ? ' (transcode edildi)' : ''}
                      </option>
                    )
                  })}
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

                {/* Yazi kenar boslugu (padding) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Ust Kenar Boslugu (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                      value={textPaddingTop}
                      onChange={(e) => setTextPaddingTop(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Alt Kenar Boslugu (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                      value={textPaddingBottom}
                      onChange={(e) => setTextPaddingBottom(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Yazi gorunme/kaybolma efekti (fade in/out) */}
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-600">Yazi Efekti (Fade In/Out)</span>
                    <button
                      type="button"
                      onClick={() => setTextFadeEnabled((v) => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${textFadeEnabled ? 'bg-blue-500' : 'bg-slate-200'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${textFadeEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                  <div className={`space-y-3 ${!textFadeEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Kac dakikada bir</label>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                          value={textFadeIntervalMin}
                          onChange={(e) => setTextFadeIntervalMin(Number(e.target.value))}
                        />
                        <p className="mt-0.5 text-xs text-slate-400">Dakika (ornek: 10 = 10dk)</p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Kac saniye gizlenecek</label>
                        <input
                          type="number"
                          min={1}
                          max={300}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                          value={textFadeDuration}
                          onChange={(e) => setTextFadeDuration(Number(e.target.value))}
                        />
                        <p className="mt-0.5 text-xs text-slate-400">Saniye</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Belirme suresi (sn)</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                          value={textFadeInTime}
                          onChange={(e) => setTextFadeInTime(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Kaybolma suresi (sn)</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                          value={textFadeOutTime}
                          onChange={(e) => setTextFadeOutTime(Number(e.target.value))}
                        />
                      </div>
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
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 px-4 py-4 flex-shrink-0 gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-700">
                Transcode Kuyrugu
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
                  {jobs.length}
                </span>
              </h2>
              {/* Secili sayisi */}
              {selectedJobIds.size > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {selectedJobIds.size} secili
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startQueueMut.mutate()}
                disabled={startQueueMut.isPending}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
              >
                <ListChecks size={13} />
                Kuyrugu Baslat
              </button>
              {/* Ozellik 1: Dropdown temizle */}
              <ClearDropdown
                isPending={clearIsPending}
                hasSelection={selectedJobIds.size > 0}
                onSelect={handleClearAction}
              />
            </div>
          </div>

          {/* Table */}
          {jobsQ.isLoading ? (
            <div className="p-10 text-center text-sm text-slate-400">Yukleniyor...</div>
          ) : jobs.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">Kuyrukta job yok.</div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm" style={{minWidth: '620px'}}>
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {/* Ozellik 2: Hepsini sec checkbox */}
                    <th className="px-3 py-3 w-8">
                      <button
                        onClick={toggleSelectAll}
                        title={allSelected ? 'Secimi Kaldir' : 'Hepsini Sec'}
                        className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                          allSelected
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-slate-300 bg-white hover:border-blue-400'
                        }`}
                      >
                        {allSelected && (
                          <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5">
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-3">#</th>
                    <th className="px-3 py-3">Video</th>
                    <th className="px-3 py-3">Profil</th>
                    <th className="px-3 py-3">Durum</th>
                    <th className="px-3 py-3 min-w-[120px]">Ilerleme</th>
                    <th className="px-3 py-3 whitespace-nowrap">Kalan Sure</th>
                    <th className="px-3 py-3 text-right">Aksiyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {jobs.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      selected={selectedJobIds.has(job.id)}
                      onToggleSelect={() => toggleJobSelect(job.id)}
                      onStart={() => startMut.mutate(job.id)}
                      onStop={() => stopMut.mutate(job.id)}
                      onDelete={() => setConfirmDelete(job.id)}
                      onPreview={() => previewMut.mutate(job.id)}
                      onShowPreview={() => setPreviewJobId(job.id)}
                      onShowLogs={() => setLogJobId(job.id)}
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
  selected,
  onToggleSelect,
  onStart,
  onStop,
  onDelete,
  onPreview,
  onShowPreview,
  onShowLogs,
  previewPending,
  previewLoading,
}: {
  job: TranscodeJob
  selected: boolean
  onToggleSelect: () => void
  onStart: () => void
  onStop: () => void
  onDelete: () => void
  onPreview: () => void
  onShowPreview: () => void
  onShowLogs: () => void
  previewPending: boolean
  previewLoading: boolean
}) {
  const canStart = job.status === 'queued' || job.status === 'paused' || job.status === 'failed'
  const canStop = job.status === 'transcoding'
  const canPreview = (job.status === 'queued' || job.status === 'paused' || job.status === 'failed' || job.status === 'completed') && !previewPending
  const isTranscoding = job.status === 'transcoding'

  return (
    <tr className={`hover:bg-slate-50/60 transition ${selected ? 'bg-blue-50/40' : ''}`}>
      {/* Ozellik 2: Mavi checkbox */}
      <td className="px-3 py-3 w-8">
        <button
          onClick={onToggleSelect}
          disabled={isTranscoding}
          title={isTranscoding ? 'Transcode sirasinda secilemez' : undefined}
          className={`flex h-4 w-4 items-center justify-center rounded border transition ${
            selected
              ? 'border-blue-500 bg-blue-500 text-white'
              : 'border-slate-300 bg-white hover:border-blue-400'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          {selected && (
            <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5">
              <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </td>
      <td className="px-3 py-3 text-xs text-slate-400 font-mono">
        {String(job.unique_number).padStart(5, '0')}
      </td>
      <td className="px-3 py-3 max-w-[160px]">
        <div className="font-medium text-slate-700 truncate text-xs">{job.movie_title ?? '—'}</div>
        {job.server_name && (
          <div className="mt-0.5 text-xs text-slate-400 truncate">{job.server_name}</div>
        )}
        {job.overlay_text && (
          <div className="mt-0.5 text-xs text-slate-400 truncate italic">"{job.overlay_text}"</div>
        )}
      </td>
      <td className="px-3 py-3 text-slate-600 text-xs truncate max-w-[80px]">{job.profile_name ?? '—'}</td>
      <td className="px-3 py-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_CLASSES[job.status] ?? 'bg-slate-100 text-slate-600'}`}>
          {STATUS_LABELS[job.status] ?? job.status}
        </span>
        {job.error_message && !job.error_message.startsWith('Onizleme hatasi') && (
          <div className="mt-1 max-w-[120px] truncate text-xs text-rose-500" title={job.error_message}>
            {job.error_message.slice(0, 50)}
          </div>
        )}
      </td>
      <td className="px-3 py-3">
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
      <td className="px-3 py-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">
        {job.status === 'transcoding' ? formatEta(job.eta_seconds) : '—'}
      </td>
      <td className="px-3 py-3">
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
          {(job.status === 'queued' || job.status === 'paused' || job.status === 'completed') && !previewPending && (
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
            disabled={isTranscoding}
          >
            <Trash2 size={14} />
          </button>
          {/* Log */}
          <button
            onClick={onShowLogs}
            title="FFmpeg logunu goster"
            className={`rounded-lg p-1.5 transition ${
              job.status === 'failed'
                ? 'text-rose-500 hover:bg-rose-50 hover:text-rose-600'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            <Terminal size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}
