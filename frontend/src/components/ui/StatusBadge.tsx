interface StatusBadgeProps {
  status: string
}

const statusMap: Record<string, string> = {
  online: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  offline: 'bg-slate-100 text-slate-600 ring-slate-200',
  installing: 'bg-amber-100 text-amber-700 ring-amber-200',
  error: 'bg-rose-100 text-rose-700 ring-rose-200',
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium capitalize ring-1 ${statusMap[status] ?? statusMap.offline}`}>
      <span className={`h-2 w-2 rounded-full ${status === 'online' ? 'bg-emerald-500' : status === 'installing' ? 'bg-amber-500' : status === 'error' ? 'bg-rose-500' : 'bg-slate-400'}`} />
      {status}
    </span>
  )
}