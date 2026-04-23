interface Props {
  title: string
  description: string
}

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>
      </div>

      <div className="glass-panel flex min-h-[320px] items-center justify-center p-10">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600 shadow-[0_10px_30px_rgba(59,130,246,0.12)]">
            ...
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Bu modul hazirlaniyor</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Tasarim dili ve yeni layout bu bolum icin de hazir. Detay islevler sonraki iterasyonda ayni tema ile devam edebilir.
          </p>
        </div>
      </div>
    </div>
  )
}