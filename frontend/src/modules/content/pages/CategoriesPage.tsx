import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { contentApi, Category, CategoryPayload, CategoryType } from '../services/contentApi'

const CATEGORY_META: Record<CategoryType, { title: string; description: string }> = {
  movies: {
    title: 'Movies Kategorileri',
    description: 'Film iceriklerini kategori bazinda duzenleyin, sirayi ve aktif durumu yonetin.',
  },
  series: {
    title: 'Series Kategorileri',
    description: 'Dizi katalog yapisini kategori seviyesinde yonetin ve gorunurlugu kontrol edin.',
  },
  tv: {
    title: 'TV Kategorileri',
    description: 'Canli yayin kanallarini kategori bazinda ayirin ve panel siralamasini duzenleyin.',
  },
  radio: {
    title: 'Radyo Kategorileri',
    description: 'Radyo kanali gruplarini olusturun, aktiflik ve sira ayarlarini tek yerden yonetin.',
  },
}

interface CategoryFormValues {
  name: string
  description: string
  icon: string
  sort_order: number
  is_active: boolean
}

interface Props {
  categoryType: CategoryType
}

export default function CategoriesPage({ categoryType }: Props) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editingItem, setEditingItem] = useState<Category | null>(null)

  const categoryQuery = useQuery({
    queryKey: ['categories', categoryType],
    queryFn: () => contentApi.listCategories(categoryType),
  })

  const createMutation = useMutation({
    mutationFn: (payload: CategoryPayload) => contentApi.createCategory(categoryType, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', categoryType] })
      setSelectedId(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CategoryPayload> }) =>
      contentApi.updateCategory(categoryType, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', categoryType] })
      setEditingItem(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => contentApi.deleteCategory(categoryType, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', categoryType] }),
  })

  const items = categoryQuery.data ?? []
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) {
      return items
    }
    return items.filter((item) =>
      [item.name, item.description ?? '', item.icon ?? ''].some((value) => value.toLowerCase().includes(term)),
    )
  }, [items, search])

  const meta = CATEGORY_META[categoryType]

  return (
    <div className="space-y-6">
      <section className="glass-panel p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Icerik Yonetimi</div>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">{meta.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{meta.description}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-[240px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Kategori ara..."
                className="panel-input pl-11"
              />
            </div>
            <button type="button" onClick={() => setSelectedId(-1)} className="primary-button">
              <Plus size={18} />
              Yeni Kategori
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr,0.8fr]">
        <div className="glass-panel p-4 sm:p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Kategori listesi</h3>
            <p className="mt-1 text-sm text-slate-500">{filteredItems.length} kayit gosteriliyor.</p>
          </div>

          <div className="table-shell">
            <div className="table-head hidden grid-cols-[1.5fr,2fr,0.7fr,0.7fr,1fr] gap-4 px-5 py-4 lg:grid">
              <div>Isim</div>
              <div>Aciklama</div>
              <div>Durum</div>
              <div>Sira</div>
              <div>Islemler</div>
            </div>

            <div className="divide-y divide-slate-200">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`table-row table-zebra grid gap-4 px-5 py-4 lg:grid-cols-[1.5fr,2fr,0.7fr,0.7fr,1fr] ${selectedId === item.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{item.icon ?? 'folder'}</div>
                  </div>
                  <div className="text-sm text-slate-500">{item.description || 'Aciklama yok'}</div>
                  <div>
                    <button
                      type="button"
                      onClick={() => updateMutation.mutate({ id: item.id, payload: { is_active: !item.is_active } })}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                    >
                      {item.is_active ? 'Aktif' : 'Pasif'}
                    </button>
                  </div>
                  <div className="text-sm font-semibold text-slate-700">{item.sort_order}</div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setEditingItem(item)} className="secondary-button px-3 py-2">
                      <Pencil size={15} />
                      Duzenle
                    </button>
                    <button type="button" onClick={() => deleteMutation.mutate(item.id)} className="danger-button px-3 py-2">
                      <Trash2 size={15} />
                      Sil
                    </button>
                  </div>
                </div>
              ))}

              {filteredItems.length === 0 && (
                <div className="px-6 py-16 text-center text-sm text-slate-500">Aramaya uygun kategori bulunamadi.</div>
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              {selectedId === -1 ? 'Yeni kategori ekle' : editingItem ? 'Kategori duzenle' : 'Hizli bilgi'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Kategori adi, ikon, sira ve aktif durumu tek formdan yonetin.
            </p>
          </div>

          {selectedId === -1 ? (
            <CategoryForm submitLabel={createMutation.isPending ? 'Kaydediliyor...' : 'Kategori olustur'} onSubmit={(values) => createMutation.mutate(values)} />
          ) : editingItem ? (
            <CategoryForm
              initialValues={editingItem}
              submitLabel={updateMutation.isPending ? 'Guncelleniyor...' : 'Degisiklikleri kaydet'}
              onSubmit={(values) => updateMutation.mutate({ id: editingItem.id, payload: values })}
              onCancel={() => setEditingItem(null)}
            />
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-500">
              Sol taraftan bir kayit secerek duzenleyebilir veya Yeni Kategori ile yeni kayit olusturabilirsiniz.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function CategoryForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValues?: Partial<Category>
  submitLabel: string
  onSubmit: (values: CategoryPayload) => void
  onCancel?: () => void
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<CategoryFormValues>({
    defaultValues: {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      icon: initialValues?.icon ?? 'folder',
      sort_order: initialValues?.sort_order ?? 1,
      is_active: initialValues?.is_active ?? true,
    },
  })

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({
          name: values.name,
          description: values.description || null,
          icon: values.icon || null,
          sort_order: values.sort_order,
          is_active: values.is_active,
        }),
      )}
      className="space-y-4"
    >
      <div>
        <label className="panel-label">Kategori adi</label>
        <input className="panel-input" {...register('name', { required: 'Kategori adi zorunlu' })} />
        {errors.name && <p className="panel-error">{errors.name.message}</p>}
      </div>

      <div>
        <label className="panel-label">Aciklama</label>
        <textarea className="panel-textarea" {...register('description')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="panel-label">Ikon</label>
          <input className="panel-input" {...register('icon')} />
        </div>
        <div>
          <label className="panel-label">Sira</label>
          <input type="number" className="panel-input" {...register('sort_order', { valueAsNumber: true, min: 0 })} />
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-500" {...register('is_active')} />
        Kategori aktif olarak gosterilsin
      </label>

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="secondary-button">
            <X size={16} />
            Iptal
          </button>
        )}
        <button type="submit" className="primary-button">
          <Check size={16} />
          {submitLabel}
        </button>
      </div>
    </form>
  )
}