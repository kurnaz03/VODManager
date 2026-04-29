import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Radio, Music, ListMusic, Plus, Trash2, Pencil, X, Play, Square,
  Search, Clock, Link2, Image, Film, Wifi, ChevronUp, ChevronDown, Hash,
} from 'lucide-react'
import {
  contentApi, Category, RadioContent, RadioContentCreate,
  musicApi, MusicTrack, MusicTrackCreate, MusicPlaylist, MusicPlaylistCreate,
  radioApi,
} from '../services/contentApi'
import { serversApi, Server } from '../../servers/services/serversApi'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(secs: number | null): string {
  if (secs == null) return '-'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function VisualTypeBadge({ type }: { type: 'video' | 'image' | 'none' }) {
  if (type === 'video')
    return <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700"><Film size={10} />Video</span>
  if (type === 'image')
    return <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700"><Image size={10} />Resim</span>
  return <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">-</span>
}

function StatusBadge({ status }: { status: 'playing' | 'stopped' }) {
  if (status === 'playing')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Yayin Var
      </span>
    )
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"><Square size={9} />Durduruldu</span>
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteModal({ title, onConfirm, onCancel, loading }: {
  title: string; onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Silme Onay</h3>
        <p className="mt-2 text-sm text-slate-600">
          <strong>{title}</strong> silinecek. Emin misiniz?
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" className="secondary-button" onClick={onCancel}><X size={16} />Iptal</button>
          <button type="button" className="danger-button" onClick={onConfirm} disabled={loading}>
            <Trash2 size={16} />{loading ? 'Siliniyor...' : 'Sil'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Radyo Kanallari
// ══════════════════════════════════════════════════════════════════════════════

function RadioChannelsTab() {
  const queryClient = useQueryClient()
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [editItem, setEditItem] = useState<RadioContent | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedCat, setSelectedCat] = useState<number | null>(null)
  const [form, setForm] = useState<RadioContentCreate>({
    title: '', description: null, stream_url: null, category_id: null,
    logo_url: null, visual_url: null, visual_type: 'none', is_public: true,
  })

  const categoriesQ = useQuery({ queryKey: ['categories', 'radio'], queryFn: () => contentApi.listCategories('radio') })
  const radioQ = useQuery({ queryKey: ['radio', selectedCat], queryFn: () => radioApi.list(selectedCat ?? undefined) })

  const addMutation = useMutation({
    mutationFn: (p: RadioContentCreate) => radioApi.create(p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['radio'] }); setShowAdd(false); resetForm() },
  })
  const editMutation = useMutation({
    mutationFn: ({ id, p }: { id: number; p: Partial<RadioContentCreate> }) => radioApi.update(id, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['radio'] }); setEditItem(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => radioApi.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['radio'] }); setDeleteId(null) },
  })

  const categories: Category[] = categoriesQ.data ?? []
  const radioList: RadioContent[] = radioQ.data ?? []

  function resetForm() {
    setForm({ title: '', description: null, stream_url: null, category_id: null, logo_url: null, visual_url: null, visual_type: 'none', is_public: true })
  }

  function openEdit(item: RadioContent) {
    setEditItem(item)
    setForm({
      title: item.title, description: item.description, stream_url: item.stream_url,
      category_id: item.category_id, logo_url: item.logo_url, visual_url: item.visual_url,
      visual_type: item.visual_type ?? 'none', is_public: item.is_public,
    })
  }

  const pending = addMutation.isPending || editMutation.isPending

  const RadioModal = ({ isEdit }: { isEdit: boolean }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{isEdit ? 'Kanal Duzenle' : 'Yeni Radyo Kanali'}</h3>
          <button type="button" className="rounded-full p-1 hover:bg-slate-100" onClick={() => { isEdit ? setEditItem(null) : setShowAdd(false); resetForm() }}><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="panel-label">Baslik *</label>
            <input className="panel-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Kanal adi" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="panel-label">Stream URL</label>
              <input className="panel-input" value={form.stream_url ?? ''} onChange={e => setForm(f => ({ ...f, stream_url: e.target.value || null }))} placeholder="rtmp://..." />
            </div>
            <div>
              <label className="panel-label">Kategori</label>
              <select className="panel-select" value={form.category_id ?? ''} onChange={e => setForm(f => ({ ...f, category_id: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">Seciniz</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="panel-label">Logo URL</label>
              <input className="panel-input" value={form.logo_url ?? ''} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value || null }))} placeholder="https://..." />
            </div>
            <div>
              <label className="panel-label">Gorsel Tip</label>
              <select className="panel-select" value={form.visual_type ?? 'none'} onChange={e => setForm(f => ({ ...f, visual_type: e.target.value as 'video' | 'image' | 'none' }))}>
                <option value="none">Yok</option>
                <option value="image">Resim</option>
                <option value="video">Video</option>
              </select>
            </div>
          </div>
          {form.visual_type !== 'none' && (
            <div>
              <label className="panel-label">Gorsel URL (dongu)</label>
              <input className="panel-input" value={form.visual_url ?? ''} onChange={e => setForm(f => ({ ...f, visual_url: e.target.value || null }))} placeholder="https://..." />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="radio-public" checked={form.is_public ?? true} onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))} className="h-4 w-4 rounded" />
            <label htmlFor="radio-public" className="text-sm text-slate-700">Herkese Acik</label>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="secondary-button" onClick={() => { isEdit ? setEditItem(null) : setShowAdd(false); resetForm() }}><X size={16} />Iptal</button>
          <button type="button" className="primary-button" disabled={!form.title || pending}
            onClick={() => isEdit ? editMutation.mutate({ id: editItem!.id, p: form }) : addMutation.mutate(form)}>
            {pending ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Ekle'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedCat(null)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${selectedCat === null ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Tumu
          </button>
          {categories.map(cat => (
            <button key={cat.id} type="button" onClick={() => setSelectedCat(cat.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${selectedCat === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {cat.name}
            </button>
          ))}
        </div>
        <button type="button" className="primary-button" onClick={() => { resetForm(); setShowAdd(true) }}>
          <Plus size={16} />Kanal Ekle
        </button>
      </div>

      <div className="table-shell overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="table-head text-left">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Logo</th>
              <th className="px-4 py-3">Baslik</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Stream URL</th>
              <th className="px-4 py-3">Gorsel</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Islemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {radioList.map(item => (
              <tr key={item.id} className="table-zebra hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">#{item.id}</td>
                <td className="px-4 py-3">
                  {item.logo_url
                    ? <img src={item.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                    : <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100"><Radio size={14} className="text-slate-400" /></span>}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                <td className="px-4 py-3 text-slate-500">{item.category_name ?? '-'}</td>
                <td className="px-4 py-3 max-w-[180px] truncate text-slate-400 text-xs font-mono">{item.stream_url ?? '-'}</td>
                <td className="px-4 py-3"><VisualTypeBadge type={item.visual_type ?? 'none'} /></td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${item.is_public ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {item.is_public ? 'Acik' : 'Kapali'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button type="button" className="secondary-button px-3 py-2 text-xs" onClick={() => openEdit(item)}><Pencil size={13} />Duzenle</button>
                    <button type="button" className="danger-button px-3 py-2 text-xs" onClick={() => setDeleteId(item.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {radioList.length === 0 && (
              <tr><td colSpan={8} className="px-6 py-16 text-center text-sm text-slate-400">
                {radioQ.isLoading ? 'Yukleniyor...' : 'Radyo kanali bulunamadi.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && <RadioModal isEdit={false} />}
      {editItem && <RadioModal isEdit={true} />}
      {deleteId !== null && (
        <DeleteModal
          title={radioList.find(r => r.id === deleteId)?.title ?? String(deleteId)}
          onConfirm={() => deleteMutation.mutate(deleteId)}
          onCancel={() => setDeleteId(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Muzik Kutuphanesi
// ══════════════════════════════════════════════════════════════════════════════

function MusicLibraryTab() {
  const queryClient = useQueryClient()
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [editItem, setEditItem] = useState<MusicTrack | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState<number | null>(null)
  const [form, setForm] = useState<MusicTrackCreate>({ title: '', artist: null, stream_url: null, category_id: null, cover_url: null })

  const categoriesQ = useQuery({ queryKey: ['categories', 'radio'], queryFn: () => contentApi.listCategories('radio') })
  const tracksQ = useQuery({ queryKey: ['music-tracks', selectedCat], queryFn: () => musicApi.tracks.list(selectedCat ?? undefined) })

  const addMutation = useMutation({
    mutationFn: (p: MusicTrackCreate) => musicApi.tracks.create(p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['music-tracks'] }); setShowAdd(false); resetForm() },
  })
  const editMutation = useMutation({
    mutationFn: ({ id, p }: { id: number; p: Partial<MusicTrackCreate> }) => musicApi.tracks.update(id, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['music-tracks'] }); setEditItem(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => musicApi.tracks.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['music-tracks'] }); setDeleteId(null) },
  })

  const categories: Category[] = categoriesQ.data ?? []
  const allTracks: MusicTrack[] = tracksQ.data ?? []
  const tracks = allTracks.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.artist ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function resetForm() { setForm({ title: '', artist: null, stream_url: null, category_id: null, cover_url: null }) }

  function openEdit(item: MusicTrack) {
    setEditItem(item)
    setForm({ title: item.title, artist: item.artist, stream_url: item.stream_url, category_id: item.category_id, cover_url: item.cover_url })
  }

  const pending = addMutation.isPending || editMutation.isPending

  const TrackModal = ({ isEdit }: { isEdit: boolean }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{isEdit ? 'Parca Duzenle' : 'Yeni Muzik Parcasi'}</h3>
          <button type="button" className="rounded-full p-1 hover:bg-slate-100" onClick={() => { isEdit ? setEditItem(null) : setShowAdd(false); resetForm() }}><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="panel-label">Baslik *</label>
              <input className="panel-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Sarki adi" />
            </div>
            <div>
              <label className="panel-label">Artist</label>
              <input className="panel-input" value={form.artist ?? ''} onChange={e => setForm(f => ({ ...f, artist: e.target.value || null }))} placeholder="Artist adi" />
            </div>
          </div>
          <div>
            <label className="panel-label">Stream URL (harici muzik)</label>
            <input className="panel-input" value={form.stream_url ?? ''} onChange={e => setForm(f => ({ ...f, stream_url: e.target.value || null }))} placeholder="https://example.com/track.mp3" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="panel-label">Kategori</label>
              <select className="panel-select" value={form.category_id ?? ''} onChange={e => setForm(f => ({ ...f, category_id: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">Seciniz</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="panel-label">Kapak URL</label>
              <input className="panel-input" value={form.cover_url ?? ''} onChange={e => setForm(f => ({ ...f, cover_url: e.target.value || null }))} placeholder="https://..." />
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="secondary-button" onClick={() => { isEdit ? setEditItem(null) : setShowAdd(false); resetForm() }}><X size={16} />Iptal</button>
          <button type="button" className="primary-button" disabled={!form.title || pending}
            onClick={() => isEdit ? editMutation.mutate({ id: editItem!.id, p: form }) : addMutation.mutate(form)}>
            {pending ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Ekle'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="panel-input pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara: baslik, artist..." />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSelectedCat(null)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${selectedCat === null ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Tumu
          </button>
          {categories.map(cat => (
            <button key={cat.id} type="button" onClick={() => setSelectedCat(cat.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${selectedCat === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {cat.name}
            </button>
          ))}
        </div>
        <button type="button" className="primary-button" onClick={() => { resetForm(); setShowAdd(true) }}>
          <Plus size={16} />Parca Ekle
        </button>
      </div>

      <div className="table-shell overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="table-head text-left">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Kapak</th>
              <th className="px-4 py-3">Baslik</th>
              <th className="px-4 py-3">Artist</th>
              <th className="px-4 py-3">Sure</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Kaynak</th>
              <th className="px-4 py-3">Islemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tracks.map(item => (
              <tr key={item.id} className="table-zebra hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">#{item.id}</td>
                <td className="px-4 py-3">
                  {item.cover_url
                    ? <img src={item.cover_url} alt="" className="h-9 w-9 rounded-xl object-cover" />
                    : <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-sky-100"><Music size={14} className="text-violet-400" /></span>}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                <td className="px-4 py-3 text-slate-500">{item.artist ?? '-'}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-slate-500"><Clock size={12} />{fmtDuration(item.duration_seconds)}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{item.category_name ?? '-'}</td>
                <td className="px-4 py-3">
                  {item.stream_url
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700"><Link2 size={10} />URL</span>
                    : item.file_path
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"><Music size={10} />Dosya</span>
                      : <span className="text-xs text-slate-400">-</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button type="button" className="secondary-button px-3 py-2 text-xs" onClick={() => openEdit(item)}><Pencil size={13} />Duzenle</button>
                    <button type="button" className="danger-button px-3 py-2 text-xs" onClick={() => setDeleteId(item.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {tracks.length === 0 && (
              <tr><td colSpan={8} className="px-6 py-16 text-center text-sm text-slate-400">
                {tracksQ.isLoading ? 'Yukleniyor...' : 'Muzik parcasi bulunamadi.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && <TrackModal isEdit={false} />}
      {editItem && <TrackModal isEdit={true} />}
      {deleteId !== null && (
        <DeleteModal
          title={allTracks.find(t => t.id === deleteId)?.title ?? String(deleteId)}
          onConfirm={() => deleteMutation.mutate(deleteId)}
          onCancel={() => setDeleteId(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Muzik Playlistleri
// ══════════════════════════════════════════════════════════════════════════════

function PlaylistDetailModal({ playlist, onClose }: { playlist: MusicPlaylist; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [showAddTrack, setShowAddTrack] = useState(false)
  const [selectedTrackId, setSelectedTrackId] = useState<number | ''>('')

  const tracksQ = useQuery({ queryKey: ['music-tracks'], queryFn: () => musicApi.tracks.list() })
  const detailQ = useQuery({
    queryKey: ['music-playlist-detail', playlist.id],
    queryFn: () => musicApi.playlists.get(playlist.id),
    refetchInterval: playlist.status === 'playing' ? 5000 : false,
  })

  const pl: MusicPlaylist = detailQ.data ?? playlist

  const addItemMutation = useMutation({
    mutationFn: ({ track_id }: { track_id: number }) => musicApi.playlists.addItem(pl.id, track_id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['music-playlist-detail', pl.id] }); setShowAddTrack(false); setSelectedTrackId('') },
  })
  const removeItemMutation = useMutation({
    mutationFn: (item_id: number) => musicApi.playlists.removeItem(pl.id, item_id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['music-playlist-detail', pl.id] }),
  })
  const moveUpMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const items = [...pl.items].sort((a, b) => a.position - b.position)
      const idx = items.findIndex(i => i.id === itemId)
      if (idx <= 0) return
      const newOrder = [...items]
      ;[newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]]
      await musicApi.playlists.reorderItems(pl.id, newOrder.map(i => i.id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['music-playlist-detail', pl.id] }),
  })
  const moveDownMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const items = [...pl.items].sort((a, b) => a.position - b.position)
      const idx = items.findIndex(i => i.id === itemId)
      if (idx < 0 || idx >= items.length - 1) return
      const newOrder = [...items]
      ;[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
      await musicApi.playlists.reorderItems(pl.id, newOrder.map(i => i.id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['music-playlist-detail', pl.id] }),
  })

  const allTracks: MusicTrack[] = tracksQ.data ?? []
  const existingIds = new Set(pl.items.map(i => i.track_id))
  const availableTracks = allTracks.filter(t => !existingIds.has(t.id))
  const sortedItems = [...pl.items].sort((a, b) => a.position - b.position)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl" style={{ maxHeight: '90vh' }}>
        {/* header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-100"><ListMusic size={16} className="text-violet-600" /></span>
              <h3 className="text-lg font-semibold text-slate-900">{pl.name}</h3>
            </div>
            {pl.description && <p className="mt-1 ml-11 text-sm text-slate-500">{pl.description}</p>}
          </div>
          <button type="button" className="rounded-full p-1 hover:bg-slate-100" onClick={onClose}><X size={18} /></button>
        </div>

        {/* status bar */}
        {pl.status === 'playing' && detailQ.data && (
          <div className="mx-6 mb-4 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" /></span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-emerald-800">CANLI YAYIN</p>
                {detailQ.data.items.length > 0 && <p className="text-sm text-emerald-700 truncate">{detailQ.data.items[0]?.track?.title}</p>}
              </div>
              {pl.stream_url && <span className="text-xs font-mono text-emerald-600 truncate max-w-[140px]">{pl.stream_url}</span>}
            </div>
          </div>
        )}

        {/* track list */}
        <div className="flex-1 overflow-y-auto px-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">{sortedItems.length} Parca</p>
            <button type="button" className="secondary-button px-3 py-2 text-xs" onClick={() => setShowAddTrack(v => !v)}>
              <Plus size={13} />Parca Ekle
            </button>
          </div>

          {showAddTrack && (
            <div className="mb-4 rounded-2xl border border-slate-200 p-4">
              <p className="mb-2 text-sm font-medium text-slate-700">Kutuphaneden Sec</p>
              <div className="flex gap-2">
                <select className="panel-select flex-1" value={selectedTrackId} onChange={e => setSelectedTrackId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Parca seciniz...</option>
                  {availableTracks.map(t => <option key={t.id} value={t.id}>{t.title}{t.artist ? ` — ${t.artist}` : ''}</option>)}
                </select>
                <button type="button" className="primary-button px-4" disabled={!selectedTrackId || addItemMutation.isPending}
                  onClick={() => selectedTrackId && addItemMutation.mutate({ track_id: Number(selectedTrackId) })}>
                  Ekle
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {sortedItems.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3 py-3">
                <span className="w-6 text-center text-xs font-mono text-slate-400">{idx + 1}</span>
                {item.track.cover_url
                  ? <img src={item.track.cover_url} alt="" className="h-9 w-9 rounded-xl object-cover flex-shrink-0" />
                  : <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-sky-100 flex-shrink-0"><Music size={14} className="text-violet-400" /></span>}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.track.title}</p>
                  <p className="text-xs text-slate-400">{item.track.artist ?? ''}{item.track.duration_seconds ? ` · ${fmtDuration(item.track.duration_seconds)}` : ''}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button type="button" className="rounded-xl p-1.5 hover:bg-slate-100 text-slate-400 disabled:opacity-30" disabled={idx === 0} onClick={() => moveUpMutation.mutate(item.id)}><ChevronUp size={14} /></button>
                  <button type="button" className="rounded-xl p-1.5 hover:bg-slate-100 text-slate-400 disabled:opacity-30" disabled={idx === sortedItems.length - 1} onClick={() => moveDownMutation.mutate(item.id)}><ChevronDown size={14} /></button>
                  <button type="button" className="rounded-xl p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500" onClick={() => removeItemMutation.mutate(item.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {sortedItems.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">Playlist bos. Yukaridan parca ekleyin.</p>
            )}
          </div>
        </div>
        <div className="p-6 pt-4">
          <button type="button" className="secondary-button w-full justify-center" onClick={onClose}><X size={16} />Kapat</button>
        </div>
      </div>
    </div>
  )
}

function MusicPlaylistsTab() {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<MusicPlaylist | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [detailPlaylist, setDetailPlaylist] = useState<MusicPlaylist | null>(null)
  const [form, setForm] = useState<MusicPlaylistCreate>({ name: '', description: null, visual_url: null, visual_type: 'none', server_id: null })

  const playlistsQ = useQuery({
    queryKey: ['music-playlists'],
    queryFn: () => musicApi.playlists.list(),
    refetchInterval: 10000,
  })
  const serversQ = useQuery({ queryKey: ['servers'], queryFn: () => serversApi.list() })

  const addMutation = useMutation({
    mutationFn: (p: MusicPlaylistCreate) => musicApi.playlists.create(p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['music-playlists'] }); setShowAdd(false); resetForm() },
  })
  const editMutation = useMutation({
    mutationFn: ({ id, p }: { id: number; p: Partial<MusicPlaylistCreate> }) => musicApi.playlists.update(id, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['music-playlists'] }); setEditItem(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => musicApi.playlists.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['music-playlists'] }); setDeleteId(null) },
  })
  const startMutation = useMutation({
    mutationFn: (id: number) => musicApi.playlists.start(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['music-playlists'] }),
  })
  const stopMutation = useMutation({
    mutationFn: (id: number) => musicApi.playlists.stop(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['music-playlists'] }),
  })

  const playlists: MusicPlaylist[] = playlistsQ.data ?? []
  const servers: Server[] = serversQ.data ?? []

  function resetForm() { setForm({ name: '', description: null, visual_url: null, visual_type: 'none', server_id: null }) }

  function openEdit(item: MusicPlaylist) {
    setEditItem(item)
    setForm({ name: item.name, description: item.description, visual_url: item.visual_url, visual_type: item.visual_type, server_id: item.server_id })
  }

  const pending = addMutation.isPending || editMutation.isPending

  const PlaylistModal = ({ isEdit }: { isEdit: boolean }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{isEdit ? 'Playlist Duzenle' : 'Yeni Playlist'}</h3>
          <button type="button" className="rounded-full p-1 hover:bg-slate-100" onClick={() => { isEdit ? setEditItem(null) : setShowAdd(false); resetForm() }}><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="panel-label">Playlist Adi *</label>
            <input className="panel-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Playlist adi" />
          </div>
          <div>
            <label className="panel-label">Aciklama</label>
            <textarea className="panel-textarea" value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))} placeholder="Opsiyonel aciklama" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="panel-label">Gorsel Tip</label>
              <select className="panel-select" value={form.visual_type ?? 'none'} onChange={e => setForm(f => ({ ...f, visual_type: e.target.value as 'video' | 'image' | 'none' }))}>
                <option value="none">Yok</option>
                <option value="image">Resim</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div>
              <label className="panel-label">Sunucu (opsiyonel)</label>
              <select className="panel-select" value={form.server_id ?? ''} onChange={e => setForm(f => ({ ...f, server_id: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">Varsayilan</option>
                {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {form.visual_type !== 'none' && (
            <div>
              <label className="panel-label">Gorsel URL</label>
              <input className="panel-input" value={form.visual_url ?? ''} onChange={e => setForm(f => ({ ...f, visual_url: e.target.value || null }))} placeholder="https://..." />
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="secondary-button" onClick={() => { isEdit ? setEditItem(null) : setShowAdd(false); resetForm() }}><X size={16} />Iptal</button>
          <button type="button" className="primary-button" disabled={!form.name || pending}
            onClick={() => isEdit ? editMutation.mutate({ id: editItem!.id, p: form }) : addMutation.mutate(form)}>
            {pending ? 'Kaydediliyor...' : isEdit ? 'Kaydet' : 'Olustur'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" className="primary-button" onClick={() => { resetForm(); setShowAdd(true) }}>
          <Plus size={16} />Playlist Olustur
        </button>
      </div>

      {playlists.length === 0 && !playlistsQ.isLoading && (
        <div className="glass-panel p-12 text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-violet-100"><ListMusic size={24} className="text-violet-500" /></div>
          <p className="text-sm text-slate-500">Henuz playlist olusturulmamis.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {playlists.map(pl => (
          <div key={pl.id} className="glass-panel p-5 flex flex-col gap-4">
            {/* card header */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                {pl.visual_url && pl.visual_type === 'image'
                  ? <img src={pl.visual_url} alt="" className="h-12 w-12 rounded-2xl object-cover" />
                  : <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-sky-100">
                      <ListMusic size={20} className="text-violet-500" />
                    </span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-slate-900 truncate">{pl.name}</h4>
                  <StatusBadge status={pl.status} />
                </div>
                {pl.description && <p className="mt-0.5 text-xs text-slate-500 truncate">{pl.description}</p>}
                <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Hash size={11} />{pl.items.length} parca</span>
                  <VisualTypeBadge type={pl.visual_type} />
                </div>
              </div>
            </div>

            {/* stream url */}
            {pl.stream_url && (
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-400 mb-0.5">Stream URL</p>
                <p className="text-xs font-mono text-slate-600 truncate">{pl.stream_url}</p>
              </div>
            )}

            {/* actions */}
            <div className="flex flex-wrap items-center gap-2">
              {pl.status === 'stopped'
                ? <button type="button"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.2)] hover:bg-emerald-600 transition disabled:opacity-60"
                    disabled={startMutation.isPending}
                    onClick={() => startMutation.mutate(pl.id)}>
                    <Play size={13} />Baslat
                  </button>
                : <button type="button"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(244,63,94,0.16)] hover:bg-rose-600 transition disabled:opacity-60"
                    disabled={stopMutation.isPending}
                    onClick={() => stopMutation.mutate(pl.id)}>
                    <Square size={13} />Durdur
                  </button>}
              <button type="button" className="secondary-button px-3 py-2 text-xs" onClick={() => setDetailPlaylist(pl)}>
                <ListMusic size={13} />Parcalar
              </button>
              <button type="button" className="secondary-button px-3 py-2 text-xs" onClick={() => openEdit(pl)}>
                <Pencil size={13} />Duzenle
              </button>
              <button type="button" className="danger-button px-3 py-2 text-xs" onClick={() => setDeleteId(pl.id)}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && <PlaylistModal isEdit={false} />}
      {editItem && <PlaylistModal isEdit={true} />}
      {detailPlaylist && <PlaylistDetailModal playlist={detailPlaylist} onClose={() => setDetailPlaylist(null)} />}
      {deleteId !== null && (
        <DeleteModal
          title={playlists.find(p => p.id === deleteId)?.name ?? String(deleteId)}
          onConfirm={() => deleteMutation.mutate(deleteId)}
          onCancel={() => setDeleteId(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT — RadioPage
// ══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'radio', label: 'Radyo Kanallari', Icon: Radio },
  { id: 'library', label: 'Muzik Kutuphanesi', Icon: Music },
  { id: 'playlists', label: 'Muzik Playlistleri', Icon: ListMusic },
] as const

type TabId = typeof TABS[number]['id']

export default function RadioPage() {
  const [activeTab, setActiveTab] = useState<TabId>('radio')

  return (
    <div className="space-y-6">
      {/* page header */}
      <section className="glass-panel p-5 sm:p-7">
        <div className="flex items-center gap-4">
          <span className="icon-chip"><Wifi size={20} /></span>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Icerik Yonetimi</div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-semibold text-slate-900">Radyo & Muzik</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Radyo kanalları, muzik kutuphanesi ve canli playlist yayin yonetimi.
            </p>
          </div>
        </div>
      </section>

      {/* tabs */}
      <div className="flex gap-1 rounded-2xl bg-slate-100 p-1 w-fit">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeTab === id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* tab content */}
      <section className="glass-panel p-5 sm:p-6">
        {activeTab === 'radio' && <RadioChannelsTab />}
        {activeTab === 'library' && <MusicLibraryTab />}
        {activeTab === 'playlists' && <MusicPlaylistsTab />}
      </section>
    </div>
  )
}
