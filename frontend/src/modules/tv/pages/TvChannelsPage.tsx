import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Edit2,
  Filter,
  Mail,
  MonitorPlay,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Square,
  StopCircle,
  Trash2,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { tvChannelsApi, TvChannel, TvChannelCreate, TvChannelUpdate, ViewerInfo } from '../services/tvChannelsApi'
import { contentApi, Category } from '../../content/services/contentApi'
import { serversApi, Server as ServerType } from '../../servers/services/serversApi'

// ── Modal Form ────────────────────────────────────────────────────────────────

interface ModalProps {
  initial: TvChannel | null
  categories: Category[]
  servers: ServerType[]
  bouquets: { id: number; name: string }[]
  onClose: () => void
  onSave: (data: TvChannelCreate | TvChannelUpdate) => void
  saving: boolean
}

function ChannelModal({ initial, categories, servers, bouquets, onClose, onSave, saving }: ModalProps) {
  const isEdit = initial !== null
  const [name, setName] = useState(initial?.name ?? '')
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url ?? '')
  const [epgId, setEpgId] = useState(initial?.epg_channel_id ?? '')
  const [streamUrl, setStreamUrl] = useState(initial?.stream_url ?? '')
  const [categoryId, setCategoryId] = useState<number | null>(initial?.category_id ?? null)
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0)
  const [selectedServers, setSelectedServers] = useState<number[]>(
    initial?.servers.map((s) => s.server_id) ?? [],
  )
  const [selectedBouquets, setSelectedBouquets] = useState<number[]>(
    initial?.bouquet_assignments.map((b) => b.bouquet_id) ?? [],
  )
  const [backupUrls, setBackupUrls] = useState<string[]>(initial?.backup_urls ?? [])
  const [onDemand, setOnDemand] = useState(initial?.on_demand ?? false)
  const [onDemandTimeout, setOnDemandTimeout] = useState(initial?.on_demand_timeout ?? 30)
  const [onDemandServerId, setOnDemandServerId] = useState<number | null>(initial?.on_demand_server_id ?? null)

  function toggleServer(id: number) {
    setSelectedServers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function toggleBouquet(id: number) {
    setSelectedBouquets((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function addBackupUrl() {
    setBackupUrls((prev) => [...prev, ''])
  }

  function removeBackupUrl(idx: number) {
    setBackupUrls((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateBackupUrl(idx: number, val: string) {
    setBackupUrls((prev) => prev.map((u, i) => (i === idx ? val : u)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data = {
      name,
      logo_url: logoUrl || null,
      epg_channel_id: epgId || null,
      stream_url: streamUrl,
      category_id: categoryId,
      is_active: isActive,
      sort_order: sortOrder,
      server_ids: selectedServers,
      bouquet_ids: selectedBouquets,
      backup_urls: backupUrls.filter((u) => u.trim() !== ''),
      on_demand: onDemand,
      on_demand_timeout: onDemandTimeout,
      on_demand_server_id: onDemandServerId,
    }
    onSave(data)
  }

  const inputCls =
    'w-full rounded bg-white border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition'
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2 text-gray-800 font-semibold text-base">
            <MonitorPlay size={18} className="text-blue-500" />
            {isEdit ? 'Edit Stream' : 'Add Stream'}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name + EPG */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Stream Name *</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required placeholder="TRT 1" />
            </div>
            <div>
              <label className={labelCls}>EPG Channel ID</label>
              <input className={inputCls} value={epgId} onChange={(e) => setEpgId(e.target.value)} placeholder="trt1.tr" />
            </div>
          </div>

          {/* Stream URL */}
          <div>
            <label className={labelCls}>Stream URL *</label>
            <input className={inputCls} value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} required placeholder="http://example.com/live/ch1.m3u8" />
          </div>

          {/* Logo URL */}
          <div>
            <label className={labelCls}>Logo URL</label>
            <input className={inputCls} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://cdn.example.com/logo.png" />
          </div>

          {/* Category + Sort + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Sort Order</label>
              <input type="number" className={inputCls} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} min={0} />
            </div>
            <div className="flex flex-col justify-end">
              <label className={labelCls}>Status</label>
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={`flex items-center gap-2 rounded px-3 py-2 text-sm font-medium border transition ${
                  isActive ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-gray-100 border-gray-300 text-gray-500'
                }`}
              >
                {isActive ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>

          {/* Backup URLs */}
          <div>
            <label className={labelCls}>Backup URLs</label>
            <div className="space-y-2">
              {backupUrls.map((url, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    value={url}
                    onChange={(e) => updateBackupUrl(idx, e.target.value)}
                    placeholder={`Backup URL ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeBackupUrl(idx)}
                    className="flex items-center justify-center w-9 h-9 rounded border border-red-300 bg-red-50 text-red-500 hover:bg-red-100 transition flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addBackupUrl}
                className="flex items-center gap-1.5 rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition w-full justify-center"
              >
                <Plus size={12} />
                Add Backup URL
              </button>
            </div>
          </div>

          {/* On-Demand */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className={`${labelCls} mb-0`}>On-Demand</label>
              <button
                type="button"
                onClick={() => setOnDemand((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${onDemand ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${onDemand ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </div>
            {onDemand && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Timeout (seconds)</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={onDemandTimeout}
                    onChange={(e) => setOnDemandTimeout(Number(e.target.value))}
                    min={1}
                  />
                </div>
                <div>
                  <label className={labelCls}>On-Demand Server</label>
                  <select
                    className={inputCls}
                    value={onDemandServerId ?? ''}
                    onChange={(e) => setOnDemandServerId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select Server</option>
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Servers */}
          <div>
            <label className={labelCls}>
              <Server size={12} className="inline mr-1" />
              Server Assignment
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto rounded border border-gray-300 bg-gray-50 p-2">
              {servers.length === 0 && <span className="text-xs text-gray-400 col-span-3">No servers found</span>}
              {servers.map((srv) => {
                const sel = selectedServers.includes(srv.id)
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => toggleServer(srv.id)}
                    className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-left transition border ${
                      sel ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'
                    }`}
                  >
                    <Server size={11} />
                    <span className="truncate">{srv.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bouquets */}
          <div>
            <label className={labelCls}>
              <Zap size={12} className="inline mr-1" />
              Bouquet Assignment
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto rounded border border-gray-300 bg-gray-50 p-2">
              {bouquets.length === 0 && <span className="text-xs text-gray-400 col-span-3">No bouquets found</span>}
              {bouquets.map((bq) => {
                const sel = selectedBouquets.includes(bq.id)
                return (
                  <button
                    key={bq.id}
                    type="button"
                    onClick={() => toggleBouquet(bq.id)}
                    className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-left transition border ${
                      sel ? 'bg-purple-100 border-purple-400 text-purple-700' : 'bg-white border-gray-300 text-gray-600 hover:border-purple-400'
                    }`}
                  >
                    <Zap size={11} />
                    <span className="truncate">{bq.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded text-sm text-gray-500 hover:text-gray-800 transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded bg-blue-600 hover:bg-blue-500 px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving...' : isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZES = [10, 25, 50, 100]

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

// ── Viewers Modal ─────────────────────────────────────────────────────────────

interface ViewersModalProps {
  channelName: string
  channelId: number
  onClose: () => void
}

function ViewersModal({ channelName, channelId, onClose }: ViewersModalProps) {
  const viewersQuery = useQuery({
    queryKey: ['tv-channel-viewers', channelId],
    queryFn: () => tvChannelsApi.getChannelViewers(channelId),
    refetchInterval: 5000,
  })

  const viewers: ViewerInfo[] = viewersQuery.data ?? []

  function formatTs(ts: number): string {
    return new Date(ts * 1000).toLocaleTimeString()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2 text-gray-800 font-semibold text-base">
            <Users size={18} className="text-blue-500" />
            Kanal İzleyicileri - {channelName}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 transition">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {viewersQuery.isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw size={16} className="animate-spin mr-2" />
              Yükleniyor...
            </div>
          ) : viewers.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              Şu an izleyici yok.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['Username', 'IP Adresi', 'Bağlanma Zamanı', 'Süre'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewers.map((v, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">{v.username}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{v.ip_address}</td>
                    <td className="px-4 py-3 text-gray-600">{formatTs(v.connected_at)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatUptime(v.duration_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="border-t border-gray-100 px-6 py-3 flex justify-between items-center flex-shrink-0">
          <span className="text-xs text-gray-400">Her 5 saniyede güncellenir</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TvChannelsPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editChannel, setEditChannel] = useState<TvChannel | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; ok: boolean; msg: string } | null>(null)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [viewersChannel, setViewersChannel] = useState<TvChannel | null>(null)

  // Filter state
  const [searchText, setSearchText] = useState('')
  const [filterServerId, setFilterServerId] = useState<number | null>(null)
  const [filterCatId, setFilterCatId] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Pagination
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false)

  const channelsQuery = useQuery({
    queryKey: ['tv-channels'],
    queryFn: () => tvChannelsApi.list(),
    refetchInterval: autoRefresh ? 10000 : false,
  })

  const viewerCountsQuery = useQuery({
    queryKey: ['tv-viewer-counts'],
    queryFn: () => tvChannelsApi.getViewerCounts(),
    refetchInterval: 10000,
  })

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'tv'],
    queryFn: () => contentApi.listCategories('tv'),
  })

  const serversQuery = useQuery({
    queryKey: ['servers'],
    queryFn: () => serversApi.list(),
  })

  const bouquetsQuery = useQuery({
    queryKey: ['bouquets'],
    queryFn: () => contentApi.listBouquets(),
  })

  const createMutation = useMutation({
    mutationFn: (p: TvChannelCreate) => tvChannelsApi.create(p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tv-channels'] })
      setModalOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, p }: { id: number; p: TvChannelUpdate }) => tvChannelsApi.update(id, p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tv-channels'] })
      setModalOpen(false)
      setEditChannel(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tvChannelsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tv-channels'] })
      setDeleteId(null)
    },
  })

  async function handleTest(id: number) {
    setTestingId(id)
    setTestResult(null)
    try {
      const res = await tvChannelsApi.test(id)
      setTestResult({ id, ok: res.ok, msg: res.message })
    } catch {
      setTestResult({ id, ok: false, msg: 'Test failed' })
    } finally {
      setTestingId(null)
    }
  }

  const allChannels: TvChannel[] = channelsQuery.data ?? []
  const categories: Category[] = categoriesQuery.data ?? []
  const servers: ServerType[] = serversQuery.data ?? []
  const bouquets = bouquetsQuery.data ?? []
  const viewerCounts: { [channelId: number]: number } = viewerCountsQuery.data?.counts ?? {}

  // Client-side filtering
  const filtered = useMemo(() => {
    let list = allChannels
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      list = list.filter(
        (ch) =>
          ch.name.toLowerCase().includes(q) ||
          ch.stream_url.toLowerCase().includes(q) ||
          (ch.category_name ?? '').toLowerCase().includes(q),
      )
    }
    if (filterServerId !== null) {
      list = list.filter((ch) => ch.servers.some((s) => s.server_id === filterServerId))
    }
    if (filterCatId !== null) {
      list = list.filter((ch) => ch.category_id === filterCatId)
    }
    if (filterStatus === 'active') list = list.filter((ch) => ch.is_active)
    if (filterStatus === 'inactive') list = list.filter((ch) => !ch.is_active)
    return list
  }, [allChannels, searchText, filterServerId, filterCatId, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  function resetPage() {
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* ── Header ── */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Streams</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter toggle */}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              title="Filter"
              className={`flex items-center justify-center w-9 h-9 rounded border transition ${
                showFilters ? 'bg-yellow-400 border-yellow-500 text-white' : 'bg-yellow-50 border-yellow-300 text-yellow-600 hover:bg-yellow-100'
              }`}
            >
              <Filter size={16} />
            </button>
            {/* Search toggle */}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              title="Search"
              className={`flex items-center justify-center w-9 h-9 rounded border transition ${
                showFilters ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-100'
              }`}
            >
              <Search size={16} />
            </button>
            {/* Auto Refresh */}
            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={`flex items-center gap-1.5 rounded border px-3 py-2 text-xs font-semibold transition ${
                autoRefresh
                  ? 'bg-gray-700 border-gray-700 text-white'
                  : 'bg-gray-800 border-gray-800 text-white hover:bg-gray-700'
              }`}
            >
              <RefreshCw size={13} className={autoRefresh ? 'animate-spin' : ''} />
              Auto-Refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>
            {/* Add Stream */}
            <button
              type="button"
              onClick={() => { setEditChannel(null); setModalOpen(true) }}
              className="flex items-center gap-1.5 rounded border bg-gray-800 border-gray-800 hover:bg-gray-700 px-3 py-2 text-xs font-semibold text-white transition"
            >
              <Plus size={13} />
              Add Stream
            </button>
          </div>
        </div>

        {/* ── Filter Row ── */}
        {showFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
            {/* Text search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="rounded border border-gray-300 bg-white pl-8 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition w-48"
                placeholder="Search streams..."
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); resetPage() }}
              />
            </div>
            {/* All Servers */}
            <select
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500 transition"
              value={filterServerId ?? ''}
              onChange={(e) => { setFilterServerId(e.target.value ? Number(e.target.value) : null); resetPage() }}
            >
              <option value="">All Servers</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {/* Category */}
            <select
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500 transition"
              value={filterCatId ?? ''}
              onChange={(e) => { setFilterCatId(e.target.value ? Number(e.target.value) : null); resetPage() }}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {/* Status */}
            <select
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500 transition"
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value as 'all' | 'active' | 'inactive'); resetPage() }}
            >
              <option value="all">No Filter</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {/* Show count */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-500">Show</span>
              <select
                className="rounded border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500 transition"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); resetPage() }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Test Result Banner */}
      {testResult && (
        <div className={`mx-6 mt-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
          testResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {testResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>Stream #{testResult.id}: {testResult.msg}</span>
          <button type="button" onClick={() => setTestResult(null)} className="ml-auto text-current opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="px-6 py-4">
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {[
                    { label: 'ID', w: 'w-12' },
                    { label: 'ICON', w: 'w-16' },
                    { label: 'NAME', w: '' },
                    { label: 'SOURCE', w: 'w-28' },
                    { label: 'CLIENTS', w: 'w-20' },
                    { label: 'UPTIME', w: 'w-32' },
                    { label: 'ACTIONS', w: 'w-44' },
                    { label: 'PLAYER', w: 'w-20' },
                    { label: 'EPG', w: 'w-16' },
                    { label: 'STREAM INFO', w: 'w-40' },
                  ].map((h) => (
                    <th
                      key={h.label}
                      className={`px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 ${h.w}`}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {channelsQuery.isLoading && (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center text-gray-400">
                      <RefreshCw size={18} className="animate-spin inline mr-2" />
                      Loading...
                    </td>
                  </tr>
                )}
                {!channelsQuery.isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center text-gray-400">
                      {allChannels.length === 0 ? 'No streams found. Click "Add Stream" to get started.' : 'No results match your filters.'}
                    </td>
                  </tr>
                )}
                {paginated.map((ch, idx) => (
                  <tr
                    key={ch.id}
                    className={`border-b border-gray-100 transition hover:bg-blue-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                  >
                    {/* ID */}
                    <td className="px-3 py-3 text-gray-400 font-mono text-xs">{ch.id}</td>

                    {/* ICON */}
                    <td className="px-3 py-3">
                      {ch.logo_url ? (
                        <img src={ch.logo_url} alt={ch.name} className="h-7 w-11 object-contain rounded bg-gray-100" />
                      ) : (
                        <div className="flex h-7 w-11 items-center justify-center rounded bg-gray-100 text-gray-400">
                          <MonitorPlay size={13} />
                        </div>
                      )}
                    </td>

                    {/* NAME */}
                    <td className="px-3 py-3">
                      <div className="font-semibold text-gray-900 text-sm leading-tight">{ch.name}</div>
                      {ch.category_name && (
                        <div className="text-xs text-teal-600 font-medium mt-0.5">{ch.category_name}</div>
                      )}
                    </td>

                    {/* SOURCE */}
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {ch.servers.length > 0 ? (
                        <span className="truncate block max-w-[96px]" title={ch.servers[0].server_name ?? undefined}>
                          {ch.servers[0].server_name ?? `#${ch.servers[0].server_id}`}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* CLIENTS */}
                    <td className="px-3 py-3 text-center">
                      {(() => {
                        const count = viewerCounts[ch.id] ?? 0
                        return (
                          <button
                            type="button"
                            onClick={() => setViewersChannel(ch)}
                            title="İzleyicileri göster"
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold cursor-pointer transition ${
                              count > 0
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200'
                                : 'bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200'
                            }`}
                          >
                            <Users size={10} />
                            {count}
                          </button>
                        )
                      })()}
                    </td>

                    {/* UPTIME */}
                    <td className="px-3 py-3">
                      {ch.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {ch.uptime_seconds != null ? formatUptime(ch.uptime_seconds) : '00h 00m 00s'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-400 border border-gray-200">
                          Offline
                        </span>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        {/* Stop - blue square */}
                        <button
                          type="button"
                          title="Stop"
                          onClick={() => tvChannelsApi.stop(ch.id).then(() => queryClient.invalidateQueries({ queryKey: ['tv-channels'] }))}
                          className="flex items-center justify-center w-7 h-7 rounded bg-blue-500 hover:bg-blue-600 text-white transition"
                        >
                          <StopCircle size={12} />
                        </button>
                        {/* Start - dark square */}
                        <button
                          type="button"
                          title="Start"
                          onClick={() => tvChannelsApi.start(ch.id).then(() => queryClient.invalidateQueries({ queryKey: ['tv-channels'] }))}
                          className="flex items-center justify-center w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 text-white transition"
                        >
                          <Square size={12} />
                        </button>
                        {/* Reload - green */}
                        <button
                          type="button"
                          title="Reload"
                          onClick={() => tvChannelsApi.restart(ch.id).then(() => queryClient.invalidateQueries({ queryKey: ['tv-channels'] }))}
                          className="flex items-center justify-center w-7 h-7 rounded bg-emerald-500 hover:bg-emerald-600 text-white transition"
                        >
                          <RotateCcw size={12} />
                        </button>
                        {/* Edit - yellow */}
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => { setEditChannel(ch); setModalOpen(true) }}
                          className="flex items-center justify-center w-7 h-7 rounded bg-yellow-400 hover:bg-yellow-500 text-white transition"
                        >
                          <Edit2 size={12} />
                        </button>
                        {/* Delete - red */}
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => setDeleteId(ch.id)}
                          className="flex items-center justify-center w-7 h-7 rounded bg-red-500 hover:bg-red-600 text-white transition"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </td>

                    {/* PLAYER */}
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleTest(ch.id)}
                        disabled={testingId === ch.id}
                        title="Test Stream"
                        className="flex items-center justify-center w-8 h-7 rounded bg-emerald-500 hover:bg-emerald-600 text-white transition disabled:opacity-50"
                      >
                        {testingId === ch.id ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <Play size={12} />
                        )}
                      </button>
                    </td>

                    {/* EPG */}
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        title={ch.epg_channel_id ?? 'No EPG'}
                        className={`flex items-center justify-center w-7 h-7 rounded transition ${
                          ch.epg_channel_id
                            ? 'bg-blue-500 hover:bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-400 cursor-default'
                        }`}
                      >
                        <Mail size={12} />
                      </button>
                    </td>

                    {/* STREAM INFO */}
                    <td className="px-3 py-3">
                      <span className="text-xs text-gray-400">-</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-500">
                Showing {((safePage - 1) * pageSize) + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length} streams
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let pg = i + 1
                  if (totalPages > 7) {
                    if (safePage <= 4) pg = i + 1
                    else if (safePage >= totalPages - 3) pg = totalPages - 6 + i
                    else pg = safePage - 3 + i
                  }
                  return (
                    <button
                      key={pg}
                      type="button"
                      onClick={() => setPage(pg)}
                      className={`rounded border px-2.5 py-1.5 text-xs transition ${
                        pg === safePage
                          ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {pg}
                    </button>
                  )
                })}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <ChannelModal
          initial={editChannel}
          categories={categories}
          servers={servers}
          bouquets={bouquets}
          onClose={() => { setModalOpen(false); setEditChannel(null) }}
          saving={createMutation.isPending || updateMutation.isPending}
          onSave={(data) => {
            if (editChannel) {
              updateMutation.mutate({ id: editChannel.id, p: data as TvChannelUpdate })
            } else {
              createMutation.mutate(data as TvChannelCreate)
            }
          }}
        />
      )}

      {/* Delete Confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-red-500 font-semibold mb-2">
              <Trash2 size={18} />
              Delete Stream
            </div>
            <p className="text-sm text-gray-600">This stream will be permanently deleted. Are you sure?</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteId(null)} className="px-4 py-2 rounded text-sm text-gray-500 hover:text-gray-800 transition">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 rounded bg-red-600 hover:bg-red-500 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
              >
                {deleteMutation.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewers Modal */}
      {viewersChannel !== null && (
        <ViewersModal
          channelName={viewersChannel.name}
          channelId={viewersChannel.id}
          onClose={() => setViewersChannel(null)}
        />
      )}
    </div>
  )
}
