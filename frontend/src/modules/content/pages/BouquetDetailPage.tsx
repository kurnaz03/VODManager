import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Check, Film, Loader2, MonitorPlay, Music, Plus, Radio,
  Save, Search, Trash2, Tv,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import {
  BouquetItem, BouquetItemType, BouquetPayload, BouquetType,
  contentApi, moviesApi, radioApi, seriesApi, tvApi,
} from '../services/contentApi'
import { playlistApi } from '../../playlist/services/playlistApi'

type TabKey = BouquetItemType
interface TabConfig { key: TabKey; label: string; icon: React.ElementType }

const TABS: TabConfig[] = [
  { key: 'tv', label: 'TV', icon: Tv },
  { key: 'series', label: 'Diziler', icon: MonitorPlay },
  { key: 'vod_channel', label: 'VOD Kanallar', icon: Radio },
  { key: 'radio', label: 'Radyo', icon: Music },
  { key: 'movie', label: 'Filmler', icon: Film },
]

interface BouquetFormValues {
  name: string
  description: string
  bouquet_type: BouquetType
  is_active: boolean
  sort_order: number
}

function useContentForTab(tab: TabKey) {
  const tvQ = useQuery({ queryKey: ['tv-all'], queryFn: () => tvApi.list(), enabled: tab === 'tv' })
  const seriesQ = useQuery({ queryKey: ['series-all'], queryFn: () => seriesApi.list(), enabled: tab === 'series' })
  const playlistQ = useQuery({ queryKey: ['playlists'], queryFn: () => playlistApi.list(), enabled: tab === 'vod_channel' })
  const radioQ = useQuery({ queryKey: ['radio-all'], queryFn: () => radioApi.list(), enabled: tab === 'radio' })
  const moviesQ = useQuery({ queryKey: ['movies-all'], queryFn: () => moviesApi.list(), enabled: tab === 'movie' })

  const items = useMemo(() => {
    if (tab === 'tv') return (tvQ.data ?? []).map(i => ({ id: i.id, title: i.title, logo: i.logo_url }))
    if (tab === 'series') return (seriesQ.data ?? []).map(i => ({ id: i.id, title: i.title, logo: i.poster_url }))
    if (tab === 'vod_channel') return (playlistQ.data ?? []).map(i => ({ id: i.id, title: i.name, logo: null }))
    if (tab === 'radio') return (radioQ.data ?? []).map(i => ({ id: i.id, title: i.title, logo: i.logo_url }))
    if (tab === 'movie') return (moviesQ.data ?? []).map(i => ({ id: i.id, title: i.title, logo: i.poster_url }))
    return []
  }, [tab, tvQ.data, seriesQ.data, playlistQ.data, radioQ.data, moviesQ.data])

  const isLoading = tab === 'tv' ? tvQ.isLoading
    : tab === 'series' ? seriesQ.isLoading
    : tab === 'vod_channel' ? playlistQ.isLoading
    : tab === 'radio' ? radioQ.isLoading
    : moviesQ.isLoading

  return { items, isLoading }
}

export default function BouquetDetailPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabKey>('tv')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const bouquetQ = useQuery({
    queryKey: ['bouquet', id],
    queryFn: () => contentApi.getBouquet(id),
  })

  const bouquetItemsQ = useQuery({
    queryKey: ['bouquet-items', id],
    queryFn: () => contentApi.listBouquetItems(id),
  })

  const { register, handleSubmit, reset } = useForm<BouquetFormValues>()

  useEffect(() => {
    if (!bouquetQ.data) return
    reset({
      name: bouquetQ.data.name,
      description: bouquetQ.data.description ?? '',
      bouquet_type: bouquetQ.data.bouquet_type,
      is_active: bouquetQ.data.is_active,
      sort_order: bouquetQ.data.sort_order,
    })
  }, [bouquetQ.data, reset])

  // Reset selection on tab change
  useEffect(() => {
    setSelectedIds(new Set())
    setSearch('')
  }, [activeTab])

  const updateMut = useMutation({
    mutationFn: (payload: Partial<BouquetPayload>) => contentApi.updateBouquet(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bouquet', id] })
      queryClient.invalidateQueries({ queryKey: ['bouquets'] })
      showToast('Bouquet guncellendi', 'ok')
    },
    onError: () => showToast('Guncelleme hatasi', 'err'),
  })

  const addItemsMut = useMutation({
    mutationFn: (items: Array<{ item_type: BouquetItemType; item_id: number }>) =>
      contentApi.addBouquetItems(id, items.map(i => ({ item_type: i.item_type, item_id: i.item_id }))),
    onSuccess: (added) => {
      queryClient.invalidateQueries({ queryKey: ['bouquet-items', id] })
      queryClient.invalidateQueries({ queryKey: ['bouquets'] })
      setSelectedIds(new Set())
      showToast(`${added.length} medya eklendi`, 'ok')
    },
    onError: () => showToast('Ekleme hatasi', 'err'),
  })

  const removeItemMut = useMutation({
    mutationFn: (itemId: number) => contentApi.removeBouquetItem(id, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bouquet-items', id] })
      queryClient.invalidateQueries({ queryKey: ['bouquets'] })
      showToast('Medya kaldirildi', 'ok')
    },
    onError: () => showToast('Kaldirma hatasi', 'err'),
  })

  const { items: contentItems, isLoading: contentLoading } = useContentForTab(activeTab)

  const assignedIds = useMemo(() => {
    const s = new Set<number>()
    ;(bouquetItemsQ.data ?? []).filter(bi => bi.item_type === activeTab).forEach(bi => s.add(bi.item_id))
    return s
  }, [bouquetItemsQ.data, activeTab])

  const filtered = useMemo(() => {
    if (!search.trim()) return contentItems
    const q = search.toLowerCase()
    return contentItems.filter(i => i.title.toLowerCase().includes(q))
  }, [contentItems, search])

  function toggleSelect(itemId: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  function handleAddSelected() {
    const toAdd = Array.from(selectedIds)
      .filter(itemId => !assignedIds.has(itemId))
      .map(item_id => ({ item_type: activeTab, item_id }))
    if (toAdd.length === 0) {
      showToast('Tum secililer zaten eklenmis', 'err')
      return
    }
    addItemsMut.mutate(toAdd)
  }

  function onSaveBouquet(values: BouquetFormValues) {
    updateMut.mutate({
      name: values.name,
      description: values.description || null,
      bouquet_type: values.bouquet_type,
      is_active: values.is_active,
      sort_order: Number(values.sort_order),
    })
  }

  const bouquetItems = bouquetItemsQ.data ?? []

  // Group bouquet items by type for display
  const itemsByTab = useMemo(() => {
    const m: Record<string, BouquetItem[]> = {}
    for (const bi of bouquetItems) {
      if (!m[bi.item_type]) m[bi.item_type] = []
      m[bi.item_type].push(bi)
    }
    return m
  }, [bouquetItems])

  if (bouquetQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  if (!bouquetQ.data) {
    return (
      <div className="p-6 text-center text-slate-500">
        Bouquet bulunamadi.
        <Link to="/bouquets" className="ml-2 text-blue-600 underline">Geri don</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 rounded-xl px-5 py-3 text-sm font-semibold shadow-xl text-white transition-all
          ${toast.type === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/bouquets"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
        >
          <ArrowLeft size={16} />
          Bouquets
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{bouquetQ.data.name}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{bouquetItems.length} medya ögesi</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT: Bouquet settings */}
        <div className="xl:col-span-1 flex flex-col gap-4">
          {/* Info Card */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Bouquet Bilgileri</h2>
            <form onSubmit={handleSubmit(onSaveBouquet)} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Ad</label>
                <input
                  {...register('name', { required: true })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                  placeholder="Bouquet adi"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Aciklama</label>
                <textarea
                  {...register('description')}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tip</label>
                  <select
                    {...register('bouquet_type')}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none bg-white"
                  >
                    <option value="mixed">Karisik</option>
                    <option value="movies">Filmler</option>
                    <option value="series">Diziler</option>
                    <option value="tv">TV</option>
                    <option value="radio">Radyo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Sira</label>
                  <input
                    {...register('sort_order', { valueAsNumber: true })}
                    type="number"
                    min={0}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input {...register('is_active')} type="checkbox" className="h-4 w-4 rounded accent-blue-500" />
                <span className="text-sm text-slate-600">Aktif</span>
              </label>
              <button
                type="submit"
                disabled={updateMut.isPending}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
              >
                {updateMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Kaydet
              </button>
            </form>
          </div>

          {/* Current items summary */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Mevcut Medyalar</h2>
            {bouquetItemsQ.isLoading ? (
              <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-slate-400" /></div>
            ) : bouquetItems.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Henuz medya eklenmedi</p>
            ) : (
              <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
                {TABS.map(tab => {
                  const tabItems = itemsByTab[tab.key] ?? []
                  if (tabItems.length === 0) return null
                  return (
                    <div key={tab.key} className="mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                        <tab.icon size={12} />
                        {tab.label} ({tabItems.length})
                      </div>
                      {tabItems.map(bi => (
                        <div key={bi.id} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-slate-50 group">
                          {bi.item_logo ? (
                            <img src={bi.item_logo} alt="" className="h-6 w-4 object-cover rounded shrink-0"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          ) : (
                            <div className="h-6 w-4 rounded bg-slate-100 shrink-0" />
                          )}
                          <span className="text-xs text-slate-700 truncate flex-1">{bi.item_title ?? `#${bi.item_id}`}</span>
                          <button
                            onClick={() => removeItemMut.mutate(bi.id)}
                            disabled={removeItemMut.isPending}
                            className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600 transition"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Content browser */}
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition border-b-2 -mb-px
                  ${activeTab === tab.key
                    ? 'border-blue-500 text-blue-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              >
                <tab.icon size={13} />
                {tab.label}
                {(itemsByTab[tab.key]?.length ?? 0) > 0 && (
                  <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600 font-bold leading-none">
                    {itemsByTab[tab.key].length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search + Add button */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ara..."
                className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
            {selectedIds.size > 0 && (
              <button
                onClick={handleAddSelected}
                disabled={addItemsMut.isPending}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition shrink-0"
              >
                {addItemsMut.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {selectedIds.size} Ekle
              </button>
            )}
          </div>

          {/* Content list */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: '500px' }}>
            {contentLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-slate-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <p className="text-sm">Icerik bulunamadi</p>
                {search && (
                  <button onClick={() => setSearch('')} className="mt-2 text-xs text-blue-500 underline">Aramayı temizle</button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filtered.map(item => {
                  const isAssigned = assignedIds.has(item.id)
                  const isSelected = selectedIds.has(item.id)
                  return (
                    <div
                      key={item.id}
                      onClick={() => !isAssigned && toggleSelect(item.id)}
                      className={`flex items-center gap-3 px-4 py-2.5 transition
                        ${isAssigned
                          ? 'bg-emerald-50 cursor-default'
                          : isSelected
                          ? 'bg-blue-50 cursor-pointer'
                          : 'hover:bg-slate-50 cursor-pointer'}`}
                    >
                      {/* Checkbox/Status */}
                      <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 border transition
                        ${isAssigned
                          ? 'bg-emerald-500 border-emerald-500'
                          : isSelected
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-slate-300 bg-white'}`}
                      >
                        {(isAssigned || isSelected) && <Check size={11} className="text-white" strokeWidth={3} />}
                      </div>

                      {/* Logo */}
                      {item.logo ? (
                        <img
                          src={item.logo}
                          alt={item.title}
                          className="h-8 w-6 object-cover rounded shrink-0"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className="h-8 w-6 rounded bg-slate-100 flex items-center justify-center shrink-0">
                          <Film size={12} className="text-slate-400" />
                        </div>
                      )}

                      {/* Title */}
                      <span className={`text-sm truncate flex-1 ${isAssigned ? 'text-emerald-700 font-medium' : 'text-slate-700'}`}>
                        {item.title}
                      </span>

                      {/* Status badge */}
                      {isAssigned ? (
                        <span className="text-xs text-emerald-600 font-semibold shrink-0">Eklendi</span>
                      ) : isSelected ? (
                        <span className="text-xs text-blue-600 font-semibold shrink-0">Secildi</span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between bg-slate-50">
            <span className="text-xs text-slate-500">{filtered.length} icerik</span>
            {selectedIds.size > 0 && (
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-slate-600">
                Secimi temizle
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
