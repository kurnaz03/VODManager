import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Film, Pencil, Plus, Trash2, X, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { contentApi, Category, MovieContent, MovieContentUpdate, moviesApi } from '../services/contentApi'

function formatSize(bytes: number | null) {
  if (!bytes) return '-'
  const mb = bytes / (1024 * 1024)
  return mb < 1024 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(2)} GB`
}

export default function MoviesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [editItem, setEditItem] = useState<MovieContent | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'movies'],
    queryFn: () => contentApi.listCategories('movies'),
  })

  const moviesQuery = useQuery({
    queryKey: ['movies', selectedCategoryId],
    queryFn: () => moviesApi.list(selectedCategoryId ?? undefined),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: MovieContentUpdate }) => moviesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movies'] })
      setEditItem(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => moviesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movies'] })
      setDeleteId(null)
    },
  })

  const categories: Category[] = categoriesQuery.data ?? []
  const movies: MovieContent[] = moviesQuery.data ?? []

  return (
    <div className="space-y-6">
      <section className="glass-panel p-4 sm:p-6 sm:p-7">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Icerik Yonetimi</div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">Movies</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Indirilen film iceriklerini kategori bazinda listeleyin ve yonetin.
            </p>
          </div>
          <button
            type="button"
            className="primary-button shrink-0"
            onClick={() => navigate('/downloads')}
          >
            <Plus size={18} />
            Film Ekle
          </button>
        </div>
      </section>

      <section className="glass-panel p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-slate-700">
            {movies.length} film listelendi
          </div>
          <select
            className="panel-select w-full sm:w-auto sm:max-w-[220px]"
            value={selectedCategoryId ?? ''}
            onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Tum Kategoriler</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="table-shell overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="table-head text-left">
                <th className="px-4 py-3 font-semibold text-slate-500">ID</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Poster</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Film Basligi</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Cozunurluk</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Boyut</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Kategori</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Public</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Islemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movies.map((m) => (
                <tr key={m.id} className="table-zebra hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">#{m.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex h-14 w-10 items-center justify-center overflow-hidden rounded-lg bg-slate-200">
                      {m.poster_url ? (
                        <img src={m.poster_url} alt={m.title} className="h-full w-full object-cover" />
                      ) : (
                        <Film size={14} className="text-slate-400" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{m.title}</td>
                  <td className="px-4 py-3 text-slate-600">{m.resolution ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatSize(m.file_size_bytes)}</td>
                  <td className="px-4 py-3 text-slate-600">{m.category_name ?? '-'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => updateMutation.mutate({ id: m.id, payload: { is_public: !m.is_public } })}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${m.is_public ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                    >
                      {m.is_public ? 'Acik' : 'Kapali'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditItem(m)}
                        className="secondary-button px-3 py-2"
                      >
                        <Pencil size={14} />
                        Duzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(m.id)}
                        className="danger-button px-3 py-2"
                      >
                        <Trash2 size={14} />
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {movies.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-sm text-slate-500">
                    {moviesQuery.isLoading ? 'Yukleniyor...' : 'Bu kategoride film bulunamadi.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-4 sm:p-6 shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Film Duzenle</h3>
              <button type="button" onClick={() => setEditItem(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <EditMovieForm
              item={editItem}
              categories={categories}
              onSubmit={(payload) => updateMutation.mutate({ id: editItem.id, payload })}
              isPending={updateMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-4 sm:p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Silme Onay</h3>
            <p className="mt-2 text-sm text-slate-600">Bu filmi silmek istediginize emin misiniz? Bu islem geri alinamaz.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" className="secondary-button" onClick={() => setDeleteId(null)}>
                <X size={16} /> Iptal
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={16} /> {deleteMutation.isPending ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditMovieForm({
  item,
  categories,
  onSubmit,
  isPending,
}: {
  item: MovieContent
  categories: Category[]
  onSubmit: (payload: MovieContentUpdate) => void
  isPending: boolean
}) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [categoryId, setCategoryId] = useState<number | null>(item.category_id)
  const [posterUrl, setPosterUrl] = useState(item.poster_url ?? '')

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          title,
          description: description || null,
          category_id: categoryId,
          poster_url: posterUrl || null,
        })
      }}
    >
      <div>
        <label className="panel-label">Film Basligi</label>
        <input className="panel-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="panel-label">Aciklama</label>
        <textarea className="panel-textarea w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className="panel-label">Kategori</label>
        <select
          className="panel-select w-full"
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Kategori yok</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="panel-label">Poster URL</label>
        <input className="panel-input w-full" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} />
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="submit" className="primary-button" disabled={isPending}>
          <Check size={16} /> {isPending ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}
