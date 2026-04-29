import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Clapperboard,
  Cpu,
  Crown,
  Film,
  Grid3X3,
  HardDrive,
  Layers3,
  ListVideo,
  MemoryStick,
  Monitor,
  PlayCircle,
  Radio,
  ServerCog,
  Users,
  Wifi,
} from 'lucide-react'
import StatusBadge from '../../components/ui/StatusBadge'
import MetricBar from '../../components/ui/MetricBar'
import api from '../../utils/api'
import { serversApi } from '../servers/services/serversApi'
import { seriesApi } from '../content/services/contentApi'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (d > 0) parts.push(`${d}g`)
  if (h > 0) parts.push(`${h}s`)
  parts.push(`${m}d`)
  parts.push(`${s}sn`)
  return parts.join(' ')
}

function fmtMbps(mbps: number): string {
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`
  if (mbps >= 1) return `${mbps.toFixed(1)} Mbps`
  return `${(mbps * 1000).toFixed(0)} Kbps`
}

function fmtGB(mb: number): string {
  return `${(mb / 1024).toFixed(1)} GB`
}

// ── Circular Progress (SVG) ───────────────────────────────────────────────────

function CircularProgress({ value, size = 76 }: { value: number; size?: number }) {
  const strokeW = 6
  const r = (size - strokeW * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(Math.max(value, 0), 100) / 100)
  const cx = size / 2
  const cy = size / 2

  return (
    <svg
      width={size}
      height={size}
      style={{ transform: 'rotate(-90deg)' }}
      className="flex-shrink-0"
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={strokeW}
        fill="none"
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="white"
        strokeWidth={strokeW}
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  )
}

// ── Metric Card ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  gradient: string
  icon: React.ReactNode
  title: string
  mainValue: React.ReactNode
  subValue?: React.ReactNode
  percent: number
  badge?: React.ReactNode
}

function MetricCard({ gradient, icon, title, mainValue, subValue, percent, badge }: MetricCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-3xl p-5 text-white ${gradient}`}>
      {/* top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/20">
            {icon}
          </div>
          <span className="text-sm font-medium text-white/90">{title}</span>
        </div>
        {badge}
      </div>

      {/* middle row */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-4xl font-bold leading-none tracking-tight">{mainValue}</div>
          {subValue && (
            <div className="mt-1.5 text-sm text-white/75">{subValue}</div>
          )}
        </div>
        <div className="relative flex flex-col items-center justify-center">
          <CircularProgress value={percent} size={76} />
          <span
            className="absolute text-xs font-semibold"
            style={{ transform: 'none' }}
          >
            {Math.round(percent)}%
          </span>
        </div>
      </div>

      {/* progress bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full bg-white/70"
          style={{ width: `${Math.min(percent, 100)}%`, transition: 'width 0.6s ease' }}
        />
      </div>
    </div>
  )
}

// ── Live Badge ────────────────────────────────────────────────────────────────

function LiveBadge() {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-200">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Live
    </span>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [uptimeTick, setUptimeTick] = useState(0)
  const navigate = useNavigate()

  const dashboardQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const response = await api.get<{
        total_users: number
        total_servers: number
        total_categories: number
        total_bouquets: number
        total_series: number
        total_movies: number
        total_tv_channels: number
        total_radio: number
        uptime_seconds: number
        online_users: number
        total_net_in_mbps: number
        total_net_out_mbps: number
        online_streams: number
        offline_streams: number
        online_vod_channels: number
        recent_activity: { action: string; ip_address: string | null; created_at: string | null }[]
      }>('/admin/dashboard')
      return response.data
    },
    refetchInterval: 30000,
  })

  const serversQuery = useQuery({
    queryKey: ['servers-dashboard'],
    queryFn: serversApi.list,
    refetchInterval: 30000,
  })

  const todaySeriesQuery = useQuery({
    queryKey: ['series-broadcast-today'],
    queryFn: seriesApi.broadcastToday,
    refetchInterval: 60000,
  })

  // Tick uptime every second
  useEffect(() => {
    const id = setInterval(() => setUptimeTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const servers = serversQuery.data ?? []
  const todaySeries = todaySeriesQuery.data ?? []

  // Pick main server for top metrics
  const mainServer = servers.find((s) => s.server_type === 'main') ?? servers[0] ?? null
  const metric = mainServer?.latest_metric ?? null

  const cpuPct = metric?.cpu_percent ?? 0
  const ramPct = metric?.ram_percent ?? 0
  const diskPct = metric?.disk_percent ?? 0
  const netInMbps = metric?.network_in_mbps ?? 0
  const netOutMbps = metric?.network_out_mbps ?? 0
  const netPct = Math.min(((netInMbps + netOutMbps) / 200) * 100, 100) // 200 Mbps = 100%

  const ramUsedMB = metric?.ram_used ?? 0
  const ramTotalMB = mainServer?.ram_total ?? 0
  const diskUsedMB = metric?.disk_used ?? 0
  const diskTotalMB = mainServer?.disk_total ?? 0

  const uptimeBase = dashboardQuery.data?.uptime_seconds ?? 0
  const uptimeDisplay = uptimeBase > 0 ? formatUptime(uptimeBase + uptimeTick) : '—'

  const totalServers = dashboardQuery.data?.total_servers ?? servers.length
  const totalUsers = dashboardQuery.data?.total_users ?? 0
  const totalCategories = dashboardQuery.data?.total_categories ?? 0
  const totalBouquets = dashboardQuery.data?.total_bouquets ?? 0
  const totalSeries = dashboardQuery.data?.total_series ?? 0
  const totalMovies = dashboardQuery.data?.total_movies ?? 0
  const totalTvChannels = dashboardQuery.data?.total_tv_channels ?? 0
  const totalRadio = dashboardQuery.data?.total_radio ?? 0

  const onlineUsers = dashboardQuery.data?.online_users ?? 0
  const totalNetIn = dashboardQuery.data?.total_net_in_mbps ?? 0
  const totalNetOut = dashboardQuery.data?.total_net_out_mbps ?? 0
  const onlineStreams = dashboardQuery.data?.online_streams ?? 0
  const offlineStreams = dashboardQuery.data?.offline_streams ?? 0
  const onlineVod = dashboardQuery.data?.online_vod_channels ?? 0

  return (
    <div className="space-y-6">
      {/* ── Top bar: Live + Uptime ── */}
      <div className="flex flex-wrap items-center gap-3">
        <LiveBadge />
        {uptimeBase > 0 && (
          <span className="text-sm text-slate-500">
            Uptime: <span className="font-medium text-slate-700">{uptimeDisplay}</span>
          </span>
        )}
      </div>

      {/* ── 4 Gradient Metric Cards ── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {/* CPU */}
        <MetricCard
          gradient="bg-gradient-to-br from-orange-400 to-rose-500"
          icon={<Cpu size={18} />}
          title="CPU Kullanimi"
          mainValue={`${cpuPct.toFixed(1)}%`}
          subValue={mainServer?.cpu_info ? mainServer.cpu_info.slice(0, 28) : undefined}
          percent={cpuPct}
        />

        {/* RAM */}
        <MetricCard
          gradient="bg-gradient-to-br from-blue-400 to-indigo-600"
          icon={<MemoryStick size={18} />}
          title="RAM Kullanimi"
          mainValue={`${ramPct.toFixed(1)}%`}
          subValue={
            ramTotalMB > 0
              ? `${fmtGB(ramUsedMB)} / ${fmtGB(ramTotalMB)}`
              : undefined
          }
          percent={ramPct}
        />

        {/* Disk */}
        <MetricCard
          gradient="bg-gradient-to-br from-teal-400 to-cyan-500"
          icon={<HardDrive size={18} />}
          title="Disk Kullanimi"
          mainValue={`${diskPct.toFixed(1)}%`}
          subValue={
            diskTotalMB > 0
              ? `${fmtGB(diskUsedMB)} / ${fmtGB(diskTotalMB)}`
              : undefined
          }
          percent={diskPct}
        />

        {/* Network */}
        <MetricCard
          gradient="bg-gradient-to-br from-emerald-400 to-teal-500"
          icon={<Wifi size={18} />}
          title="Ag Trafigi"
          mainValue={
            <span className="text-2xl">
              <span className="text-lg">↓</span> {fmtMbps(netInMbps)}
            </span>
          }
          subValue={
            <span>
              <span className="mr-1">↑</span>
              {fmtMbps(netOutMbps)}
            </span>
          }
          percent={netPct}
          badge={
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Live
            </span>
          }
        />
      </div>

      {/* ── Online Status Cards ── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {/* Online Kullanicilar */}
        <div className="glass-panel flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500">
            <Activity size={22} className="text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{onlineUsers}</div>
            <div className="text-xs text-slate-500">Online Kullanicilar</div>
          </div>
        </div>

        {/* Network Toplam */}
        <div className="glass-panel flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500">
            <Wifi size={22} className="text-white" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">
              ↓ {fmtMbps(totalNetIn)} ↑ {fmtMbps(totalNetOut)}
            </div>
            <div className="text-xs text-slate-500">Network Toplam</div>
          </div>
        </div>

        {/* Online/Offline Streams */}
        <div className="glass-panel flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-500">
            <PlayCircle size={22} className="text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              <span className="text-green-600">{onlineStreams}</span>
              <span className="text-sm text-slate-400 mx-1">/</span>
              <span className="text-red-500">{offlineStreams}</span>
            </div>
            <div className="text-xs text-slate-500">Online / Offline Streams</div>
          </div>
        </div>

        {/* Online VOD Channels */}
        <div className="glass-panel flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500">
            <ListVideo size={22} className="text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{onlineVod}</div>
            <div className="text-xs text-slate-500">Online VOD Channels</div>
          </div>
        </div>
      </div>

      {/* ── Server pool + Today's series ── */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        {/* Sunucu havuzu */}
        <div className="glass-panel p-6">
          <div className="mb-5">
            <h3 className="text-xl font-semibold text-slate-900">Sunucu havuzu</h3>
            <p className="mt-1 text-sm text-slate-500">
              Main server vurgulu, tum node'lar hizli metrik kartlari ile listelenir.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {servers.map((server) => (
              <div
                key={server.id}
                className={`rounded-[26px] border p-4 ${
                  server.server_type === 'main'
                    ? 'border-amber-200 bg-amber-50/70'
                    : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-base font-semibold text-slate-900">{server.name}</div>
                      {server.server_type === 'main' && <Crown size={16} className="text-amber-500" />}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{server.ip_address}</div>
                  </div>
                  <StatusBadge status={server.status} />
                </div>
                <div className="mt-4 space-y-3">
                  <MetricBar label="CPU" value={server.latest_metric?.cpu_percent ?? 0} tone="blue" />
                  <MetricBar label="RAM" value={server.latest_metric?.ram_percent ?? 0} tone="green" />
                  <MetricBar
                    label="Net In"
                    value={Math.min(((server.latest_metric?.network_in_mbps ?? 0) / 1000) * 100, 100)}
                    tone="blue"
                    displayValue={fmtMbps(server.latest_metric?.network_in_mbps ?? 0)}
                  />
                  <MetricBar
                    label="Net Out"
                    value={Math.min(((server.latest_metric?.network_out_mbps ?? 0) / 1000) * 100, 100)}
                    tone="amber"
                    displayValue={fmtMbps(server.latest_metric?.network_out_mbps ?? 0)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bugunun Dizileri */}
        <div className="glass-panel p-6 flex flex-col">
          <div className="mb-4 flex-shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Bugunun Dizileri</h3>
                <p className="mt-1 text-sm text-slate-500">Bugun yayinlanacak diziler</p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600">
                <Film size={13} />
                {todaySeries.length} dizi
              </div>
            </div>
          </div>

          {todaySeriesQuery.isLoading ? (
            <div className="flex-1 flex items-center justify-center py-8 text-sm text-slate-400">
              Yukleniyor...
            </div>
          ) : todaySeries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
              <Film size={40} className="mb-3 text-slate-200" />
              <p className="text-sm font-medium text-slate-400">Bugun yayin yok</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 pr-1" style={{ maxHeight: '420px' }}>
              {todaySeries.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col rounded-2xl border border-slate-100 bg-white p-3 hover:bg-blue-50/50 hover:border-blue-100 transition-colors group"
                >
                  <button
                    type="button"
                    className="w-full aspect-[2/3] rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center mb-2"
                    onClick={() => navigate('/series', { state: { seriesId: s.id } })}
                  >
                    {s.poster_url ? (
                      <img src={s.poster_url} alt={s.title} className="h-full w-full object-cover" />
                    ) : (
                      <Film size={20} className="text-slate-300" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <button
                        type="button"
                        className="text-sm font-semibold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2 text-left"
                        onClick={() => navigate('/series', { state: { seriesId: s.id } })}
                      >
                        {s.title}
                      </button>
                      {s.broadcast_day && (
                        <p className="mt-1 text-xs text-slate-400">{s.broadcast_day}</p>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mt-2">
                        {s.channel_logo_url && (
                          <img
                            src={s.channel_logo_url}
                            alt={s.broadcast_channel ?? ''}
                            className="h-4 w-auto object-contain max-w-[28px]"
                          />
                        )}
                        {s.broadcast_channel && (
                          <span className="text-xs text-slate-600 truncate">{s.broadcast_channel}</span>
                        )}
                      </div>
                      {s.season_count > 0 && (
                        <p className="mt-1 text-xs text-slate-400">{s.season_count} sezon</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Statistics ── */}
      <div className="glass-panel p-6">
        <h3 className="mb-4 text-xl font-semibold text-slate-900">Statistics</h3>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {/* Toplam Sunucu */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-pink-500">
              <ServerCog size={18} className="text-white" />
            </div>
            <span className="flex-1 text-sm font-medium text-slate-700">Toplam Sunucu</span>
            <span className="rounded-md bg-pink-100 px-3 py-1 text-sm font-semibold text-pink-600">
              {totalServers}
            </span>
          </div>
          {/* Toplam Kullanici */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-pink-500">
              <Users size={18} className="text-white" />
            </div>
            <span className="flex-1 text-sm font-medium text-slate-700">Toplam Kullanici</span>
            <span className="rounded-md bg-pink-100 px-3 py-1 text-sm font-semibold text-pink-600">
              {totalUsers}
            </span>
          </div>
          {/* Toplam Bouquets */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-500">
              <Layers3 size={18} className="text-white" />
            </div>
            <span className="flex-1 text-sm font-medium text-slate-700">Toplam Bouquets</span>
            <span className="rounded-md bg-green-100 px-3 py-1 text-sm font-semibold text-green-600">
              {totalBouquets}
            </span>
          </div>
          {/* Toplam Kategori */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500">
              <Grid3X3 size={18} className="text-white" />
            </div>
            <span className="flex-1 text-sm font-medium text-slate-700">Toplam Kategori</span>
            <span className="rounded-md bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-600">
              {totalCategories}
            </span>
          </div>
          {/* Toplam Series */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-500">
              <Film size={18} className="text-white" />
            </div>
            <span className="flex-1 text-sm font-medium text-slate-700">Toplam Series</span>
            <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
              {totalSeries}
            </span>
          </div>
          {/* Toplam Radyo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-500">
              <Radio size={18} className="text-white" />
            </div>
            <span className="flex-1 text-sm font-medium text-slate-700">Toplam Radyo</span>
            <span className="rounded-md bg-red-100 px-3 py-1 text-sm font-semibold text-red-600">
              {totalRadio}
            </span>
          </div>
          {/* Toplam Movies */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500">
              <Clapperboard size={18} className="text-white" />
            </div>
            <span className="flex-1 text-sm font-medium text-slate-700">Toplam Movies</span>
            <span className="rounded-md bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-600">
              {totalMovies}
            </span>
          </div>
          {/* Toplam TV Kanallari */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500">
              <Monitor size={18} className="text-white" />
            </div>
            <span className="flex-1 text-sm font-medium text-slate-700">Toplam TV Kanallari</span>
            <span className="rounded-md bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-600">
              {totalTvChannels}
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}
