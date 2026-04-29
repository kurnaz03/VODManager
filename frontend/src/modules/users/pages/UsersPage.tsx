import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity, BarChart2, ChevronDown, Circle, Download, Edit, Filter,
  List, Loader2, Play, Plus, RefreshCw, Search, Shield,
  Wifi, WifiOff, X, XCircle,
} from 'lucide-react'
import { iptvUsersApi, IptvUser, ActiveConnection, WatchStats } from '../services/iptvUsersApi'
import UserFormModal from './UserFormModal'

type StatusFilter = 'all' | 'active' | 'banned' | 'disabled' | 'expired'
type TrialFilter = 'all' | 'official' | 'trial'

function daysLeft(expiry: string | null): number | null {
  if (!expiry) return null
  const diff = new Date(expiry).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function userXtreamStatus(u: IptvUser): 'active' | 'banned' | 'disabled' | 'expired' {
  if (!u.is_enabled) return 'disabled'
  if (u.expiry_date && new Date(u.expiry_date) < new Date()) return 'expired'
  return 'active'
}

function fmtDuration(secs: number | null | undefined): string {
  if (!secs) return '0s'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}s ${m}d`
  if (m > 0) return `${m}d ${s}s`
  return `${s}s`
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:   { label: 'ACTIVE',    cls: 'bg-green-600 text-white' },
  banned:   { label: 'BANNED',    cls: 'bg-red-600 text-white' },
  disabled: { label: 'DISABLED',  cls: 'bg-gray-400 text-white' },
  expired:  { label: 'EXPIRED',   cls: 'bg-amber-500 text-white' },
}

const SHOW_OPTIONS = [25, 50, 100, 250]

// ─── Connection Popup ─────────────────────────────────────────────────────────

function ConnectionsPopup({ user, onClose }: { user: IptvUser; onClose: () => void }) {
  const queryClient = useQueryClient()
  const connsQ = useQuery({
    queryKey: ['iptv-user-connections', user.id],
    queryFn: () => iptvUsersApi.getConnections(user.id),
    refetchInterval: 5000,
  })

  const killMut = useMutation({
    mutationFn: (connId: number) => iptvUsersApi.killConnection(user.id, connId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['iptv-user-connections', user.id] }),
  })

  const conns: ActiveConnection[] = connsQ.data ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800">
            Aktif Bağlantılar — <span className="text-blue-600">{user.username}</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-auto">
          {connsQ.isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : conns.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">Aktif bağlantı yok.</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[10px] tracking-wide">
                  <th className="px-3 py-2 text-left">IP</th>
                  <th className="px-3 py-2 text-left">Ülke</th>
                  <th className="px-3 py-2 text-left">ISP</th>
                  <th className="px-3 py-2 text-left">Stream</th>
                  <th className="px-3 py-2 text-left">Süre</th>
                  <th className="px-3 py-2 text-left">Kes</th>
                </tr>
              </thead>
              <tbody>
                {conns.map((c, i) => (
                  <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 font-mono">{c.ip_address}</td>
                    <td className="px-3 py-2">
                      {c.country_code ? (
                        <span className="flex items-center gap-1">
                          <img
                            src={`https://flagcdn.com/16x12/${c.country_code.toLowerCase()}.png`}
                            alt={c.country_code}
                            className="inline-block"
                            style={{ width: 16, height: 12 }}
                          />
                          <span>{c.country_code}</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate">{c.isp_name || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{c.stream_type || '—'} {c.stream_id ? `#${c.stream_id}` : ''}</td>
                    <td className="px-3 py-2 text-gray-600">{fmtDuration(c.duration_seconds)}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => killMut.mutate(c.id)}
                        disabled={killMut.isPending}
                        className="text-red-500 hover:text-red-700 transition"
                        title="Bağlantıyı Kes"
                      >
                        <XCircle size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-400 flex items-center gap-1">
          <RefreshCw size={11} className={connsQ.isFetching ? 'animate-spin' : ''} />
          Her 5 saniyede yenileniyor
        </div>
      </div>
    </div>
  )
}

// ─── Stats Modal ──────────────────────────────────────────────────────────────

function StatsModal({ user, onClose }: { user: IptvUser; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const statsQ = useQuery({
    queryKey: ['iptv-user-stats', user.id, page, dateFrom, dateTo],
    queryFn: () => iptvUsersApi.getStats(user.id, page, 50, dateFrom || undefined, dateTo || undefined),
  })

  const stats: WatchStats | undefined = statsQ.data

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800">
            İzleme İstatistikleri — <span className="text-blue-600">{user.username}</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        {/* Filtreler & Özet */}
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span>Tarihten:</span>
            <input type="date" className="border border-gray-300 rounded px-2 py-1 text-xs" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <span>Tarihe:</span>
            <input type="date" className="border border-gray-300 rounded px-2 py-1 text-xs" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} />
          </div>
          {stats && (
            <div className="flex-1 flex justify-end gap-4 text-xs text-gray-600">
              <span>Toplam kayıt: <strong className="text-gray-800">{stats.total_count}</strong></span>
              <span>Toplam süre: <strong className="text-gray-800">{fmtDuration(stats.total_duration_seconds)}</strong></span>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {statsQ.isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : !stats || stats.history.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">İzleme geçmişi bulunamadı.</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[10px] tracking-wide">
                  <th className="px-3 py-2 text-left">Tarih</th>
                  <th className="px-3 py-2 text-left">Kanal</th>
                  <th className="px-3 py-2 text-left">Tür</th>
                  <th className="px-3 py-2 text-left">IP</th>
                  <th className="px-3 py-2 text-left">Ülke</th>
                  <th className="px-3 py-2 text-left">ISP</th>
                  <th className="px-3 py-2 text-left">Başlangıç</th>
                  <th className="px-3 py-2 text-left">Bitiş</th>
                  <th className="px-3 py-2 text-left">Süre</th>
                </tr>
              </thead>
              <tbody>
                {stats.history.map((h, i) => (
                  <tr key={h.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2">{h.started_at ? new Date(h.started_at).toLocaleDateString('tr-TR') : '—'}</td>
                    <td className="px-3 py-2 max-w-[140px] truncate">{h.stream_name || `#${h.stream_id}`}</td>
                    <td className="px-3 py-2 text-gray-500">{h.stream_type || '—'}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{h.ip_address || '—'}</td>
                    <td className="px-3 py-2">
                      {h.country_code ? (
                        <span className="flex items-center gap-1">
                          <img src={`https://flagcdn.com/16x12/${h.country_code.toLowerCase()}.png`} alt={h.country_code} style={{ width: 16, height: 12 }} />
                          {h.country_code}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">{h.isp_name || '—'}</td>
                    <td className="px-3 py-2">{h.started_at ? new Date(h.started_at).toLocaleTimeString('tr-TR') : '—'}</td>
                    <td className="px-3 py-2">{h.ended_at ? new Date(h.ended_at).toLocaleTimeString('tr-TR') : '—'}</td>
                    <td className="px-3 py-2">{fmtDuration(h.duration_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {stats && stats.total_count > 50 && (
          <div className="border-t border-gray-200 px-4 py-2 flex items-center justify-end gap-2 text-xs">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border rounded disabled:opacity-40">Önceki</button>
            <span className="text-gray-500">Sayfa {page}</span>
            <button disabled={stats.history.length < 50} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border rounded disabled:opacity-40">Sonraki</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<IptvUser | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [trialFilter, setTrialFilter] = useState<TrialFilter>('all')
  const [showPerPage, setShowPerPage] = useState(25)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [resellerFilter, setResellerFilter] = useState('all')
  const [connPopupUser, setConnPopupUser] = useState<IptvUser | null>(null)
  const [statsUser, setStatsUser] = useState<IptvUser | null>(null)

  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const usersQ = useQuery({
    queryKey: ['iptv-users', search],
    queryFn: () => iptvUsersApi.list(search || undefined),
    refetchInterval: autoRefresh ? 10000 : false,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => iptvUsersApi.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['iptv-users'] }); showToast('Kullanici silindi', 'ok') },
    onError: () => showToast('Silme hatasi', 'err'),
  })

  const banMut = useMutation({
    mutationFn: (u: IptvUser) => u.is_enabled ? iptvUsersApi.ban(u.id) : iptvUsersApi.unban(u.id),
    onSuccess: (_, u) => { queryClient.invalidateQueries({ queryKey: ['iptv-users'] }); showToast(u.is_enabled ? 'Kullanici banlandı' : 'Ban kaldırıldı', 'ok') },
    onError: () => showToast('Ban işlemi hatası', 'err'),
  })

  const killAllMut = useMutation({
    mutationFn: (id: number) => iptvUsersApi.killAll(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['iptv-users'] }); showToast('Tüm bağlantılar kesildi', 'ok') },
    onError: () => showToast('Kill hatası', 'err'),
  })

  const resetRestrMut = useMutation({
    mutationFn: (id: number) => iptvUsersApi.resetRestrictions(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['iptv-users'] }); showToast('Kısıtlamalar sıfırlandı', 'ok') },
    onError: () => showToast('Sıfırlama hatası', 'err'),
  })

  const allUsers = usersQ.data ?? []
  const resellers = ['all', ...Array.from(new Set(allUsers.map(u => u.owner).filter(Boolean)))]

  const filtered = allUsers.filter(u => {
    const st = userXtreamStatus(u)
    if (statusFilter !== 'all' && st !== statusFilter) return false
    if (trialFilter === 'official' && u.is_trial) return false
    if (trialFilter === 'trial' && !u.is_trial) return false
    if (resellerFilter !== 'all' && u.owner !== resellerFilter) return false
    return true
  }).slice(0, showPerPage)

  function handleEdit(user: IptvUser) { setEditUser(user); setShowModal(true) }
  function handleNew() { setEditUser(null); setShowModal(true) }
  function handleCloseModal() { setShowModal(false); setEditUser(null) }

  function copyUsername(u: IptvUser) { navigator.clipboard.writeText(u.username); showToast('Username kopyalandi', 'ok') }

  return (
    <div className="min-h-screen bg-white text-gray-800 font-sans overflow-x-hidden">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded px-4 py-2 text-sm font-semibold shadow-lg text-white ${toast.type === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Top bar */}
      <div className="bg-gray-100 border-b border-gray-300 px-3 py-2 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            className="bg-white border border-gray-300 rounded text-xs pl-7 pr-3 py-1.5 text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none w-36 sm:w-44" />
        </div>

        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="appearance-none bg-white border border-gray-300 rounded text-xs pl-3 pr-7 py-1.5 text-gray-700 focus:border-blue-500 focus:outline-none cursor-pointer">
            <option value="all">Filter Results</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="disabled">Disabled</option>
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select value={resellerFilter} onChange={e => setResellerFilter(e.target.value)}
            className="appearance-none bg-white border border-gray-300 rounded text-xs pl-3 pr-7 py-1.5 text-gray-700 focus:border-blue-500 focus:outline-none cursor-pointer">
            {resellers.map(r => <option key={r} value={r}>{r === 'all' ? 'All Resellers' : r}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select value={trialFilter} onChange={e => setTrialFilter(e.target.value as TrialFilter)}
            className="appearance-none bg-white border border-gray-300 rounded text-xs pl-3 pr-7 py-1.5 text-gray-700 focus:border-blue-500 focus:outline-none cursor-pointer">
            <option value="all">No Filter</option>
            <option value="official">Official</option>
            <option value="trial">Trial</option>
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Show</span>
          <div className="relative">
            <select value={showPerPage} onChange={e => setShowPerPage(Number(e.target.value))}
              className="appearance-none bg-white border border-gray-300 rounded text-xs pl-3 pr-7 py-1.5 text-gray-700 focus:border-blue-500 focus:outline-none cursor-pointer">
              {SHOW_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 ml-auto">
          <button onClick={() => usersQ.refetch()}
            className="flex items-center gap-1.5 bg-white border border-gray-300 hover:border-blue-500 rounded px-3 py-1.5 text-xs text-gray-600 hover:text-blue-600 transition">
            <Filter size={13} /> Filter
          </button>
          <button onClick={() => usersQ.refetch()}
            className="flex items-center gap-1.5 bg-white border border-gray-300 hover:border-blue-500 rounded px-3 py-1.5 text-xs text-gray-600 hover:text-blue-600 transition">
            <Search size={13} /> Search
          </button>
          <button onClick={() => setAutoRefresh(v => !v)}
            className={`flex items-center gap-1.5 border rounded px-3 py-1.5 text-xs transition ${autoRefresh ? 'bg-green-600 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-green-500 hover:text-green-600'}`}>
            <RefreshCw size={13} className={autoRefresh ? 'animate-spin' : ''} />
            Auto-Refresh
          </button>
          <button onClick={handleNew}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 border border-blue-700 rounded px-3 py-1.5 text-xs text-white font-semibold transition">
            <Plus size={13} /> Add User
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{minWidth: '900px'}}>
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300 text-gray-500 uppercase text-[11px] tracking-wide">
              <th className="px-3 py-2.5 text-left font-semibold w-12">#</th>
              <th className="px-3 py-2.5 text-left font-semibold">Username</th>
              <th className="px-3 py-2.5 text-left font-semibold">Password</th>
              <th className="px-3 py-2.5 text-left font-semibold">Reseller</th>
              <th className="px-3 py-2.5 text-left font-semibold">Status</th>
              <th className="px-3 py-2.5 text-left font-semibold">Trial</th>
              <th className="px-3 py-2.5 text-left font-semibold">Expiration</th>
              <th className="px-3 py-2.5 text-left font-semibold">Days</th>
              <th className="px-3 py-2.5 text-left font-semibold">Conns</th>
              <th className="px-3 py-2.5 text-left font-semibold">ISP / Country</th>
              <th className="px-3 py-2.5 text-left font-semibold">Info</th>
              <th className="px-3 py-2.5 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersQ.isLoading ? (
              <tr><td colSpan={12} className="py-16 text-center"><Loader2 size={22} className="animate-spin text-gray-400 mx-auto" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={12} className="py-12 text-center text-gray-400">No users found.</td></tr>
            ) : filtered.map((u, i) => {
              const st = userXtreamStatus(u)
              const badge = STATUS_BADGE[st]
              const days = daysLeft(u.expiry_date)
              const rowBg = !u.is_enabled
                ? (i % 2 === 0 ? 'bg-red-50' : 'bg-red-50')
                : (i % 2 === 0 ? 'bg-white' : 'bg-gray-50')
              const activeConns = u.active_connections ?? 0

              return (
                <tr key={u.id} className={`${rowBg} border-b border-gray-200 hover:bg-blue-50 transition-colors`}>
                  <td className="px-3 py-2 font-mono text-gray-400">{u.id}</td>

                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {/* Yeşil dot: aktif bağlantı var */}
                      {activeConns > 0 && (
                        <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" title={`${activeConns} aktif bağlantı`} />
                      )}
                      <button onClick={() => copyUsername(u)}
                        className="font-semibold text-blue-600 hover:text-blue-500 transition" title="Kopyala">
                        {u.username}
                      </button>
                    </div>
                  </td>

                  <td className="px-3 py-2 font-mono text-gray-500">{u.password}</td>
                  <td className="px-3 py-2 text-gray-600">{u.owner || '—'}</td>

                  <td className="px-3 py-2">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>

                  <td className="px-3 py-2">
                    {u.is_trial
                      ? <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-orange-500 text-white tracking-wide">TRIAL</span>
                      : <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-cyan-600 text-white tracking-wide">OFFICIAL</span>}
                  </td>

                  <td className="px-3 py-2 text-gray-600">
                    {u.expiry_date ? new Date(u.expiry_date).toLocaleDateString('tr-TR') : <span className="text-gray-400">Never</span>}
                  </td>

                  <td className="px-3 py-2">
                    {days === null ? <span className="text-gray-400">∞</span>
                      : days > 0 ? <span className={days <= 7 ? 'text-red-500 font-semibold' : 'text-gray-700'}>{days}</span>
                      : <span className="text-red-600 font-bold">Exp</span>}
                  </td>

                  {/* Connections: tıklanabilir */}
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setConnPopupUser(u)}
                      className={`flex items-center gap-1 transition hover:underline ${activeConns > 0 ? 'text-green-600 font-semibold' : 'text-gray-400'}`}
                      title="Bağlantıları gör"
                    >
                      {activeConns > 0 ? <Wifi size={11} /> : <WifiOff size={11} />}
                      <span>{activeConns}</span>
                      <span className="text-gray-300">/</span>
                      <span className="text-gray-600">{u.max_connections === 0 ? '∞' : u.max_connections}</span>
                    </button>
                  </td>

                  {/* ISP / Country - sadece online kullanicilarda goster */}
                  <td className="px-3 py-2">
                    {activeConns > 0 && u.last_country_code ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 flex-wrap">
                          <img
                            src={`https://flagcdn.com/16x12/${u.last_country_code.toLowerCase()}.png`}
                            alt={u.last_country_code}
                            style={{ width: 16, height: 12 }}
                            className="inline-block shrink-0"
                          />
                          <span className="text-gray-600 font-mono">{u.last_country_code}</span>
                          {u.last_isp && (
                            <span className="text-gray-500 truncate max-w-[110px]" title={u.last_isp}>{u.last_isp}</span>
                          )}
                        </span>
                        {u.last_ip && (
                          <div className="text-xs text-gray-400 font-mono">{u.last_ip}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate">
                    {u.admin_notes || <span className="text-gray-300">—</span>}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-0.5">
                      {/* Play */}
                      <ActionBtn icon={<Play size={11} />} title="Stream" color="text-green-600 hover:bg-green-100" onClick={() => {}} />
                      {/* Ban/Unban toggle */}
                      <ActionBtn
                        icon={<Shield size={11} />}
                        title={u.is_enabled ? 'Ban' : 'Unban'}
                        color={u.is_enabled ? 'text-blue-500 hover:bg-blue-100' : 'text-red-500 hover:bg-red-100'}
                        onClick={() => banMut.mutate(u)}
                      />
                      {/* Kill All */}
                      <ActionBtn icon={<XCircle size={11} />} title="Kill All Connections" color="text-orange-500 hover:bg-orange-100"
                        onClick={() => { if (confirm('Tüm bağlantılar kesilsin mi?')) killAllMut.mutate(u.id) }} />
                      {/* Reset restrictions */}
                      <ActionBtn icon={<RefreshCw size={11} />} title="Reset Restrictions" color="text-purple-500 hover:bg-purple-100"
                        onClick={() => { if (confirm('Kısıtlamalar sıfırlansın mı?')) resetRestrMut.mutate(u.id) }} />
                      {/* Stats */}
                      <ActionBtn icon={<BarChart2 size={11} />} title="İzleme İstatistikleri" color="text-pink-500 hover:bg-pink-100"
                        onClick={() => setStatsUser(u)} />
                      {/* List */}
                      <ActionBtn icon={<List size={11} />} title="Bouquets" color="text-purple-500 hover:bg-purple-100" onClick={() => handleEdit(u)} />
                      {/* Edit */}
                      <ActionBtn icon={<Edit size={11} />} title="Edit" color="text-yellow-600 hover:bg-yellow-100" onClick={() => handleEdit(u)} />
                      {/* Download M3U - tek tik kopyala */}
                      <ActionBtn icon={<Download size={11} />} title="M3U Plus URL Kopyala" color="text-cyan-600 hover:bg-cyan-100"
                        onClick={() => { navigator.clipboard.writeText(iptvUsersApi.m3uUrl(u, 'm3u_plus')); showToast('M3U Plus URL kopyalandi', 'ok') }} />
                      {/* Activity */}
                      <ActionBtn icon={<Activity size={11} />} title="Activity" color="text-orange-500 hover:bg-orange-100"
                        onClick={() => setConnPopupUser(u)} />
                      {/* Toggle enable */}
                      <ActionBtn icon={<Circle size={11} fill={u.is_enabled ? 'currentColor' : 'none'} />}
                        title={u.is_enabled ? 'Disable' : 'Enable'}
                        color={u.is_enabled ? 'text-green-600 hover:bg-green-100' : 'text-gray-400 hover:bg-gray-100'}
                        onClick={() => {}} />
                      {/* Delete */}
                      <ActionBtn icon={<X size={11} />} title="Delete" color="text-red-500 hover:bg-red-100"
                        onClick={() => { if (confirm(`${u.username} silinsin mi?`)) deleteMut.mutate(u.id) }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-gray-100 border-t border-gray-300 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
        <span>{filtered.length} / {allUsers.length} kullanici gosteriliyor</span>
        <span>
          {usersQ.isFetching && <RefreshCw size={12} className="animate-spin inline mr-1" />}
          Son guncelleme: {new Date().toLocaleTimeString('tr-TR')}
        </span>
      </div>

      {showModal && (
        <UserFormModal
          editUser={editUser}
          onClose={handleCloseModal}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['iptv-users'] }); handleCloseModal(); showToast(editUser ? 'Kullanici guncellendi' : 'Kullanici olusturuldu', 'ok') }}
          onError={() => showToast('Islem hatasi', 'err')}
        />
      )}

      {connPopupUser && (
        <ConnectionsPopup user={connPopupUser} onClose={() => setConnPopupUser(null)} />
      )}

      {statsUser && (
        <StatsModal user={statsUser} onClose={() => setStatsUser(null)} />
      )}
    </div>
  )
}

function ActionBtn({ icon, title, color, onClick }: { icon: React.ReactNode; title: string; color: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={title} className={`rounded p-1 transition ${color}`}>
      {icon}
    </button>
  )
}
