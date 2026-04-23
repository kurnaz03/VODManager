import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, X } from 'lucide-react'
import { contentApi, Category, StreamContent, tvApi } from '../services/contentApi'

export default function TvPage() {
  const queryClient = useQueryClient()
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'tv'],
    queryFn: () => contentApi.listCategories('tv'),
  })

  const tvQuery = useQuery({
    queryKey: ['tv', selectedCategoryId],
    queryFn: () => tvApi.list(selectedCategoryId ?? undefined),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tvApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tv'] })
      setDeleteId(null)
    },
  })

  const categories: Category[] = categoriesQuery.data ?? []
  const tvList: StreamContent[] = tvQuery.data ?? []

  return (
    <div className="space-y-6">
      <section className="glass-panel p-6 sm:p-7">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Icerik Yonetimi</div>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">TV</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Canli yayin kanallarini kategori bazinda listeleyin.
          </p>
        </div>
      </section>

      <section className="glass-panel p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategoryId(null)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${selectedCategoryId === null ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Tumu
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${selectedCategoryId === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="table-shell overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head text-left">
                <th className="px-4 py-3 font-semibold text-slate-500">ID</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Baslik</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Kategori</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Stream URL</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Public</th>
                <th className="px-4 py-3 font-semibold text-slate-500">Islemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tvList.map((item) => (
                <tr key={item.id} className="table-zebra hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">#{item.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                  <td className="px-4 py-3 text-slate-600">{item.category_name ?? '-'}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate text-slate-500">{item.stream_url ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${item.is_public ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {item.is_public ? 'Acik' : 'Kapali'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" className="danger-button px-3 py-2" onClick={() => setDeleteId(item.id)}>
                      <Trash2 size={14} /> Sil
                    </button>
                  </td>
                </tr>
              ))}
              {tvList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-500">
                    {tvQuery.isLoading ? 'Yukleniyor...' : 'TV kanalı bulunamadi.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Silme Onay</h3>
            <p className="mt-2 text-sm text-slate-600">Bu kaydı silmek istediginize emin misiniz?</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="secondary-button" onClick={() => setDeleteId(null)}>
                <X size={16} /> Iptal
              </button>
              <button type="button" className="danger-button" onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
                <Trash2 size={16} /> {deleteMutation.isPending ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
