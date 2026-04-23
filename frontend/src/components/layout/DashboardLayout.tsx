import { ReactNode, useEffect, useMemo, useState } from 'react'
import { Bell, ChevronDown, Menu, PanelLeftClose, PanelLeftOpen, Search, UserCircle2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuthStore } from '../../store/authStore'
import api from '../../utils/api'
import { useBrandingStore } from '../../store/brandingStore'

interface Props {
  children: ReactNode
}

const SIDEBAR_STORAGE_KEY = 'vod-manager-sidebar-collapsed'

export default function DashboardLayout({ children }: Props) {
  const { user, clearAuth } = useAuthStore()
  const theme = useBrandingStore((state) => state.theme)
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true')

  const crumbs = useMemo(() => {
    const labels: Record<string, string> = {
      dashboard: 'Dashboard',
      servers: 'Sunucular',
      categories: 'Icerik Yonetimi',
      movies: 'Movies Kategorileri',
      series: 'Series Kategorileri',
      tv: 'TV Kategorileri',
      radio: 'Radyo Kategorileri',
      bouquets: 'Bouquets',
      downloads: 'Downloader',
      users: 'Kullanicilar',
      settings: 'Ayarlar',
    }
    const parts = location.pathname.split('/').filter(Boolean)
    return parts.map((part, index) => ({
      label: labels[part] ?? `#${part}`,
      path: `/${parts.slice(0, index + 1).join('/')}`,
    }))
  }, [location.pathname])

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    if (isDesktop) {
      setMobileOpen(false)
    }
  }, [isDesktop])

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refresh_token: refreshToken })
      }
    } finally {
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  const handleSidebarToggle = () => {
    if (isDesktop) {
      setSidebarCollapsed((current) => !current)
      return
    }
    setMobileOpen((current) => !current)
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar
          mobileOpen={mobileOpen}
          collapsed={sidebarCollapsed}
          isDesktop={isDesktop}
          onClose={() => setMobileOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={handleSidebarToggle}
                  className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                >
                  {isDesktop ? (
                    sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />
                  ) : (
                    <Menu size={18} />
                  )}
                </button>

                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                    {crumbs.map((crumb, index) => (
                      <span key={crumb.path} className="flex items-center gap-2">
                        {index > 0 && <span className="text-slate-300">/</span>}
                        <span className={index === crumbs.length - 1 ? 'text-slate-700' : ''}>{crumb.label}</span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                      {crumbs[crumbs.length - 1]?.label ?? 'Panel'}
                    </h1>
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ backgroundColor: `${theme.accent_color}1F`, color: theme.accent_color }}
                    >
                      {theme.panel_name}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-[220px] max-w-[360px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Ara: sunucu, kategori, bouquet..."
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <button
                  type="button"
                  className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                >
                  <Bell size={18} />
                  <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-amber-400" />
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileOpen((current) => !current)}
                    className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 text-left transition hover:bg-slate-50"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500 text-white">
                      <UserCircle2 size={18} />
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-sm font-medium text-slate-900">{user?.username}</div>
                      <div className="text-xs text-slate-500">{user?.roles?.join(', ')}</div>
                    </div>
                    <ChevronDown size={16} className="text-slate-400" />
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 top-14 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                      <button
                        type="button"
                        className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        Profil
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                      >
                        Cikis
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}