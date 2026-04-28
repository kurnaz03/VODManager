import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Download,
  Film,
  FolderKanban,
  Layers3,
  LayoutDashboard,
  MonitorDot,
  MonitorPlay,
  Radio,
  Settings,
  Shield,
  ShieldCheck,
  Tv,
  X,
  Sliders,
  ListVideo,
  UserCog,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useBrandingStore } from '../../store/brandingStore'

interface SidebarProps {
  mobileOpen: boolean
  collapsed: boolean
  isDesktop: boolean
  onClose: () => void
}

const groups = [
  {
    label: 'Genel',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/servers', label: 'Sunucular', icon: MonitorDot },
    ],
  },
  {
    label: 'Yonetim',
    items: [
      {
        label: 'Icerik Yonetimi',
        icon: Tv,
        children: [
          { to: '/downloads', label: 'Downloader', icon: Download },
          { to: '/movies', label: 'Movies', icon: Film },
          { to: '/series', label: 'Series', icon: Tv },
          { to: '/tv-channels', label: 'TV Kanallari', icon: MonitorPlay },
          { to: '/radio', label: 'Radyo', icon: Radio },
          { to: '/categories', label: 'Kategoriler', icon: FolderKanban },
          { to: '/transcode', label: 'Transcode', icon: Sliders },
          { to: '/transcode-profiles', label: 'Transcode Profiller', icon: Sliders },
          { to: '/playlists', label: 'VOD Channel', icon: ListVideo },
          { to: '/bouquets', label: 'Bouquets', icon: Layers3 },
        ],
      },
      { to: '/users', label: 'Kullanicilar', icon: Shield },
      { to: '/admin-users', label: 'Yoneticiler', icon: UserCog },
      { to: '/vpn-clients', label: 'VPN Istemcileri', icon: ShieldCheck },
      { to: '/settings', label: 'Ayarlar', icon: Settings },
    ],
  },
]

const ICERIK_PATHS = ['/downloads', '/movies', '/series', '/tv-channels', '/radio', '/categories', '/transcode', '/playlists', '/bouquets']

export default function Sidebar({ mobileOpen, collapsed, isDesktop, onClose }: SidebarProps) {
  const location = useLocation()
  const theme = useBrandingStore((state) => state.theme)
  const isIcerikActive = ICERIK_PATHS.some((p) => location.pathname.startsWith(p))
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'Icerik Yonetimi': isIcerikActive,
  })
  const showCollapsed = isDesktop && collapsed

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-slate-900/35 backdrop-blur-sm transition lg:hidden ${mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 px-3 py-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.24)] transition-all duration-300 lg:static lg:z-auto lg:translate-x-0 ${showCollapsed ? 'lg:w-[72px]' : 'lg:w-[252px]'} ${mobileOpen ? 'w-[260px] translate-x-0' : 'w-[260px] -translate-x-full'}`}
        style={{ backgroundColor: theme.sidebar_color }}
      >
        <div className={`mb-6 flex items-center ${showCollapsed ? 'justify-center' : 'justify-between'} border-b border-white/10 pb-5`}>
          <div className={`flex items-center ${showCollapsed ? 'justify-center' : 'gap-3'} overflow-hidden`}>
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-bold text-white"
              style={{ backgroundColor: theme.primary_color, boxShadow: `0 14px 30px ${theme.primary_color}55` }}
            >
              {theme.logo_url ? (
                <img src={theme.logo_url} alt={theme.panel_name} className="h-full w-full object-cover" />
              ) : (
                theme.panel_name.slice(0, 2).toUpperCase()
              )}
            </div>
            {!showCollapsed && (
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.24em] text-white/50">Control Hub</div>
                <div className="truncate text-base font-semibold text-white">{theme.panel_name}</div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition hover:bg-white/15 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className={`flex-1 space-y-6 overflow-y-auto ${showCollapsed ? '' : 'pr-1'}`}>
          {groups.map((group) => (
            <div key={group.label}>
              {!showCollapsed && (
                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
                  {group.label}
                </div>
              )}
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  if ('children' in item) {
                    const Icon = item.icon
                    const isOpen = expanded[item.label] ?? false
                    if (showCollapsed) {
                      return (
                        <div key={item.label} className="space-y-1">
                          {(item.children ?? []).map((child) => {
                            const ChildIcon = child.icon
                            return (
                              <NavLink
                                key={child.to}
                                to={child.to}
                                onClick={onClose}
                                title={child.label}
                                className={({ isActive }) => `group flex items-center justify-center rounded-2xl px-2 py-3 transition ${isActive ? 'text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                                style={({ isActive }) => ({
                                  backgroundColor: isActive ? theme.primary_color : 'transparent',
                                })}
                              >
                                <span className="flex h-10 w-10 items-center justify-center rounded-2xl">
                                  <ChildIcon size={18} />
                                </span>
                              </NavLink>
                            )
                          })}
                        </div>
                      )
                    }
                    return (
                      <div key={item.label} className="rounded-2xl bg-white/10">
                        <button
                          type="button"
                          onClick={() => setExpanded((current) => ({ ...current, [item.label]: !isOpen }))}
                          className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-white/85 transition hover:bg-white/10"
                        >
                          <span className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white shadow-sm">
                              <Icon size={18} />
                            </span>
                            <span>{item.label}</span>
                          </span>
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        {isOpen && (
                          <div className="space-y-1 px-3 pb-3">
                            {(item.children ?? []).map((child) => (
                              <NavLink
                                key={child.to}
                                to={child.to}
                                onClick={onClose}
                                className={({ isActive }) => `block rounded-xl px-4 py-2.5 text-sm transition ${isActive ? 'text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}
                                style={({ isActive }) => ({
                                  backgroundColor: isActive ? theme.primary_color : 'transparent',
                                })}
                              >
                                {child.label}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }

                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      title={showCollapsed ? item.label : undefined}
                      className={({ isActive }) => `group flex items-center rounded-2xl text-sm transition ${showCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'} ${isActive ? 'text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? theme.primary_color : 'transparent',
                      })}
                    >
                      {({ isActive }) => (
                        <>
                          <span className={`flex h-10 w-10 items-center justify-center rounded-2xl transition ${isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80 group-hover:bg-white/15 group-hover:text-white'}`}>
                            <Icon size={18} />
                          </span>
                          {!showCollapsed && <span className="font-medium">{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {!showCollapsed && (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-white/45">Version</div>
            <div className="mt-2 text-sm text-white/80">v1.0.0-{__GIT_HASH__}</div>
          </div>
        )}
      </aside>
    </>
  )
}
