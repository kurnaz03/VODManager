import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, HelpCircle, ImagePlus, Layers, Pencil, Plus, Trash2, X } from 'lucide-react'
import { transcodeApi, TranscodeProfile, TranscodeProfileCreate } from '../services/transcodeApi'

// ── Logo Size Tooltip ─────────────────────────────────────────────────────────

function LogoSizeTooltip() {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        className="ml-1 text-slate-400 hover:text-blue-500 transition-colors focus:outline-none"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        tabIndex={-1}
        aria-label="Logo boyut tavsiyeleri"
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <div
          className="absolute left-5 top-0 z-50 w-72 rounded-xl bg-slate-900 p-4 text-xs text-white shadow-2xl"
          style={{ whiteSpace: 'pre-line' }}
        >
          <p className="mb-2 font-semibold text-slate-200">Onerilen Logo Boyutlari:</p>
          <p className="mb-1 font-medium text-blue-300">4K (3840x2160) icin:</p>
          <p className="mb-2 text-slate-300">Genislik: 200-300px, Yukseklik: 80-120px</p>
          <p className="mb-1 font-medium text-blue-300">Full HD (1920x1080) icin:</p>
          <p className="mb-2 text-slate-300">Genislik: 120-180px, Yukseklik: 50-70px</p>
          <p className="mb-1 font-medium text-blue-300">HD (1280x720) icin:</p>
          <p className="mb-2 text-slate-300">Genislik: 80-120px, Yukseklik: 35-50px</p>
          <p className="mb-1 font-medium text-blue-300">SD (720x480) icin:</p>
          <p className="mb-3 text-slate-300">Genislik: 60-80px, Yukseklik: 25-35px</p>
          <p className="text-yellow-300">Ipucu: Logo boyutu video cozunurlugununun %8-12si kadar olmalidir.</p>
        </div>
      )}
    </span>
  )
}

// ── Option Lists ──────────────────────────────────────────────────────────────

const VIDEO_CODECS = ['h264', 'h265', 'vp9', 'av1']
const VIDEO_PRESETS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow']
const VIDEO_TUNES = ['', 'film', 'animation', 'grain', 'stillimage', 'fastdecode', 'zerolatency']
const VIDEO_PROFILES = ['', 'baseline', 'main', 'high']
const VIDEO_LEVELS = ['', '3.0', '3.1', '4.0', '4.1', '4.2', '5.0', '5.1']
const VIDEO_PIXEL_FORMATS = ['yuv420p', 'yuv422p', 'yuv444p']
const VIDEO_SCALING = ['lanczos', 'bicubic', 'bilinear', 'spline']
const AUDIO_CODECS = ['aac', 'ac3', 'eac3', 'mp3', 'opus', 'flac']
const AUDIO_BITRATES = ['', '64k', '96k', '128k', '160k', '192k', '256k', '320k']
const AUDIO_SAMPLE_RATES = [44100, 48000, 96000]
const AUDIO_CHANNELS = [{ value: 1, label: 'Mono (1)' }, { value: 2, label: 'Stereo (2)' }, { value: 6, label: '5.1 (6)' }]
const AUDIO_MAP_OPTIONS = [
  { value: 'first', label: 'Ilk Kanal (0:a:0)' },
  { value: 'all', label: 'Tum Kanallar (0:a?)' },
  { value: 'custom', label: 'Belirli Kanal No' },
]
const OUTPUT_FORMATS = ['mp4', 'ts', 'mkv', 'flv']
const CONTAINER_FORMATS = ['mp4', 'mkv', 'mpegts']
const OUTPUT_TYPES = [
  { value: 'channel_ready', label: 'Kanal Hazir (channel_ready)' },
  { value: 'archive', label: 'Arsiv (archive)' },
  { value: 'streaming_ready', label: 'Streaming Hazir (streaming_ready)' },
]
const HARDWARE_ACCELS = ['', 'none', 'nvenc', 'vaapi', 'qsv']
const HWACCEL_TYPES = ['', 'cuda', 'vaapi', 'qsv', 'none']
const LOGO_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']
const FPS_OPTIONS = ['', '23.976', '24', '25', '29.97', '30', '50', '60']
const VSYNC_MODES = [
  { value: 'cfr', label: 'CFR - Sabit Kare Hizi (onerilen)' },
  { value: 'vfr', label: 'VFR - Degisken Kare Hizi' },
  { value: 'passthrough', label: 'Passthrough' },
]
const AVOID_NEGATIVE_TS = [
  { value: 'make_zero', label: 'make_zero (onerilen)' },
  { value: 'make_non_negative', label: 'make_non_negative' },
  { value: 'disabled', label: 'Disabled' },
]
const DEINTERLACE_MODES = ['yadif', 'w3fdif', 'bwdif']

// ── Default form values ───────────────────────────────────────────────────────

const defaultForm = (): TranscodeProfileCreate => ({
  name: '',
  logo_width: null,
  logo_height: null,
  logo_position: 'top-right',
  logo_opacity: 1.0,
  logo_margin_x: 10,
  logo_margin_y: 10,
  video_codec: 'h264',
  video_bitrate: '',
  video_maxrate: '',
  video_bufsize: '',
  video_crf: 18,
  video_width: null,
  video_height: null,
  video_fps: 25,
  video_profile: 'high',
  video_level: '4.1',
  video_preset: 'veryfast',
  video_tune: null,
  video_pixel_format: 'yuv420p',
  video_gop_size: 50,
  video_b_frames: 3,
  video_reference_frames: null,
  deinterlace: false,
  deinterlace_mode: 'yadif',
  scaling_algorithm: 'lanczos',
  sc_threshold: 0,
  audio_codec: 'aac',
  audio_bitrate: '128k',
  audio_sample_rate: 48000,
  audio_channels: 2,
  audio_volume: 1.0,
  audio_normalization: false,
  async_audio_sync: 1,
  audio_map: 'first',
  audio_map_channel: null,
  audio_normalize: false,
  output_format: 'mp4',
  output_type: 'channel_ready',
  container_format: 'mp4',
  muxer_flags: '',
  segment_duration: null,
  movflags_faststart: true,
  map_metadata: false,
  vsync_mode: 'cfr',
  avoid_negative_ts: 'make_zero',
  fflags_mode: '+genpts',
  thread_queue_size: 512,
  hardware_accel: null,
  hwaccel_type: null,
  extra_ffmpeg_args: '',
  x264_params: '',
  is_default: false,
})

function profileToForm(p: TranscodeProfile): TranscodeProfileCreate {
  return {
    name: p.name,
    logo_width: p.logo_width,
    logo_height: p.logo_height,
    logo_position: p.logo_position,
    logo_opacity: p.logo_opacity,
    logo_margin_x: p.logo_margin_x ?? 10,
    logo_margin_y: p.logo_margin_y ?? 10,
    video_codec: p.video_codec,
    video_bitrate: p.video_bitrate ?? '',
    video_maxrate: p.video_maxrate ?? '',
    video_bufsize: p.video_bufsize ?? '',
    video_crf: p.video_crf ?? 18,
    video_width: p.video_width,
    video_height: p.video_height,
    video_fps: p.video_fps,
    video_profile: p.video_profile,
    video_level: p.video_level,
    video_preset: p.video_preset,
    video_tune: p.video_tune,
    video_pixel_format: p.video_pixel_format,
    video_gop_size: p.video_gop_size,
    video_b_frames: p.video_b_frames,
    video_reference_frames: p.video_reference_frames,
    deinterlace: p.deinterlace,
    deinterlace_mode: p.deinterlace_mode ?? 'yadif',
    scaling_algorithm: p.scaling_algorithm,
    sc_threshold: p.sc_threshold ?? 0,
    audio_codec: p.audio_codec,
    audio_bitrate: p.audio_bitrate ?? '',
    audio_sample_rate: p.audio_sample_rate,
    audio_channels: p.audio_channels,
    audio_volume: p.audio_volume,
    audio_normalization: p.audio_normalization,
    async_audio_sync: p.async_audio_sync ?? 1,
    audio_map: p.audio_map ?? 'first',
    audio_map_channel: p.audio_map_channel,
    audio_normalize: p.audio_normalize ?? false,
    output_format: p.output_format,
    output_type: p.output_type ?? 'channel_ready',
    container_format: p.container_format ?? 'mp4',
    muxer_flags: p.muxer_flags ?? '',
    segment_duration: p.segment_duration,
    movflags_faststart: p.movflags_faststart ?? true,
    map_metadata: p.map_metadata ?? false,
    vsync_mode: p.vsync_mode ?? 'cfr',
    avoid_negative_ts: p.avoid_negative_ts ?? 'make_zero',
    fflags_mode: p.fflags_mode ?? '+genpts',
    thread_queue_size: p.thread_queue_size ?? 512,
    hardware_accel: p.hardware_accel,
    hwaccel_type: p.hwaccel_type,
    extra_ffmpeg_args: p.extra_ffmpeg_args ?? '',
    x264_params: p.x264_params ?? '',
    is_default: p.is_default,
  }
}

// ── Resolution helper ─────────────────────────────────────────────────────────

function resolution(p: TranscodeProfile) {
  if (p.video_width && p.video_height) return `${p.video_width}x${p.video_height}`
  if (p.video_width) return `${p.video_width}w`
  if (p.video_height) return `${p.video_height}h`
  return '-'
}

type TabId = 'video' | 'audio' | 'container' | 'sync' | 'logo' | 'advanced'
const TABS: { id: TabId; label: string }[] = [
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Ses' },
  { id: 'container', label: 'Kapsayici/Cikti' },
  { id: 'sync', label: 'Sync/Flags' },
  { id: 'logo', label: 'Logo' },
  { id: 'advanced', label: 'Gelismis' },
]

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TranscodeProfilesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editProfile, setEditProfile] = useState<TranscodeProfile | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['transcode-profiles'],
    queryFn: transcodeApi.list,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => transcodeApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transcode-profiles'] })
      setDeleteId(null)
    },
  })

  function openCreate() {
    setEditProfile(null)
    setShowForm(true)
  }

  function openEdit(p: TranscodeProfile) {
    setEditProfile(p)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditProfile(null)
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Kanal & VOD</div>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Transcode Profiller</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Video/ses kodlama profillerini yonetin. Her profil bir VOD kanali icin kullanilabilir.
            </p>
          </div>
          <button type="button" className="primary-button" onClick={openCreate}>
            <Plus size={18} /> Yeni Profil
          </button>
        </div>
      </section>

      <section className="glass-panel p-4 sm:p-6">
        <div className="table-shell overflow-x-auto">
          <table className="w-full text-sm" style={{minWidth: '700px'}}>
            <thead>
              <tr className="table-head text-left">
                <th className="px-4 py-3 font-semibold text-slate-500">Logo</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Profil Adi</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Video Codec</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Cozunurluk</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Audio Codec</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Format</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Varsayilan</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Islemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map((p) => (
                <tr key={p.id} className="table-zebra hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                      {p.logo_url ? (
                        <img src={p.logo_url} alt={p.name} className="h-full w-full object-contain" />
                      ) : (
                        <Layers size={16} className="text-slate-400" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600 uppercase">{p.video_codec}</td>
                  <td className="px-4 py-3 text-slate-600">{resolution(p)}</td>
                  <td className="px-4 py-3 text-slate-600 uppercase">{p.audio_codec}</td>
                  <td className="px-4 py-3 text-slate-600 uppercase">{p.output_format}</td>
                  <td className="px-4 py-3">
                    {p.is_default ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Evet</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEdit(p)} className="secondary-button px-3 py-2">
                        <Pencil size={14} /> Duzenle
                      </button>
                      <button type="button" onClick={() => setDeleteId(p.id)} className="danger-button px-3 py-2">
                        <Trash2 size={14} /> Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-sm text-slate-500">
                    {isLoading ? 'Yukleniyor...' : 'Henuz transcode profili eklenmemis.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Form Modal */}
      {showForm && (
        <ProfileFormModal
          profile={editProfile}
          onClose={closeForm}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['transcode-profiles'] })
            closeForm()
          }}
        />
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Profili Sil</h3>
            <p className="mt-2 text-sm text-slate-600">Bu transcode profilini silmek istediginize emin misiniz? Bagli gizli kategori de silinecek.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="secondary-button" onClick={() => setDeleteId(null)}>
                <X size={16} /> Iptal
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={16} /> {deleteMutation.isPending ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Profile Form Modal ────────────────────────────────────────────────────────

function ProfileFormModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: TranscodeProfile | null
  onClose: () => void
  onSaved: () => void
}) {
  const [activeTab, setActiveTab] = useState<TabId>('video')
  const [form, setForm] = useState<TranscodeProfileCreate>(
    profile ? profileToForm(profile) : defaultForm()
  )
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(profile?.logo_url ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEdit = profile !== null

  const createMutation = useMutation({
    mutationFn: (payload: TranscodeProfileCreate) => transcodeApi.create(payload),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<TranscodeProfileCreate> }) =>
      transcodeApi.update(id, payload),
  })
  const logoMutation = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => transcodeApi.uploadLogo(id, file),
  })

  function set<K extends keyof TranscodeProfileCreate>(key: K, value: TranscodeProfileCreate[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload: TranscodeProfileCreate = {
      ...form,
      video_bitrate: form.video_bitrate || null,
      video_maxrate: form.video_maxrate || null,
      video_bufsize: form.video_bufsize || null,
      audio_bitrate: form.audio_bitrate || null,
      muxer_flags: form.muxer_flags || null,
      extra_ffmpeg_args: form.extra_ffmpeg_args || null,
      x264_params: (form.x264_params as string) === '' ? null : form.x264_params,
      video_profile: (form.video_profile as string) === '' ? null : form.video_profile,
      video_level: (form.video_level as string) === '' ? null : form.video_level,
      video_tune: (form.video_tune as string) === '' ? null : form.video_tune,
      hardware_accel: (form.hardware_accel as string) === '' || (form.hardware_accel as string) === 'none' ? null : form.hardware_accel,
      hwaccel_type: (form.hwaccel_type as string) === '' || (form.hwaccel_type as string) === 'none' ? null : form.hwaccel_type,
      audio_map_channel: form.audio_map === 'custom' ? form.audio_map_channel : null,
    } as TranscodeProfileCreate

    let savedProfile: TranscodeProfile

    if (isEdit) {
      savedProfile = await updateMutation.mutateAsync({ id: profile.id, payload })
    } else {
      savedProfile = await createMutation.mutateAsync(payload)
    }

    if (logoFile) {
      await logoMutation.mutateAsync({ id: savedProfile.id, file: logoFile })
    }

    onSaved()
  }

  const isPending = createMutation.isPending || updateMutation.isPending || logoMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-8">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 px-4 py-4 gap-3 sm:px-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {isEdit ? 'Profil Duzenle' : 'Yeni Transcode Profili'}
            </h3>
            <div className="mt-1">
              <input
                className="panel-input text-sm"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Profil adi (ornek: HD 1080p H264)"
                required
              />
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-4">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-6 pt-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`whitespace-nowrap rounded-t-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === t.id
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6">

          {/* ── Video Tab ── */}
          {activeTab === 'video' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="panel-label">Video Codec *</label>
                  <select className="panel-select" value={form.video_codec} onChange={(e) => set('video_codec', e.target.value as TranscodeProfileCreate['video_codec'])}>
                    {VIDEO_CODECS.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="panel-label">FPS</label>
                  <select className="panel-select" value={form.video_fps?.toString() ?? ''} onChange={(e) => set('video_fps', e.target.value ? Number(e.target.value) : null)}>
                    {FPS_OPTIONS.map((f) => <option key={f} value={f}>{f || 'Otomatik'}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="panel-label">Genislik (px)</label>
                  <input type="number" className="panel-input" value={form.video_width ?? ''} onChange={(e) => set('video_width', e.target.value ? Number(e.target.value) : null)} placeholder="1920" />
                </div>
                <div>
                  <label className="panel-label">Yukseklik (px)</label>
                  <input type="number" className="panel-input" value={form.video_height ?? ''} onChange={(e) => set('video_height', e.target.value ? Number(e.target.value) : null)} placeholder="1080" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="panel-label">CRF (0-51, dusuk=kaliteli)</label>
                  <input type="number" min={0} max={51} className="panel-input" value={form.video_crf ?? ''} onChange={(e) => set('video_crf', e.target.value ? Number(e.target.value) : null)} placeholder="18" />
                </div>
                <div>
                  <label className="panel-label">Max Bitrate</label>
                  <input className="panel-input" value={form.video_maxrate ?? ''} onChange={(e) => set('video_maxrate', e.target.value as never)} placeholder="4000k" />
                </div>
                <div>
                  <label className="panel-label">Buffer Boyutu</label>
                  <input className="panel-input" value={form.video_bufsize ?? ''} onChange={(e) => set('video_bufsize', e.target.value as never)} placeholder="8000k" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="panel-label">Sabit Bitrate (VBR icin bos birakin)</label>
                  <input className="panel-input" value={form.video_bitrate ?? ''} onChange={(e) => set('video_bitrate', e.target.value as never)} placeholder="4000k" />
                </div>
                <div>
                  <label className="panel-label">Pixel Format</label>
                  <select className="panel-select" value={form.video_pixel_format} onChange={(e) => set('video_pixel_format', e.target.value as TranscodeProfileCreate['video_pixel_format'])}>
                    {VIDEO_PIXEL_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="panel-label">Profile</label>
                  <select className="panel-select" value={form.video_profile ?? ''} onChange={(e) => set('video_profile', (e.target.value || null) as TranscodeProfileCreate['video_profile'])}>
                    {VIDEO_PROFILES.map((p) => <option key={p} value={p}>{p || 'Varsayilan'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="panel-label">Level</label>
                  <select className="panel-select" value={form.video_level ?? ''} onChange={(e) => set('video_level', (e.target.value || null) as TranscodeProfileCreate['video_level'])}>
                    {VIDEO_LEVELS.map((l) => <option key={l} value={l}>{l || 'Varsayilan'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="panel-label">Preset</label>
                  <select className="panel-select" value={form.video_preset ?? ''} onChange={(e) => set('video_preset', (e.target.value || null) as TranscodeProfileCreate['video_preset'])}>
                    {VIDEO_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="panel-label">Tune</label>
                  <select className="panel-select" value={form.video_tune ?? ''} onChange={(e) => set('video_tune', (e.target.value || null) as TranscodeProfileCreate['video_tune'])}>
                    {VIDEO_TUNES.map((t) => <option key={t} value={t}>{t || 'Yok'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="panel-label">Scaling Algoritmasi</label>
                  <select className="panel-select" value={form.scaling_algorithm} onChange={(e) => set('scaling_algorithm', e.target.value as TranscodeProfileCreate['scaling_algorithm'])}>
                    {VIDEO_SCALING.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="panel-label">SC Threshold (0=sahne alg. kapat)</label>
                  <input type="number" className="panel-input" value={form.sc_threshold ?? 0} onChange={(e) => set('sc_threshold', Number(e.target.value))} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="panel-label">GOP Boyutu (-g)</label>
                  <input type="number" className="panel-input" value={form.video_gop_size ?? ''} onChange={(e) => set('video_gop_size', e.target.value ? Number(e.target.value) : null)} placeholder="50" />
                </div>
                <div>
                  <label className="panel-label">B-Frame Sayisi</label>
                  <input type="number" min={0} max={16} className="panel-input" value={form.video_b_frames ?? ''} onChange={(e) => set('video_b_frames', e.target.value ? Number(e.target.value) : null)} placeholder="3" />
                </div>
                <div>
                  <label className="panel-label">Referans Frame</label>
                  <input type="number" min={1} className="panel-input" value={form.video_reference_frames ?? ''} onChange={(e) => set('video_reference_frames', e.target.value ? Number(e.target.value) : null)} placeholder="3" />
                </div>
              </div>

              <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Deinterlace</p>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="deinterlace"
                    checked={form.deinterlace}
                    onChange={(e) => set('deinterlace', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <label htmlFor="deinterlace" className="text-sm text-slate-700">Deinterlace Aktif (interlaced video icin)</label>
                </div>
                {form.deinterlace && (
                  <div>
                    <label className="panel-label">Deinterlace Modu</label>
                    <select className="panel-select" value={form.deinterlace_mode} onChange={(e) => set('deinterlace_mode', e.target.value as TranscodeProfileCreate['deinterlace_mode'])}>
                      {DEINTERLACE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Ses Tab ── */}
          {activeTab === 'audio' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="panel-label">Audio Codec *</label>
                  <select className="panel-select" value={form.audio_codec} onChange={(e) => set('audio_codec', e.target.value as TranscodeProfileCreate['audio_codec'])}>
                    {AUDIO_CODECS.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="panel-label">Bitrate</label>
                  <select className="panel-select" value={form.audio_bitrate ?? ''} onChange={(e) => set('audio_bitrate', e.target.value as never)}>
                    {AUDIO_BITRATES.map((b) => <option key={b} value={b}>{b || 'Otomatik'}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="panel-label">Ornek Hizi (Hz)</label>
                  <select className="panel-select" value={form.audio_sample_rate ?? ''} onChange={(e) => set('audio_sample_rate', e.target.value ? Number(e.target.value) : null)}>
                    {AUDIO_SAMPLE_RATES.map((r) => <option key={r} value={r}>{r} Hz</option>)}
                  </select>
                </div>
                <div>
                  <label className="panel-label">Kanal</label>
                  <select className="panel-select" value={form.audio_channels ?? ''} onChange={(e) => set('audio_channels', e.target.value ? Number(e.target.value) : null)}>
                    {AUDIO_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="panel-label">Audio Map</label>
                <div className="flex gap-3 items-center">
                  <select className="panel-select flex-1" value={form.audio_map} onChange={(e) => set('audio_map', e.target.value as TranscodeProfileCreate['audio_map'])}>
                    {AUDIO_MAP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {form.audio_map === 'custom' && (
                    <input
                      type="number"
                      min={0}
                      className="panel-input w-28"
                      value={form.audio_map_channel ?? 0}
                      onChange={(e) => set('audio_map_channel', Number(e.target.value))}
                      placeholder="Kanal No"
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">IPTV icin birden fazla ses kanali varsa "Ilk Kanal" onerilen.</p>
              </div>
              <div>
                <label className="panel-label">Ses Seviyesi Carpani ({form.audio_volume.toFixed(2)}x)</label>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.05}
                  className="w-full"
                  value={form.audio_volume}
                  onChange={(e) => set('audio_volume', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="panel-label">Async Audio Senkron (ms, 0=kapali, 1=otomatik)</label>
                <input
                  type="number"
                  className="panel-input"
                  value={form.async_audio_sync ?? ''}
                  onChange={(e) => set('async_audio_sync', e.target.value !== '' ? Number(e.target.value) : null)}
                  placeholder="1"
                />
                <p className="mt-1 text-xs text-slate-400">-async parametresi. Video-ses kaymasini otomatik duzeltir. Concat gecislerinde onerilen: 1</p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="audio_normalization"
                    checked={form.audio_normalization}
                    onChange={(e) => set('audio_normalization', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <label htmlFor="audio_normalization" className="text-sm text-slate-700">Ses Normalizasyonu (loudnorm filtresi)</label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="audio_normalize"
                    checked={form.audio_normalize}
                    onChange={(e) => set('audio_normalize', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <label htmlFor="audio_normalize" className="text-sm text-slate-700">Ses Seviyesi Normalize (farkli videolar arasi)</label>
                </div>
              </div>
            </div>
          )}

          {/* ── Kapsayici/Cikti Tab ── */}
          {activeTab === 'container' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="panel-label">Cikti Tipi</label>
                  <select className="panel-select" value={form.output_type} onChange={(e) => set('output_type', e.target.value as TranscodeProfileCreate['output_type'])}>
                    {OUTPUT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="panel-label">Container Format</label>
                  <select className="panel-select" value={form.container_format} onChange={(e) => set('container_format', e.target.value as TranscodeProfileCreate['container_format'])}>
                    {CONTAINER_FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="panel-label">Cikti Formati (-f)</label>
                  <select className="panel-select" value={form.output_format} onChange={(e) => set('output_format', e.target.value as TranscodeProfileCreate['output_format'])}>
                    {OUTPUT_FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="panel-label">Muxer Flags (Ek)</label>
                <input className="panel-input" value={form.muxer_flags ?? ''} onChange={(e) => set('muxer_flags', e.target.value as never)} placeholder="ornek: +dash" />
                <p className="mt-1 text-xs text-slate-400">MP4 faststart ayari asagidaki checkbox ile ayri yonetilir.</p>
              </div>
              <div>
                <label className="panel-label">Segment Suresi (saniye, HLS icin)</label>
                <input type="number" className="panel-input" value={form.segment_duration ?? ''} onChange={(e) => set('segment_duration', e.target.value ? Number(e.target.value) : null)} placeholder="6" />
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="movflags_faststart"
                    checked={form.movflags_faststart}
                    onChange={(e) => set('movflags_faststart', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <label htmlFor="movflags_faststart" className="text-sm text-slate-700">
                    MP4 Faststart (-movflags +faststart) — web streaming icin onerilen
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="map_metadata"
                    checked={form.map_metadata}
                    onChange={(e) => set('map_metadata', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <label htmlFor="map_metadata" className="text-sm text-slate-700">
                    Metadata Koru (-map_metadata 0) — isaretlenmezse metadata temizlenir
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Sync/Flags Tab ── */}
          {activeTab === 'sync' && (
            <div className="space-y-5">
              <div className="rounded-xl bg-blue-50 p-4 text-xs text-blue-800">
                Bu ayarlar concat gecislerinde sorunsuz yayin icin kritiktir. Varsayilan degerler VOD kanal yayini icin optimize edilmistir.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="panel-label">Vsync Modu (-vsync)</label>
                  <select className="panel-select" value={form.vsync_mode} onChange={(e) => set('vsync_mode', e.target.value as TranscodeProfileCreate['vsync_mode'])}>
                    {VSYNC_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">CFR: Sabit kare hizi - farkli FPS videolari normalize eder, donma olmaz.</p>
                </div>
                <div>
                  <label className="panel-label">Avoid Negative Timestamps</label>
                  <select className="panel-select" value={form.avoid_negative_ts} onChange={(e) => set('avoid_negative_ts', e.target.value as TranscodeProfileCreate['avoid_negative_ts'])}>
                    {AVOID_NEGATIVE_TS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">Concat gecislerinde ses/video kaymasini onler.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="panel-label">FFlags Modu (-fflags)</label>
                  <input className="panel-input font-mono text-xs" value={form.fflags_mode} onChange={(e) => set('fflags_mode', e.target.value)} placeholder="+genpts" />
                  <p className="mt-1 text-xs text-slate-400">+genpts: Her frame icin PTS uret. Concat gecislerinde timestamp boslugunu onler.</p>
                </div>
                <div>
                  <label className="panel-label">Thread Queue Size (-thread_queue_size)</label>
                  <input type="number" className="panel-input" value={form.thread_queue_size} onChange={(e) => set('thread_queue_size', Number(e.target.value))} placeholder="512" />
                  <p className="mt-1 text-xs text-slate-400">Input okuma buffer boyutu. Buyuk dosyalarda stall onler.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Logo Tab ── */}
          {activeTab === 'logo' && (
            <div className="space-y-5">
              <div>
                <label className="panel-label">Logo Yukle</label>
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-blue-400"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="logo" className="h-full w-full object-contain" />
                    ) : (
                      <ImagePlus size={24} className="text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus size={16} /> Dosya Sec
                    </button>
                    <p className="mt-1 text-xs text-slate-400">PNG, JPG, SVG veya WebP - maks. 2MB</p>
                    {logoFile && (
                      <p className="mt-1 text-xs text-emerald-600">{logoFile.name} secildi</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="panel-label flex items-center">Logo Genisligi (px)<LogoSizeTooltip /></label>
                  <input
                    type="number"
                    className="panel-input"
                    value={form.logo_width ?? ''}
                    onChange={(e) => set('logo_width', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div>
                  <label className="panel-label flex items-center">Logo Yuksekligi (px)<LogoSizeTooltip /></label>
                  <input
                    type="number"
                    className="panel-input"
                    value={form.logo_height ?? ''}
                    onChange={(e) => set('logo_height', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="panel-label">Kenar Boslugu X (px)</label>
                  <input
                    type="number"
                    className="panel-input"
                    value={form.logo_margin_x}
                    onChange={(e) => set('logo_margin_x', Number(e.target.value))}
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="panel-label">Kenar Boslugu Y (px)</label>
                  <input
                    type="number"
                    className="panel-input"
                    value={form.logo_margin_y}
                    onChange={(e) => set('logo_margin_y', Number(e.target.value))}
                    placeholder="10"
                  />
                </div>
              </div>
              <div>
                <label className="panel-label">Logo Pozisyon</label>
                <select className="panel-select" value={form.logo_position} onChange={(e) => set('logo_position', e.target.value as TranscodeProfileCreate['logo_position'])}>
                  {LOGO_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="panel-label">Logo Opakligi ({form.logo_opacity.toFixed(2)})</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                  value={form.logo_opacity}
                  onChange={(e) => set('logo_opacity', Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* ── Advanced Tab ── */}
          {activeTab === 'advanced' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="panel-label">Donanim Hizlandirma (-hwaccel)</label>
                  <select className="panel-select" value={form.hardware_accel ?? ''} onChange={(e) => set('hardware_accel', (e.target.value || null) as TranscodeProfileCreate['hardware_accel'])}>
                    {HARDWARE_ACCELS.map((h) => <option key={h} value={h}>{h || 'Varsayilan (None)'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="panel-label">Hwaccel Tipi</label>
                  <select className="panel-select" value={form.hwaccel_type ?? ''} onChange={(e) => set('hwaccel_type', (e.target.value || null) as TranscodeProfileCreate['hwaccel_type'])}>
                    {HWACCEL_TYPES.map((h) => <option key={h} value={h}>{h || 'Varsayilan'}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="panel-label">x264 Parametreleri</label>
                <input
                  className="panel-input font-mono text-xs"
                  value={form.x264_params ?? ''}
                  onChange={(e) => set('x264_params', e.target.value as never)}
                  placeholder="rc-lookahead=40:ref=4:nal-hrd=cbr"
                />
                <p className="mt-1 text-xs text-slate-400">-x264-params olarak eklenir. Ornek: rc-lookahead=40:ref=4</p>
              </div>
              <div>
                <label className="panel-label">Ek FFmpeg Argumanlari</label>
                <textarea
                  className="panel-textarea font-mono text-xs"
                  rows={4}
                  value={form.extra_ffmpeg_args ?? ''}
                  onChange={(e) => set('extra_ffmpeg_args', e.target.value as never)}
                  placeholder="-vf scale=1920:1080 -threads 4"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={form.is_default}
                  onChange={(e) => set('is_default', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <label htmlFor="is_default" className="text-sm text-slate-700">Varsayilan profil olarak ayarla</label>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" className="secondary-button" onClick={onClose}>
              <X size={16} /> Iptal
            </button>
            <button type="submit" className="primary-button" disabled={isPending || !form.name}>
              <Check size={16} /> {isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
