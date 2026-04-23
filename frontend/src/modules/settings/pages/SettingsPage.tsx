import { ChangeEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Download, Eraser, ImagePlus, KeyRound, Plus, RefreshCcw, Server, Settings, Settings2, Shield, ShieldAlert, Trash2, UploadCloud, X, Youtube, XCircle, AlertTriangle } from 'lucide-react'
import { useForm, UseFormRegisterReturn } from 'react-hook-form'
import {
  DownloadSettingsPayload,
  settingsApi,
  ThemeSettingsPayload,
  TmdbSettingsPayload,
  YoutubeLoginPayload,
} from '../services/settingsApi'
import { defaultBrandingTheme, useBrandingStore } from '../../../store/brandingStore'
import { VpnClient, VpnClientCreate, VpnServerConfig, vpnApi } from '../../vpn/services/vpnApi'

type SettingsTab = 'theme' | 'tmdb' | 'youtube' | 'downloads' | 'vpn'

const tabs: Array<{ id: SettingsTab; label: string }> = [
  { id: 'theme', label: 'Tema Ayarlari' },
  { id: 'tmdb', label: 'TMDB API Ayarlari' },
  { id: 'youtube', label: 'YouTube Cookies' },
  { id: 'downloads', label: 'Indirme Ayarlari' },
  { id: 'vpn', label: 'VPN Istemcileri' },
]

const tmdbLanguages = [
  { value: 'tr-TR', label: 'Turkce (tr-TR)' },
  { value: 'en-US', label: 'English (en-US)' },
  { value: 'de-DE', label: 'Deutsch (de-DE)' },
  { value: 'fr-FR', label: 'Francais (fr-FR)' },
  { value: 'es-ES', label: 'Espanol (es-ES)' },
  { value: 'it-IT', label: 'Italiano (it-IT)' },
]

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }
  return new Date(value).toLocaleString('tr-TR')
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<SettingsTab>('theme')

  const themeQuery = useQuery({
    queryKey: ['settings-theme'],
    queryFn: settingsApi.getTheme,
  })

  const tmdbQuery = useQuery({
    queryKey: ['settings-tmdb'],
    queryFn: settingsApi.getTmdb,
  })

  const youtubeQuery = useQuery({
    queryKey: ['settings-youtube'],
    queryFn: settingsApi.getYoutube,
    refetchInterval: 30000,
  })

  const downloadSettingsQuery = useQuery({
    queryKey: ['settings-downloads'],
    queryFn: settingsApi.getDownloadSettings,
  })

  const themeMutation = useMutation({
    mutationFn: settingsApi.updateTheme,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings-theme'], data)
    },
  })

  const logoUploadMutation = useMutation({
    mutationFn: settingsApi.uploadLogo,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings-theme'], data)
    },
  })

  const logoDeleteMutation = useMutation({
    mutationFn: settingsApi.deleteLogo,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings-theme'], data)
    },
  })

  const tmdbMutation = useMutation({
    mutationFn: settingsApi.updateTmdb,
    onSuccess: (data) => queryClient.setQueryData(['settings-tmdb'], data),
  })

  const tmdbTestMutation = useMutation({
    mutationFn: settingsApi.testTmdb,
  })

  const youtubeLoginMutation = useMutation({
    mutationFn: settingsApi.loginYoutube,
    onSuccess: (data) => queryClient.setQueryData(['settings-youtube'], data),
  })

  const youtubeRefreshMutation = useMutation({
    mutationFn: settingsApi.refreshYoutube,
    onSuccess: (data) => queryClient.setQueryData(['settings-youtube'], data),
  })

  const youtubeDeleteMutation = useMutation({
    mutationFn: settingsApi.deleteYoutube,
    onSuccess: (data) => queryClient.setQueryData(['settings-youtube'], data),
  })

  const youtubeTextMutation = useMutation({
    mutationFn: settingsApi.uploadYoutubeCookiesText,
    onSuccess: (data) => queryClient.setQueryData(['settings-youtube'], data),
  })

  const youtubeFileMutation = useMutation({
    mutationFn: settingsApi.uploadYoutubeCookiesFile,
    onSuccess: (data) => queryClient.setQueryData(['settings-youtube'], data),
  })

  const downloadSettingsMutation = useMutation({
    mutationFn: settingsApi.updateDownloadSettings,
    onSuccess: (data) => queryClient.setQueryData(['settings-downloads'], data),
  })

  return (
    <div className="space-y-6">
      <section className="glass-panel p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Sistem Yapilandirma</div>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Ayarlar</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Panel gorunumu, TMDB entegrasyonu ve YouTube cookies surecini tek ekrandan yonetin.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
            Son guncelleme: {formatDate(youtubeQuery.data?.updated_at ?? null)}
          </div>
        </div>
      </section>

      <section className="glass-panel overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${activeTab === tab.id ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              style={activeTab === tab.id ? { backgroundColor: 'var(--vm-primary)' } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'theme' && (
            <ThemeTab
              data={themeQuery.data}
              isLoading={themeQuery.isLoading}
              isSaving={themeMutation.isPending}
              onSave={(payload) => themeMutation.mutate(payload)}
              onUploadLogo={(file) => logoUploadMutation.mutate(file)}
              onDeleteLogo={() => logoDeleteMutation.mutate()}
              uploadPending={logoUploadMutation.isPending}
              deletePending={logoDeleteMutation.isPending}
            />
          )}

          {activeTab === 'tmdb' && (
            <TmdbTab
              data={tmdbQuery.data}
              isLoading={tmdbQuery.isLoading}
              isSaving={tmdbMutation.isPending}
              testResult={tmdbTestMutation.data}
              testError={(tmdbTestMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? null}
              testPending={tmdbTestMutation.isPending}
              onSave={(payload) => tmdbMutation.mutate(payload)}
              onTest={() => tmdbTestMutation.mutate()}
            />
          )}

          {activeTab === 'youtube' && (
            <YoutubeTab
              data={youtubeQuery.data}
              isLoading={youtubeQuery.isLoading}
              loginPending={youtubeLoginMutation.isPending}
              refreshPending={youtubeRefreshMutation.isPending}
              deletePending={youtubeDeleteMutation.isPending}
              textPending={youtubeTextMutation.isPending}
              filePending={youtubeFileMutation.isPending}
              onLogin={(payload) => youtubeLoginMutation.mutate(payload)}
              onRefresh={() => youtubeRefreshMutation.mutate()}
              onDelete={() => youtubeDeleteMutation.mutate()}
              onUploadText={(cookiesText) => youtubeTextMutation.mutate(cookiesText)}
              onUploadFile={(file) => youtubeFileMutation.mutate(file)}
            />
          )}

          {activeTab === 'downloads' && (
            <DownloadSettingsTab
              data={downloadSettingsQuery.data}
              isLoading={downloadSettingsQuery.isLoading}
              isSaving={downloadSettingsMutation.isPending}
              onSave={(payload) => downloadSettingsMutation.mutate(payload)}
            />
          )}

          {activeTab === 'vpn' && <VpnTab />}
        </div>
      </section>
    </div>
  )
}

function ThemeTab({
  data,
  isLoading,
  isSaving,
  onSave,
  onUploadLogo,
  onDeleteLogo,
  uploadPending,
  deletePending,
}: {
  data: {
    panel_name: string
    logo_url: string | null
    primary_color: string
    sidebar_color: string
    accent_color: string
  } | undefined
  isLoading: boolean
  isSaving: boolean
  onSave: (payload: ThemeSettingsPayload) => void
  onUploadLogo: (file: File) => void
  onDeleteLogo: () => void
  uploadPending: boolean
  deletePending: boolean
}) {
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const setThemeStore = useBrandingStore((state) => state.setTheme)
  const { register, handleSubmit, reset, watch } = useForm<ThemeSettingsPayload>({
    defaultValues: defaultBrandingTheme,
  })

  useEffect(() => {
    if (data) {
      reset({
        panel_name: data.panel_name,
        primary_color: data.primary_color,
        sidebar_color: data.sidebar_color,
        accent_color: data.accent_color,
      })
      setThemeStore(data)
    }
  }, [data, reset, setThemeStore])

  const values = watch()
  const effectiveLogo = logoPreview ?? data?.logo_url ?? null

  const liveTheme = useMemo(() => ({
    panel_name: values.panel_name || defaultBrandingTheme.panel_name,
    logo_url: effectiveLogo,
    primary_color: values.primary_color || defaultBrandingTheme.primary_color,
    sidebar_color: values.sidebar_color || defaultBrandingTheme.sidebar_color,
    accent_color: values.accent_color || defaultBrandingTheme.accent_color,
  }), [effectiveLogo, values.accent_color, values.panel_name, values.primary_color, values.sidebar_color])

  useEffect(() => {
    setThemeStore(liveTheme)
  }, [liveTheme, setThemeStore])

  if (isLoading) {
    return <div className="rounded-3xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">Tema ayarlari yukleniyor...</div>
  }

  return (
    <form onSubmit={handleSubmit(onSave)} className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
      <div className="space-y-6">
        <div className="glass-panel p-5">
          <div className="mb-4 flex items-center gap-3">
            <Settings2 size={18} className="vm-primary-text" />
            <h3 className="text-lg font-semibold text-slate-900">Panel Kimligi</h3>
          </div>
          <label className="panel-label">Panel Adi</label>
          <input className="panel-input" {...register('panel_name', { required: true })} />
        </div>

        <div className="glass-panel p-5">
          <div className="mb-4 flex items-center gap-3">
            <ImagePlus size={18} className="vm-primary-text" />
            <h3 className="text-lg font-semibold text-slate-900">Logo</h3>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
              {effectiveLogo ? (
                <img src={effectiveLogo} alt="Logo onizleme" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-slate-400">Logo</span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="secondary-button cursor-pointer">
                <UploadCloud size={16} />
                {uploadPending ? 'Yukleniyor...' : 'Logo Yukle'}
                <input
                  type="file"
                  accept=".png,.svg,image/png,image/svg+xml"
                  className="hidden"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const file = event.target.files?.[0]
                    if (!file) {
                      return
                    }
                    setLogoPreview(URL.createObjectURL(file))
                    onUploadLogo(file)
                  }}
                />
              </label>
              <button type="button" onClick={onDeleteLogo} className="danger-button" disabled={deletePending}>
                <Trash2 size={16} />
                Varsayilana Don
              </button>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5">
          <div className="mb-4 flex items-center gap-3">
            <Eraser size={18} className="vm-primary-text" />
            <h3 className="text-lg font-semibold text-slate-900">Renk Ayarlari</h3>
          </div>
            <div className="grid gap-4 sm:grid-cols-3">
            <ColorField label="Primary" field={register('primary_color')} />
            <ColorField label="Sidebar" field={register('sidebar_color')} />
            <ColorField label="Accent" field={register('accent_color')} />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" className="primary-button" disabled={isSaving}>
              {isSaving ? 'Kaydediliyor...' : 'Tema Ayarlarini Kaydet'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                reset(defaultBrandingTheme)
                setThemeStore(defaultBrandingTheme)
              }}
            >
              Varsayilana Sifirla
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel p-5">
        <h3 className="text-lg font-semibold text-slate-900">Canli Onizleme</h3>
        <div className="mt-4 rounded-[28px] border border-slate-200 bg-white p-4">
          <div className="flex min-h-[420px] overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
            <div className="w-[220px] p-4 text-white" style={{ backgroundColor: liveTheme.sidebar_color }}>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl" style={{ backgroundColor: liveTheme.primary_color }}>
                  {effectiveLogo ? (
                    <img src={effectiveLogo} alt={liveTheme.panel_name} className="h-full w-full object-cover" />
                  ) : (
                    liveTheme.panel_name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-white/50">Preview</div>
                  <div className="text-sm font-semibold">{liveTheme.panel_name}</div>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="rounded-2xl px-4 py-3 text-sm text-white" style={{ backgroundColor: liveTheme.primary_color }}>Dashboard</div>
                <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/70">Sunucular</div>
                <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/70">Ayarlar</div>
              </div>
            </div>
            <div className="flex-1 p-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">Panel Basligi</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{liveTheme.panel_name}</div>
                <div className="mt-5 flex gap-3">
                  <div className="rounded-2xl px-4 py-3 text-sm font-semibold text-white" style={{ backgroundColor: liveTheme.primary_color }}>Primary</div>
                  <div className="rounded-2xl px-4 py-3 text-sm font-semibold text-white" style={{ backgroundColor: liveTheme.accent_color }}>Accent</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}

function TmdbTab({
  data,
  isLoading,
  isSaving,
  testResult,
  testError,
  testPending,
  onSave,
  onTest,
}: {
  data: {
    api_key_masked: string | null
    has_api_key: boolean
    language: string
  } | undefined
  isLoading: boolean
  isSaving: boolean
  testResult: {
    success: boolean
    message: string
    language: string
    sample_title: string | null
  } | undefined
  testError: string | null
  testPending: boolean
  onSave: (payload: TmdbSettingsPayload) => void
  onTest: () => void
}) {
  const { register, handleSubmit, reset } = useForm<TmdbSettingsPayload>({
    defaultValues: { api_key: '', language: 'tr-TR' },
  })

  useEffect(() => {
    if (data) {
      reset({
        api_key: '',
        language: data.language,
      })
    }
  }, [data, reset])

  if (isLoading) {
    return <div className="rounded-3xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">TMDB ayarlari yukleniyor...</div>
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr,0.9fr]">
      <form onSubmit={handleSubmit(onSave)} className="glass-panel p-5">
        <div className="mb-4 flex items-center gap-3">
          <KeyRound size={18} className="vm-primary-text" />
          <h3 className="text-lg font-semibold text-slate-900">TMDB API</h3>
        </div>
        <label className="panel-label">API Key</label>
        <input
          type="password"
          className="panel-input"
          placeholder={data?.api_key_masked ?? 'TMDB API key girin'}
          {...register('api_key')}
        />
        <p className="mt-2 text-xs text-slate-500">
          Mevcut key: {data?.api_key_masked ?? 'Kayitli degil'}
        </p>

        <div className="mt-5">
          <label className="panel-label">TMDB Dili</label>
          <select className="panel-select" {...register('language')}>
            {tmdbLanguages.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="submit" className="primary-button" disabled={isSaving}>
            {isSaving ? 'Kaydediliyor...' : 'TMDB Ayarlarini Kaydet'}
          </button>
          <button type="button" className="secondary-button" onClick={onTest} disabled={testPending}>
            <RefreshCcw size={16} />
            {testPending ? 'Test ediliyor...' : 'Baglanti Test Et'}
          </button>
        </div>
      </form>

      <div className="glass-panel p-5">
        <h3 className="text-lg font-semibold text-slate-900">Durum</h3>
        <div className="mt-4 space-y-4">
          <StatusCard
            icon={<CheckCircle2 size={18} />}
            tone="emerald"
            title="Kayit Durumu"
            description={data?.has_api_key ? 'TMDB API key kayitli durumda.' : 'Henüz TMDB API key kaydedilmedi.'}
          />

          {testResult && (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              <div className="font-semibold">{testResult.message}</div>
              <div className="mt-1">Dil: {testResult.language}</div>
              <div className="mt-1">Ornek icerik: {testResult.sample_title ?? 'Bulunamadi'}</div>
            </div>
          )}

          {testError && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {testError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function YoutubeTab({
  data,
  isLoading,
  loginPending,
  refreshPending,
  deletePending,
  textPending,
  filePending,
  onLogin,
  onRefresh,
  onDelete,
  onUploadText,
  onUploadFile,
}: {
  data: {
    email: string | null
    mode: 'automatic' | 'manual' | null
    status: 'active' | 'expired' | 'error'
    last_refresh_at: string | null
    next_refresh_at: string | null
    error_message: string | null
    cookies_available: boolean
    has_credentials: boolean
    updated_at: string | null
    message: string | null
  } | undefined
  isLoading: boolean
  loginPending: boolean
  refreshPending: boolean
  deletePending: boolean
  textPending: boolean
  filePending: boolean
  onLogin: (payload: YoutubeLoginPayload) => void
  onRefresh: () => void
  onDelete: () => void
  onUploadText: (cookiesText: string) => void
  onUploadFile: (file: File) => void
}) {
  const [mode, setMode] = useState<'manual' | 'automatic'>('manual')
  const [manualCookies, setManualCookies] = useState('')
  const { register, handleSubmit, reset } = useForm<YoutubeLoginPayload>({
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    if (data?.email) {
      reset({ email: data.email, password: '' })
    }
  }, [data?.email, reset])

  useEffect(() => {
    if (data?.mode === 'automatic' || data?.mode === 'manual') {
      setMode(data.mode)
    }
  }, [data?.mode])

  if (isLoading) {
    return <div className="rounded-3xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">YouTube ayarlari yukleniyor...</div>
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
      <div className="space-y-4">
        <div className="glass-panel p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Youtube size={18} className="text-rose-500" />
            <h3 className="text-lg font-semibold text-slate-900">YouTube Cookies Modu</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`rounded-3xl border px-4 py-4 text-left transition ${mode === 'manual' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="font-semibold text-slate-900">Mod 1: Manuel cookies yukle</div>
              <div className="mt-1 text-sm leading-6 text-slate-500">Birincil ve daha guvenilir yontem. Netscape cookies metni yapistirin veya dosya yukleyin.</div>
            </button>
            <button
              type="button"
              onClick={() => setMode('automatic')}
              className={`rounded-3xl border px-4 py-4 text-left transition ${mode === 'automatic' ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <div className="font-semibold text-slate-900">Mod 2: Otomatik giris</div>
              <div className="mt-1 text-sm leading-6 text-slate-500">Playwright ile Google girisi dener. 2FA ve CAPTCHA durumunda basarisiz olabilir.</div>
            </button>
          </div>
        </div>

        {mode === 'manual' ? (
          <div className="glass-panel p-5">
            <div className="mb-4 flex items-center gap-3">
              <UploadCloud size={18} className="vm-primary-text" />
              <h3 className="text-lg font-semibold text-slate-900">Manuel cookies yukleme</h3>
            </div>
            <label className="panel-label">Netscape cookies metni</label>
            <textarea
              className="panel-textarea"
              placeholder="# Netscape HTTP Cookie File&#10;.youtube.com	TRUE	/	TRUE	0	VISITOR_INFO1_LIVE	..."
              value={manualCookies}
              onChange={(event) => setManualCookies(event.target.value)}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="primary-button"
                disabled={textPending || manualCookies.trim().length < 20}
                onClick={() => onUploadText(manualCookies)}
              >
                {textPending ? 'Kaydediliyor...' : 'Metni Kaydet'}
              </button>
              <label className="secondary-button cursor-pointer">
                {filePending ? 'Yukleniyor...' : 'Cookies Dosyasi Yukle'}
                <input
                  type="file"
                  accept=".txt,.cookies,text/plain"
                  className="hidden"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const file = event.target.files?.[0]
                    if (!file) {
                      return
                    }
                    onUploadFile(file)
                  }}
                />
              </label>
              <button type="button" className="danger-button" onClick={onDelete} disabled={deletePending}>
                <Trash2 size={16} />
                Cookies Sil
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onLogin)} className="glass-panel p-5">
            <div className="mb-4 flex items-center gap-3">
              <Youtube size={18} className="text-rose-500" />
              <h3 className="text-lg font-semibold text-slate-900">YouTube Hesap Girisi</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="panel-label">Email</label>
                <input type="email" className="panel-input" {...register('email', { required: true })} />
              </div>
              <div>
                <label className="panel-label">Sifre</label>
                <input type="password" className="panel-input" {...register('password', { required: true })} />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" className="primary-button" disabled={loginPending}>
                {loginPending ? 'Giris yapiliyor...' : 'Giris Yap ve Cookies Al'}
              </button>
              <button type="button" className="secondary-button" onClick={onRefresh} disabled={refreshPending}>
                <RefreshCcw size={16} />
                {refreshPending ? 'Yenileniyor...' : 'Simdi Yenile'}
              </button>
              <button type="button" className="danger-button" onClick={onDelete} disabled={deletePending}>
                <Trash2 size={16} />
                Cookies Sil
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="space-y-4">
        <StatusCard
          icon={data?.status === 'active' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
          tone={data?.status === 'active' ? 'emerald' : 'amber'}
          title="Cookies Durumu"
          description={data?.cookies_available ? 'Cookies dosyasi hazir ve backend tarafinda erisilebilir.' : 'Cookies dosyasi henuz hazir degil.'}
        />

        <div className="glass-panel p-5">
          <h3 className="text-lg font-semibold text-slate-900">Otomatik Yenileme</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-600">
            <InfoRow label="Durum" value={data?.status ?? 'expired'} />
            <InfoRow label="Mod" value={data?.mode === 'manual' ? 'Manuel cookies' : 'Otomatik giris'} />
            <InfoRow label="Email" value={data?.email ?? 'Kayitli degil'} />
            <InfoRow label="Son alinma" value={formatDate(data?.last_refresh_at ?? null)} />
            <InfoRow label="Sonraki yenileme" value={formatDate(data?.next_refresh_at ?? null)} />
            <InfoRow label="Credentials" value={data?.has_credentials ? 'Kayitli' : 'Kayitli degil'} />
          </div>

          {data?.message && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {data.message}
            </div>
          )}

          {data?.error_message && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {data.error_message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DownloadSettingsTab({
  data,
  isLoading,
  isSaving,
  onSave,
}: {
  data: {
    max_concurrent_downloads: number
    max_download_speed_mbps: number
    default_download_directory: string
  } | undefined
  isLoading: boolean
  isSaving: boolean
  onSave: (payload: DownloadSettingsPayload) => void
}) {
  const { register, handleSubmit, reset, watch } = useForm<DownloadSettingsPayload>({
    defaultValues: {
      max_concurrent_downloads: 1,
      max_download_speed_mbps: 0,
    },
  })

  useEffect(() => {
    if (data) {
      reset({
        max_concurrent_downloads: data.max_concurrent_downloads,
        max_download_speed_mbps: data.max_download_speed_mbps,
      })
    }
  }, [data, reset])

  const concurrentDownloads = watch('max_concurrent_downloads')

  if (isLoading) {
    return <div className="rounded-3xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">Indirme ayarlari yukleniyor...</div>
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr,0.95fr]">
      <form onSubmit={handleSubmit(onSave)} className="glass-panel p-5">
        <div className="mb-4 flex items-center gap-3">
          <Download size={18} className="vm-primary-text" />
          <h3 className="text-lg font-semibold text-slate-900">Indirme ayarlari</h3>
        </div>

        <div>
          <label className="panel-label">Ayni anda maksimum indirme sayisi</label>
          <input type="range" min={1} max={5} className="w-full" {...register('max_concurrent_downloads', { valueAsNumber: true })} />
          <div className="mt-2 text-sm text-slate-500">Secilen deger: {concurrentDownloads}</div>
        </div>

        <div className="mt-5">
          <label className="panel-label">Maksimum indirme hizi (MB/s, 0 = sinirsiz)</label>
          <input type="number" step="0.1" min={0} className="panel-input" {...register('max_download_speed_mbps', { valueAsNumber: true })} />
        </div>

        <div className="mt-5">
          <label className="panel-label">Varsayilan indirme dizini</label>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {data?.default_download_directory}
          </div>
        </div>

        <div className="mt-5">
          <button type="submit" className="primary-button" disabled={isSaving}>
            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>

      <div className="glass-panel p-5">
        <h3 className="text-lg font-semibold text-slate-900">Bilgi</h3>
        <div className="mt-4 space-y-4">
          <StatusCard
            icon={<CheckCircle2 size={18} />}
            tone="emerald"
            title="Kuyruk yonetimi"
            description="Onaylanan indirmeler worker tarafinda secilen limit kadar paralel baslar ve bitince siradaki otomatik devreye girer."
          />
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            YouTube indirmelerinde cookies dosyasi varsa otomatik olarak yt-dlp komutuna eklenir. Hiz limiti MB/s cinsinden uygulanir.
          </div>
        </div>
      </div>
    </div>
  )
}

function ColorField({
  label,
  field,
}: {
  label: string
  field: UseFormRegisterReturn
}) {
  return (
    <label className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <span className="mb-3 block text-sm font-medium text-slate-700">{label}</span>
      <input type="color" className="h-14 w-full rounded-2xl border border-slate-200 bg-white p-1" name={field.name} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} />
    </label>
  )
}

function StatusCard({
  icon,
  tone,
  title,
  description,
}: {
  icon: ReactNode
  tone: 'emerald' | 'amber'
  title: string
  description: string
}) {
  const classes = tone === 'emerald'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700'

  return (
    <div className={`glass-panel p-5 ${classes}`}>
      <div className="flex items-center gap-3">
        {icon}
        <div className="text-base font-semibold">{title}</div>
      </div>
      <p className="mt-3 text-sm leading-6">{description}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-slate-500">{label}</div>
      <div className="font-medium text-slate-900">{value}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// VPN Tab
// ---------------------------------------------------------------------------

function formatVpnDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function VpnTab() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VpnClient | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const clientsQuery = useQuery({
    queryKey: ['vpn-clients'],
    queryFn: vpnApi.listClients,
  })

  const createMutation = useMutation({
    mutationFn: (payload: VpnClientCreate) => vpnApi.createClient(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-clients'] })
      setShowCreateModal(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => vpnApi.deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-clients'] })
      setDeleteTarget(null)
    },
  })

  const handleDownload = async (client: VpnClient) => {
    setDownloadingId(client.id)
    try {
      await vpnApi.downloadOvpn(client.id, client.name)
    } catch (e) {
      console.error(e)
    } finally {
      setDownloadingId(null)
    }
  }

  const clients = clientsQuery.data ?? []
  const activeCount = clients.filter((c) => c.is_active).length

  return (
    <div className="space-y-6">
      {/* Stats + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-3">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-center min-w-[80px]">
            <div className="text-2xl font-semibold text-slate-900">{clients.length}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">Toplam</div>
          </div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center min-w-[80px]">
            <div className="text-2xl font-semibold text-emerald-700">{activeCount}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.14em] text-emerald-600">Aktif</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="primary-button"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} />
            Yeni Istemci Olustur
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowConfigModal(true)}
          >
            <Settings size={16} />
            Sunucu Ayarlari
          </button>
        </div>
      </div>

      {/* Clients table */}
      <div className="glass-panel overflow-hidden p-0">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="vm-primary-text" />
            <h3 className="text-base font-semibold text-slate-900">Istemci Listesi</h3>
          </div>
        </div>

        {clientsQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Yukleniyor...</div>
        ) : clientsQuery.isError ? (
          <div className="p-8 text-center text-sm text-rose-500">Istemciler yuklenemedi.</div>
        ) : clients.length === 0 ? (
          <div className="p-10 text-center">
            <Shield size={36} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">Henuz istemci olusturulmadi.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Ad</th>
                  <th className="px-5 py-3">Aciklama</th>
                  <th className="px-5 py-3">Durum</th>
                  <th className="px-5 py-3">Olusturulma</th>
                  <th className="px-5 py-3">Son Kullanim</th>
                  <th className="px-5 py-3 text-right">Islemler</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        <Server size={14} className="shrink-0 text-slate-400" />
                        {client.name}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{client.description || '-'}</td>
                    <td className="px-5 py-3.5">
                      {client.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 size={11} />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                          <XCircle size={11} />
                          Iptal
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{formatVpnDate(client.created_at)}</td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {client.expires_at ? formatVpnDate(client.expires_at) : '-'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {client.is_active && (
                          <button
                            type="button"
                            className="primary-button px-3 py-1.5 text-xs"
                            onClick={() => handleDownload(client)}
                            disabled={downloadingId === client.id}
                          >
                            <Download size={13} />
                            {downloadingId === client.id ? 'Hazirlaniyor...' : '.ovpn Indir'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="danger-button px-3 py-1.5 text-xs"
                          onClick={() => setDeleteTarget(client)}
                        >
                          <Trash2 size={13} />
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Client Modal */}
      {showCreateModal && (
        <VpnCreateClientModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(payload) => createMutation.mutate(payload)}
          isPending={createMutation.isPending}
          error={createMutation.error ? String((createMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Hata olustu') : null}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100">
              <AlertTriangle size={22} className="text-rose-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Istemciyi Sil</h3>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold">{deleteTarget.name}</span> istemcisinin sertifikasi iptal edilecek ve kayit silinecek. Bu islemi geri alamazsiniz.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="secondary-button" onClick={() => setDeleteTarget(null)}>
                <X size={15} /> Iptal
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={15} /> {deleteMutation.isPending ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server Config Modal */}
      {showConfigModal && (
        <VpnServerConfigModal onClose={() => setShowConfigModal(false)} />
      )}
    </div>
  )
}

interface VpnCreateClientModalProps {
  onClose: () => void
  onCreate: (payload: VpnClientCreate) => void
  isPending: boolean
  error: string | null
}

function VpnCreateClientModal({ onClose, onCreate, isPending, error }: VpnCreateClientModalProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<VpnClientCreate>()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Yeni VPN Istemcisi</h3>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onCreate)}>
          <div>
            <label className="panel-label">Istemci Adi *</label>
            <input
              className="panel-input"
              placeholder="Ornek: laptop-ali veya server01"
              {...register('name', {
                required: 'Ad zorunludur',
                pattern: {
                  value: /^[a-zA-Z0-9_-]+$/,
                  message: 'Sadece harf, rakam, tire ve alt cizgi kullanabilirsiniz',
                },
                minLength: { value: 2, message: 'En az 2 karakter' },
                maxLength: { value: 100, message: 'En fazla 100 karakter' },
              })}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="panel-label">Aciklama</label>
            <input
              className="panel-input"
              placeholder="Istege bagli"
              {...register('description')}
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            Sertifika olusturma islemi sunucuda easy-rsa gerektirir. Ilk istek birkas saniye surebilir.
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" className="secondary-button" onClick={onClose}>
              Iptal
            </button>
            <button type="submit" className="primary-button" disabled={isPending}>
              <Plus size={15} />
              {isPending ? 'Olusturuluyor...' : 'Olustur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function VpnServerConfigModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: config, isLoading } = useQuery({
    queryKey: ['vpn-server-config'],
    queryFn: vpnApi.getServerConfig,
  })

  const { register, handleSubmit } = useForm<Omit<VpnServerConfig, 'id' | 'updated_at'>>()

  const updateMutation = useMutation({
    mutationFn: (payload: Omit<VpnServerConfig, 'id' | 'updated_at'>) =>
      vpnApi.updateServerConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-server-config'] })
      onClose()
    },
  })

  if (isLoading || !config) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl text-center text-sm text-slate-500">
          Yukleniyor...
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Sunucu Ayarlari</h3>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form
          className="space-y-3"
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="panel-label">Sunucu IP</label>
              <input className="panel-input" defaultValue={config.server_ip} {...register('server_ip')} />
            </div>
            <div>
              <label className="panel-label">Port</label>
              <input className="panel-input" type="number" defaultValue={config.server_port} {...register('server_port', { valueAsNumber: true })} />
            </div>
          </div>
          <div>
            <label className="panel-label">Protokol</label>
            <select className="panel-select" defaultValue={config.protocol} {...register('protocol')}>
              <option value="udp">UDP</option>
              <option value="tcp">TCP</option>
            </select>
          </div>
          {([
            ['CA Sertifika Yolu', 'ca_cert_path'],
            ['Sunucu Sertifika Yolu', 'server_cert_path'],
            ['Sunucu Anahtar Yolu', 'server_key_path'],
            ['DH Params Yolu', 'dh_params_path'],
            ['TA Anahtar Yolu', 'ta_key_path'],
            ['easy-rsa Dizini', 'easy_rsa_dir'],
            ['Istemciler Dizini', 'clients_dir'],
          ] as [string, keyof Omit<VpnServerConfig, 'id' | 'updated_at'>][]).map(([label, field]) => (
            <div key={field}>
              <label className="panel-label">{label}</label>
              <input
                className="panel-input font-mono text-xs"
                defaultValue={config[field] as string}
                {...register(field)}
              />
            </div>
          ))}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="secondary-button" onClick={onClose}>Iptal</button>
            <button type="submit" className="primary-button" disabled={updateMutation.isPending}>
              <Settings size={15} />
              {updateMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}