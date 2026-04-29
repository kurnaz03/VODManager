import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers3, Pencil, Plus, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { contentApi, BouquetPayload, BouquetType } from '../services/contentApi'

interface BouquetFormValues {
  name: string
  description: string
  bouquet_type: BouquetType
  is_active: boolean
  sort_order: number
}

export default function BouquetsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const bouquetQuery = useQuery({
    queryKey: ['bouquets'],
    queryFn: contentApi.listBouquets,
  })

  const createMutation = useMutation({
    mutationFn: (payload: BouquetPayload) => contentApi.createBouquet(payload),
    onSuccess: (bouquet) => {
      queryClient.invalidateQueries({ queryKey: ['bouquets'] })
      setOpen(false)
      navigate(`/bouquets/${bouquet.id}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => contentApi.deleteBouquet(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bouquets'] }),
  })

  const bouquets = bouquetQuery.data ?? []

  return (
    <div className="space-y-6">
      <section className="glass-panel p-4 sm:p-6 sm:p-7">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Icerik Yonetimi</div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">Bouquets</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Kullanicilara atanacak icerik paketlerini olusturun ve medya ekleyin.
            </p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="primary-button shrink-0">
            <Plus size={18} />
            Yeni Bouquet
          </button>
        </div>
      </section>

      <section className="glass-panel p-4 sm:p-6">
        <div className="table-shell overflow-x-auto">
          <div className="table-head hidden min-w-[700px] grid-cols-[0.4fr,1.3fr,1.5fr,0.7fr,0.7fr,0.8fr,0.8fr,1fr] gap-4 px-5 py-4 lg:grid">
            <div>ID</div>
            <div>Bouquet Adi</div>
            <div>Aciklama</div>
            <div>Tip</div>
            <div>Medya</div>
            <div>Olusturma</div>
            <div>Durum</div>
            <div>Islemler</div>
          </div>
          <div className="min-w-[700px] divide-y divide-slate-200">
            {bouquets.map((bouquet, index) => (
              <div
                key={bouquet.id}
                className={`table-row grid gap-4 px-5 py-4 lg:grid-cols-[0.4fr,1.3fr,1.5fr,0.7fr,0.7fr,0.8fr,0.8fr,1fr] ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
              >
                <div className="text-sm font-mono text-slate-400">#{bouquet.id}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="icon-chip">
                      <Layers3 size={15} />
                    </span>
                    <span className="truncate font-semibold text-slate-900">{bouquet.name}</span>
                  </div>
                </div>
                <div className="text-sm text-slate-500 truncate">{bouquet.description || '—'}</div>
                <div>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase text-blue-700">
                    {bouquet.bouquet_type}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-700">
                  {bouquet.item_count} oge
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(bouquet.created_at).toLocaleDateString('tr-TR')}
                </div>
                <div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bouquet.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {bouquet.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => navigate(`/bouquets/${bouquet.id}`)} className="secondary-button px-3 py-2">
                    <Pencil size={15} />
                    Duzenle
                  </button>
                  <button type="button" onClick={() => deleteMutation.mutate(bouquet.id)} className="danger-button px-3 py-2">
                    <Trash2 size={15} />
                    Sil
                  </button>
                </div>
              </div>
            ))}

            {bouquets.length === 0 && (
              <div className="px-6 py-16 text-center text-sm text-slate-500">Henuz bouquet olusturulmadi.</div>
            )}
          </div>
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl p-4 sm:p-8 overflow-y-auto max-h-[90vh]">
            <div className="mb-5">
              <h3 className="text-2xl font-semibold text-slate-900">Yeni bouquet olustur</h3>
              <p className="mt-1 text-sm text-slate-500">Olusturduktan sonra detay sayfasina yonlendirilirsiniz.</p>
            </div>
            <BouquetForm
              submitLabel={createMutation.isPending ? 'Olusturuluyor...' : 'Olustur'}
              onSubmit={(values) => createMutation.mutate(values)}
              onCancel={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function BouquetForm({
  submitLabel,
  onSubmit,
  onCancel,
}: {
  submitLabel: string
  onSubmit: (values: BouquetPayload) => void
  onCancel: () => void
}) {
  const { register, handleSubmit } = useForm<BouquetFormValues>({
    defaultValues: {
      name: '',
      description: '',
      bouquet_type: 'mixed',
      is_active: true,
      sort_order: 1,
    },
  })

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({
          name: values.name,
          description: values.description || null,
          bouquet_type: values.bouquet_type,
          is_active: values.is_active,
          sort_order: values.sort_order,
        }),
      )}
      className="space-y-4"
    >
      <div>
        <label className="panel-label">Bouquet adi</label>
        <input className="panel-input" {...register('name', { required: true })} />
      </div>
      <div>
        <label className="panel-label">Aciklama</label>
        <textarea className="panel-textarea" {...register('description')} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="panel-label">Tip</label>
          <select className="panel-select" {...register('bouquet_type')}>
            <option value="mixed">Karisik</option>
            <option value="movies">Filmler</option>
            <option value="series">Diziler</option>
            <option value="tv">TV</option>
            <option value="radio">Radyo</option>
          </select>
        </div>
        <div>
          <label className="panel-label">Sira</label>
          <input type="number" className="panel-input" {...register('sort_order', { valueAsNumber: true })} />
        </div>
      </div>
      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-500" {...register('is_active')} />
        Bouquet aktif olsun
      </label>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="secondary-button">Iptal</button>
        <button type="submit" className="primary-button">{submitLabel}</button>
      </div>
    </form>
  )
}
