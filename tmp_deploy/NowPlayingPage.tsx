import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Play,
  Pause,
  MonitorPlay,
  Settings,
  Pencil,
  Trash2,
  Check,
  X,
  ImagePlus,
  RefreshCw,
  Radio,
  Square,
  Copy,
} from 'lucide-react'
import { nowPlayingApi, NowPlayingChannel, InfoScreenTemplate, BouquetOption, ServerOption } from '../services/nowPlayingApi'

// ── Cinema Decorations (SVG) ─────────────────────────────────────────────────

function FilmReel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none">
      <circle cx="60" cy="60" r="55" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <circle cx="60" cy="60" r="40" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <circle cx="60" cy="60" r="18" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const rad = (a * Math.PI) / 180
        const x1 = 60 + 22 * Math.cos(rad)
        const y1 = 60 + 22 * Math.sin(rad)
        const x2 = 60 + 38 * Math.cos(rad)
        const y2 = 60 + 38 * Math.sin(rad)
        return (
          <line
            key={a}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.25"
          />
        )
      })}
    </svg>
  )
}

function Clapperboard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 70" className={className} fill="none">
      <rect x="4" y="20" width="72" height="46" rx="3" stroke="currentColor" strokeWidth="2.5" opacity="0.3" />
      <path d="M4 20 L76 20 L72 8 L8 8 Z" fill="currentColor" opacity="0.25" />
      <line x1="4" y1="20" x2="76" y2="20" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <line x1="20" y1="8" x2="16" y2="20" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <line x1="36" y1="8" x2="32" y2="20" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <line x1="52" y1="8" x2="48" y2="20" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <line x1="68" y1="8" x2="64" y2="20" stroke="currentColor" strokeWidth="2" opacity="0.35" />
    </svg>
  )
}

// ── Template Manager Modal ───────────────────────────────────────────────────

function TemplateManagerModal({
  open,
  onClose,
  templates,
  selectedTemplate,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  templates: InfoScreenTemplate[]
  selectedTemplate: InfoScreenTemplate | null
  onSelect: (t: InfoScreenTemplate) => void
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<InfoScreenTemplate | null>(null)
  const [form, setForm] = useState<Partial<InfoScreenTemplate>>({})
  const [uploading, setUploading] = useState(false)

  const { data: bouquets } = useQuery<BouquetOption[]>({
    queryKey: ['bouquets-options'],
    queryFn: nowPlayingApi.listBouquets,
    enabled: open,
  })

  const { data: servers } = useQuery<ServerOption[]>({
    queryKey: ['servers-options'],
    queryFn: nowPlayingApi.listServers,
    enabled: open,
  })

  const createMut = useMutation({
    mutationFn: nowPlayingApi.createTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['info-screen-templates'] }),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InfoScreenTemplate> }) =>
      nowPlayingApi.updateTemplate(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['info-screen-templates'] }),
  })
  const deleteMut = useMutation({
    mutationFn: nowPlayingApi.deleteTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['info-screen-templates'] }),
  })
  const setDefaultMut = useMutation({
    mutationFn: nowPlayingApi.setDefault,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['info-screen-templates'] }),
  })

  useEffect(() => {
    if (editing) {
      setForm({ ...editing })
    } else {
      setForm({
        name: '',
        is_default: false,
        bg_image_url: null,
        title_text: 'ŞU ANDA YAYINDA OLANLAR',
        subtitle_text: 'SİNEMA KANALLARI',
        primary_color: '#D4A843',
        bg_overlay_opacity: 70,
        font_family: 'serif',
        layout: 'cinema',
        bouquet_id: null,
        server_id: null,
      })
    }
  }, [editing, open])

  if (!open) return null

  const handleSave = () => {
    if (editing) {
      updateMut.mutate({ id: editing.id, data: form })
      setEditing(null)
    } else {
      createMut.mutate(form)
      setEditing(null)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await nowPlayingApi.uploadBg(file)
      setForm((prev) => ({ ...prev, bg_image_url: res.url }))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-700 bg-[#1a1a2e] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {editing ? 'Şablonu Düzenle' : 'Yeni Şablon'}
          </h2>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Şablon Adı</label>
            <input
              type="text"
              value={form.name || ''}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Başlık</label>
              <input
                type="text"
                value={form.title_text || ''}
                onChange={(e) => setForm((p) => ({ ...p, title_text: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Alt Başlık</label>
              <input
                type="text"
                value={form.subtitle_text || ''}
                onChange={(e) => setForm((p) => ({ ...p, subtitle_text: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Ana Renk</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primary_color || '#D4A843'}
                  onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))}
                  className="h-10 w-10 cursor-pointer rounded-lg border border-slate-700 bg-transparent"
                />
                <span className="text-sm text-slate-300">{form.primary_color}</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Overlay Opaklık ({form.bg_overlay_opacity}%)</label>
              <input
                type="range"
                min={0}
                max={100}
                value={form.bg_overlay_opacity || 70}
                onChange={(e) => setForm((p) => ({ ...p, bg_overlay_opacity: Number(e.target.value) }))}
                className="w-full accent-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Font</label>
              <select
                value={form.font_family || 'serif'}
                onChange={(e) => setForm((p) => ({ ...p, font_family: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
              >
                <option value="serif">Serif</option>
                <option value="sans-serif">Sans-Serif</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Layout</label>
              <select
                value={form.layout || 'cinema'}
                onChange={(e) => setForm((p) => ({ ...p, layout: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
              >
                <option value="cinema">Sinema</option>
                <option value="minimal">Minimal</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Arka Plan Görseli</label>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-300 transition hover:border-amber-500 hover:text-white">
                <ImagePlus size={16} />
                {uploading ? 'Yükleniyor...' : 'Görsel Seç'}
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
              {form.bg_image_url && (
                <span className="text-xs text-slate-400 truncate max-w-[200px]">{form.bg_image_url}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="is_default"
              type="checkbox"
              checked={!!form.is_default}
              onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-amber-500"
            />
            <label htmlFor="is_default" className="text-sm text-slate-300">Varsayılan şablon yap</label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Bouquet (Otomatik Ekle)</label>
              <select
                value={form.bouquet_id ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, bouquet_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
              >
                <option value="">— Seçme —</option>
                {(bouquets || []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Sunucu (FFmpeg)</label>
              <select
                value={form.server_id ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, server_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
              >
                <option value="">— Ana Sunucu —</option>
                {(servers || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.ip_address})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          {editing && (
            <button
              onClick={() => {
                deleteMut.mutate(editing.id)
                setEditing(null)
              }}
              className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
            >
              <Trash2 size={16} className="inline mr-1" />
              Sil
            </button>
          )}
          <button
            onClick={() => setEditing(null)}
            className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-500"
            style={{ backgroundColor: form.primary_color }}
          >
            <Check size={16} className="inline mr-1" />
            Kaydet
          </button>
        </div>

        <div className="mt-6 border-t border-slate-700 pt-4">
          <h3 className="mb-2 text-sm font-medium text-slate-300">Mevcut Şablonlar</h3>
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                  selectedTemplate?.id === t.id
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                    : 'border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  {t.is_default && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                      Varsayılan
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!t.is_default && (
                    <button
                      onClick={() => setDefaultMut.mutate(t.id)}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                      title="Varsayılan yap"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setEditing(t)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                    title="Düzenle"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onSelect(t)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                    title="Kullan"
                  >
                    <MonitorPlay size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── NowPlayingPage ───────────────────────────────────────────────────────────

export default function NowPlayingPage() {
  const [showManager, setShowManager] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<InfoScreenTemplate | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const queryClient = useQueryClient()

  const { data: channels, isLoading } = useQuery({
    queryKey: ['now-playing'],
    queryFn: nowPlayingApi.getNowPlaying,
    refetchInterval: 30_000,
    staleTime: 25_000,
  })

  const { data: templates } = useQuery({
    queryKey: ['info-screen-templates'],
    queryFn: nowPlayingApi.listTemplates,
  })

  const { data: streamStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['info-screen-stream-status'],
    queryFn: nowPlayingApi.getStreamStatus,
    refetchInterval: 10_000,
    staleTime: 8_000,
  })

  const startStreamMut = useMutation({
    mutationFn: nowPlayingApi.startStream,
    onSuccess: () => {
      setTimeout(() => refetchStatus(), 2000)
      queryClient.invalidateQueries({ queryKey: ['info-screen-stream-status'] })
    },
  })

  const stopStreamMut = useMutation({
    mutationFn: nowPlayingApi.stopStream,
    onSuccess: () => {
      setTimeout(() => refetchStatus(), 1000)
      queryClient.invalidateQueries({ queryKey: ['info-screen-stream-status'] })
    },
  })

  useEffect(() => {
    if (templates && !selectedTemplate) {
      const def = templates.find((t) => t.is_default) || templates[0]
      if (def) setSelectedTemplate(def)
    }
  }, [templates, selectedTemplate])

  const template = selectedTemplate

  const fontClass = useMemo(() => {
    switch (template?.font_family) {
      case 'serif':
        return 'font-serif'
      case 'monospace':
        return 'font-mono'
      default:
        return 'font-sans'
    }
  }, [template?.font_family])

  const layout = template?.layout || 'cinema'
  const primaryColor = template?.primary_color || '#D4A843'
  const overlayOpacity = (template?.bg_overlay_opacity ?? 70) / 100

  const isCinema = layout === 'cinema'
  const isDark = layout === 'dark'
  const isMinimal = layout === 'minimal'

  const bgClass = isMinimal
    ? 'bg-slate-50 text-slate-900'
    : isDark
      ? 'bg-[#0a0a0f] text-white'
      : 'bg-[#0f0f1a] text-white'

  const cardBg = isMinimal
    ? 'bg-white/80 border-slate-200'
    : isDark
      ? 'bg-white/5 border-white/10'
      : 'bg-black/30 border-white/10'

  const textMuted = isMinimal ? 'text-slate-500' : 'text-white/50'
  const textSub = isMinimal ? 'text-slate-600' : 'text-white/70'

  return (
    <div className={`relative min-h-screen w-full overflow-hidden ${bgClass} ${fontClass}`}>
      {/* Background image */}
      {template?.bg_image_url && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${template.bg_image_url})` }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: isMinimal ? '#f8fafc' : '#000000',
              opacity: overlayOpacity,
            }}
          />
        </>
      )}

      {/* Cinema decorations */}
      {isCinema && (
        <>
          <FilmReel className="absolute -right-8 top-12 h-48 w-48 text-amber-400/10" />
          <FilmReel className="absolute -left-6 bottom-16 h-40 w-40 text-amber-400/10" />
          <Clapperboard className="absolute right-8 bottom-8 h-24 w-24 text-amber-400/10" />
        </>
      )}

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 md:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div
              className="mb-1 text-xs font-bold uppercase tracking-[0.3em]"
              style={{ color: primaryColor }}
            >
              {template?.subtitle_text || 'SİNEMA KANALLARI'}
            </div>
            <h1
              className="text-3xl font-bold tracking-tight md:text-4xl"
              style={{ color: primaryColor }}
            >
              {template?.title_text || 'ŞU ANDA YAYINDA OLANLAR'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
              <RefreshCw size={12} className="animate-spin" style={{ animationDuration: '3s' }} />
              30sn'de yenilenir
            </div>
            <button
              onClick={() => setShowManager(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <Settings size={16} />
              Şablonlar
            </button>
          </div>
        </div>

        {/* Info Screen HLS Stream Control Panel */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  streamStatus?.running
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-500/20 text-slate-400'
                }`}
              >
                <Radio size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">Info Ekranı HLS Stream</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      streamStatus?.running
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-slate-500/15 text-slate-400'
                    }`}
                  >
                    {streamStatus?.running ? (
                      <>
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                        Yayında
                      </>
                    ) : (
                      'Durduruldu'
                    )}
                  </span>
                </div>
                {streamStatus?.stream_url ? (
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className="text-[11px] text-white/40 truncate max-w-[320px]">
                      {streamStatus.stream_url}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(streamStatus.stream_url!)
                        setCopiedUrl(true)
                        setTimeout(() => setCopiedUrl(false), 2000)
                      }}
                      className="ml-1 rounded p-0.5 text-white/30 hover:text-white/70"
                      title="URL'yi kopyala"
                    >
                      {copiedUrl ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                ) : (
                  <div className="mt-0.5 text-[11px] text-white/30">
                    Stream başlatıldığında M3U'ya eklenebilir kanal olur
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {streamStatus?.running ? (
                <button
                  onClick={() => stopStreamMut.mutate()}
                  disabled={stopStreamMut.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/25 disabled:opacity-50"
                >
                  <Square size={14} fill="currentColor" />
                  {stopStreamMut.isPending ? 'Durduruluyor...' : 'Durdur'}
                </button>
              ) : (
                <button
                  onClick={() => startStreamMut.mutate()}
                  disabled={startStreamMut.isPending}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Play size={14} fill="currentColor" />
                  {startStreamMut.isPending ? 'Başlatılıyor...' : 'Stream Başlat'}
                </button>
              )}
            </div>
          </div>

          {streamStatus?.stream_url && (
            <div className="mt-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                M3U Satırı (Bouquet'e ekle)
              </div>
              <div className="font-mono text-[11px] text-emerald-300/80 break-all">
                {'#EXTINF:-1 tvg-name="Info Ekranı" group-title="Info",Info Ekranı'}
              </div>
              <div className="font-mono text-[11px] text-amber-300/80">
                {streamStatus.stream_url}
              </div>
            </div>
          )}
        </div>

        {/* Channel list */}
        <div className={`rounded-3xl border backdrop-blur-sm ${cardBg}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isMinimal ? 'border-slate-200' : 'border-white/10'}`}>
                  <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
                    #
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
                    Kanal
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
                    Durum
                  </th>
                  <th className={`px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
                    Şu An Yayında
                  </th>
                  <th className="px-6 py-4 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading && (
                  <tr>
                    <td colSpan={5} className={`px-6 py-12 text-center ${textSub}`}>
                      Yükleniyor...
                    </td>
                  </tr>
                )}
                {!isLoading && (!channels || channels.length === 0) && (
                  <tr>
                    <td colSpan={5} className={`px-6 py-12 text-center ${textSub}`}>
                      Henüz VOD kanalı bulunmuyor.
                    </td>
                  </tr>
                )}
                {channels?.map((ch) => (
                  <ChannelRow
                    key={ch.playlist_id}
                    channel={ch}
                    primaryColor={primaryColor}
                    isMinimal={isMinimal}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer count */}
        <div className={`mt-6 text-center text-xs ${textMuted}`}>
          Toplam {channels?.length || 0} kanal
        </div>
      </div>

      {/* Template Manager Modal */}
      <TemplateManagerModal
        open={showManager}
        onClose={() => setShowManager(false)}
        templates={templates || []}
        selectedTemplate={selectedTemplate}
        onSelect={(t) => {
          setSelectedTemplate(t)
          setShowManager(false)
        }}
      />
    </div>
  )
}

// ── Channel Row ──────────────────────────────────────────────────────────────

function ChannelRow({
  channel,
  primaryColor,
  isMinimal,
}: {
  channel: NowPlayingChannel
  primaryColor: string
  isMinimal: boolean
}) {
  const isPlaying = channel.status === 'playing' && channel.current_title

  const statusBadge = isPlaying
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    : 'bg-slate-500/15 text-slate-400 border-slate-500/20'

  const numberStyle = {
    color: primaryColor,
    textShadow: isMinimal ? 'none' : `0 0 20px ${primaryColor}33`,
  }

  return (
    <tr className="group transition hover:bg-white/[0.03]">
      <td className="px-6 py-4">
        <span className="text-2xl font-bold tabular-nums" style={numberStyle}>
          {String(channel.channel_number).padStart(2, '0')}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
            style={{
              backgroundColor: isMinimal ? `${primaryColor}15` : `${primaryColor}22`,
              color: primaryColor,
            }}
          >
            {channel.playlist_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className={`text-sm font-semibold ${isMinimal ? 'text-slate-800' : 'text-white'}`}>
              {channel.playlist_name}
            </div>
            {channel.stream_url && (
              <div className="mt-0.5 text-[11px] text-white/30 truncate max-w-[200px]">
                {channel.stream_url}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${statusBadge}`}
        >
          {isPlaying ? <Play size={10} /> : <Pause size={10} />}
          {isPlaying ? 'Yayında' : 'Durdu'}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {channel.current_poster && (
            <img
              src={channel.current_poster}
              alt=""
              className="h-12 w-8 shrink-0 rounded-lg object-cover shadow-md"
            />
          )}
          <div>
            <div className={`text-sm font-medium ${isMinimal ? 'text-slate-800' : 'text-white'}`}>
              {channel.current_title || '—'}
            </div>
            {channel.current_overview && (
              <div className="mt-0.5 max-w-[280px] truncate text-[11px] text-white/40">
                {channel.current_overview}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        {channel.stream_url && (
          <a
            href={channel.stream_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-xl p-2.5 transition"
            style={{
              backgroundColor: isMinimal ? `${primaryColor}15` : `${primaryColor}22`,
              color: primaryColor,
            }}
            title="Oynat"
          >
            <Play size={16} fill="currentColor" />
          </a>
        )}
      </td>
    </tr>
  )
}
