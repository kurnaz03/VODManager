import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Edit2,
  MonitorPlay,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { tvChannelsApi, TvChannel, TvChannelCreate, TvChannelUpdate } from '../services/tvChannelsApi'
import { contentApi, Category } from '../../content/services/contentApi'
import { serversApi, Server as ServerType } from '../../servers/services/serversApi'

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(active: boolean) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Aktif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Pasif
    </span>
  )
}

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
    }
    onSave(data)
  }

  const inputCls =
    'w-full rounded bg-white border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition'
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2 text-gray-800 font-semibold text-base">
            <MonitorPlay size={18} className="text-blue-500" />
            {isEdit ? 'Kanal Duzenle' : 'Yeni Kanal Ekle'}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Kanal Adi *</label>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="TRT 1"
              />
            </div>
            <div>
              <label className={labelCls}>EPG Kanal ID</label>
              <input
                className={inputCls}
                value={epgId}
                onChange={(e) => setEpgId(e.target.value)}
                placeholder="trt1.tr"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Stream URL *</label>
            <input
              className={inputCls}
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              required
              placeholder="http://example.com/live/ch1.m3u8"
            />
          </div>

          <div>
            <label className={labelCls}>Logo URL</label>
            <input
              className={inputCls}
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://cdn.example.com/logo.png"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Kategori</label>
              <select
                className={inputCls}
                value={categoryId ?? ''}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Kategori Sec</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Siralama</label>
              <input
                type="number"
                className={inputCls}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                min={0}
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className={labelCls}>Durum</label>
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={`flex items-center gap-2 rounded px-3 py-2 text-sm font-medium border transition ${
                  isActive
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-gray-100 border-gray-300 text-gray-500'
                }`}
              >
                {isActive ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {isActive ? 'Aktif' : 'Pasif'}
              </button>
            </div>
          </div>

          {/* Multi-select Servers */}
          <div>
            <label className={labelCls}>
              <Server size={12} className="inline mr-1" />
              Sunucu Atamasi (coklu secim)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto rounded border border-gray-300 bg-gray-50 p-2">
              {servers.length === 0 && (
                <span className="text-xs text-gray-400 col-span-3">Sunucu bulunamadi</span>
              )}
              {servers.map((srv) => {
                const sel = selectedServers.includes(srv.id)
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => toggleServer(srv.id)}
                    className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-left transition border ${
                      sel
                        ? 'bg-blue-100 border-blue-400 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'
                    }`}
                  >
                    <Server size={11} />
                    <span className="truncate">{srv.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Multi-select Bouquets */}
          <div>
            <label className={labelCls}>
              <Zap size={12} className="inline mr-1" />
              Bouquet Atamasi (coklu secim)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto rounded border border-gray-300 bg-gray-50 p-2">
              {bouquets.length === 0 && (
                <span className="text-xs text-gray-400 col-span-3">Bouquet bulunamadi</span>
              )}
              {bouquets.map((bq) => {
                const sel = selectedBouquets.includes(bq.id)
                return (
                  <button
                    key={bq.id}
                    type="button"
                    onClick={() => toggleBouquet(bq.id)}
                    className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-left transition border ${
                      sel
                        ? 'bg-purple-100 border-purple-400 text-purple-700'
                        : 'bg-white border-gray-300 text-gray-600 hover:border-purple-400'
                    }`}
                  >
                    <Zap size={11} />
                    <span className="truncate">{bq.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded text-sm text-gray-500 hover:text-gray-800 transition">
              Iptal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded bg-blue-600 hover:bg-blue-500 px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Olustur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TvChannelsPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editChannel, setEditChannel] = useState<TvChannel | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; ok: boolean; msg: string } | null>(null)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [filterCat, setFilterCat] = useState<number | null>(null)

  const channelsQuery = useQuery({
    queryKey: ['tv-channels', filterCat],
    queryFn: () => tvChannelsApi.list(filterCat ?? undefined),
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
      setTestResult({ id, ok: false, msg: 'Test basarisiz' })
    } finally {
      setTestingId(null)
    }
  }

  const channels: TvChannel[] = channelsQuery.data ?? []
  const categories: Category[] = categoriesQuery.data ?? []
  const servers: ServerType[] = serversQuery.data ?? []
  const bouquets = bouquetsQuery.data ?? []

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <MonitorPlay size={20} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-gray-400">Xtream Codes</div>
              <h1 className="text-xl font-bold text-gray-800">TV Kanallari</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['tv-channels'] })}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-600 hover:text-gray-900 hover:border-gray-400 transition shadow-sm"
            >
              <RefreshCw size={13} />
              Yenile
            </button>
            <button
              type="button"
              onClick={() => { setEditChannel(null); setModalOpen(true) }}
              className="flex items-center gap-2 rounded-lg bg-green-500 hover:bg-green-600 px-4 py-2 text-sm font-semibold text-white transition shadow-sm"
            >
              <Plus size={15} />
              Yeni Kanal
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 pt-5">
        {[
          { label: 'Toplam Kanal', value: channels.length, color: 'text-blue-600' },
          { label: 'Aktif', value: channels.filter((c) => c.is_active).length, color: 'text-emerald-600' },
          { label: 'Pasif', value: channels.filter((c) => !c.is_active).length, color: 'text-gray-400' },
          { label: 'Kategori', value: categories.length, color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
        <button
          type="button"
          onClick={() => setFilterCat(null)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition border ${
            filterCat === null
              ? 'bg-blue-500 border-blue-500 text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-400'
          }`}
        >
          Tumu
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setFilterCat(cat.id)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition border ${
              filterCat === cat.id
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-400'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Test Result Banner */}
      {testResult && (
        <div
          className={`mx-6 mt-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
            testResult.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {testResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>Kanal #{testResult.id}: {testResult.msg}</span>
          <button type="button" onClick={() => setTestResult(null)} className="ml-auto text-current opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="px-6 pb-4 pt-4">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {['#', 'Logo', 'Ad', 'Kategori', 'Stream URL', 'Sunucular', 'Bouquets', 'Durum', 'Aksiyonlar'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {channelsQuery.isLoading && (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center text-gray-400">
                      <RefreshCw size={18} className="animate-spin inline mr-2" />
                      Yukleniyor...
                    </td>
                  </tr>
                )}
                {!channelsQuery.isLoading && channels.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center text-gray-400">
                      Hic kanal eklenmemis. "Yeni Kanal" ile baslayabilirsiniz.
                    </td>
                  </tr>
                )}
                {channels.map((ch) => (
                  <tr
                    key={ch.id}
                    className="border-b border-gray-100 transition hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{ch.id}</td>
                    <td className="px-4 py-3">
                      {ch.logo_url ? (
                        <img src={ch.logo_url} alt={ch.name} className="h-8 w-12 object-contain rounded bg-gray-100" />
                      ) : (
                        <div className="flex h-8 w-12 items-center justify-center rounded bg-gray-100 text-gray-400">
                          <MonitorPlay size={14} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{ch.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{ch.category_name ?? <span className="text-gray-300">-</span>}</td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <span className="block truncate text-xs text-gray-500 font-mono" title={ch.stream_url}>
                        {ch.stream_url}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {ch.servers.length === 0 ? (
                        <span className="text-xs text-gray-300">-</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {ch.servers.map((s) => (
                            <span key={s.id} className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-xs text-blue-700">
                              {s.server_name ?? `#${s.server_id}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ch.bouquet_assignments.length === 0 ? (
                        <span className="text-xs text-gray-300">-</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {ch.bouquet_assignments.map((b) => (
                            <span key={b.id} className="rounded bg-purple-50 border border-purple-200 px-1.5 py-0.5 text-xs text-purple-700">
                              {b.bouquet_name ?? `#${b.bouquet_id}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{statusBadge(ch.is_active)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTest(ch.id)}
                          disabled={testingId === ch.id}
                          title="Stream Test"
                          className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-amber-600 hover:border-amber-400 hover:bg-amber-50 transition disabled:opacity-50 shadow-sm"
                        >
                          {testingId === ch.id ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                          Test
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditChannel(ch); setModalOpen(true) }}
                          title="Duzenle"
                          className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition shadow-sm"
                        >
                          <Edit2 size={12} />
                          Duzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(ch.id)}
                          title="Sil"
                          className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-red-500 hover:border-red-400 hover:bg-red-50 transition shadow-sm"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-red-500 font-semibold mb-2">
              <Trash2 size={18} />
              Kanali Sil
            </div>
            <p className="text-sm text-gray-600">Bu kanal kalici olarak silinecek. Emin misiniz?</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteId(null)} className="px-4 py-2 rounded text-sm text-gray-500 hover:text-gray-800 transition">
                Iptal
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 rounded bg-red-600 hover:bg-red-500 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
              >
                {deleteMutation.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleteMutation.isPending ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
