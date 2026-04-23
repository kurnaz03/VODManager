import { ChangeEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Download, Eraser, ImagePlus, KeyRound, RefreshCcw, Settings2, ShieldAlert, Trash2, UploadCloud, Youtube } from 'lucide-react'
import { useForm, UseFormRegisterReturn } from 'react-hook-form'
import {
  DownloadSettingsPayload,
  settingsApi,
  ThemeSettingsPayload,
  TmdbSettingsPayload,
  YoutubeLoginPayload,
} from '../services/settingsApi'
import { defaultBrandingTheme, useBrandingStore } from '../../../store/brandingStore'

type SettingsTab = 'theme' | 'tmdb' | 'youtube' | 'downloads'

const tabs: Array<{ id: SettingsTab; label: string }> = [
  { id: 'theme', label: 'Tema Ayarlari' },
  { id: 'tmdb', label: 'TMDB API Ayarlari' },
  { id: 'youtube', label: 'YouTube Cookies' },
  { id: 'downloads', label: 'Indirme Ayarlari' },
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