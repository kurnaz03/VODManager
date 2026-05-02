import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  DatabaseBackup,
  Download,
  Loader2,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { backupsApi, Backup } from '../services/backupsApi'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Status / Type labels & classes ────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending: 'Bekliyor',
  running: 'Devam Ediyor',
  completed: 'Tamamlandi',
  failed: 'Basarisiz',
  restoring: 'Geri Yukleniyor',
}
const STATUS_CLS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  running: 'bg-blue-100 text-blue-700 animate-pulse',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
  restoring: 'bg-amber-100 text-amber-700 animate-pulse',
}
const TYPE_LABEL: Record<string, string> = {
  manual: 'Manuel',
  auto: 'Otomatik',
  pre_restore: 'Geri Yukle Oncesi',
}
const TYPE_CLS: Record<string, string> = {
  manual: 'bg-slate-100 text-slate-600',
  auto: 'bg-sky-100 text-sky-700',
  pre_restore: 'bg-amber-100 text-amber-700',
}

// ── Restore Confirm Modal ─────────────────────────────────────────────────────

function RestoreConfirmModal({
  backup,
  isPending,
  onConfirm,
  onCancel,
}: {
  backup: Backup
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const [understood, setUnderstood] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">Yedegi Geri Yukle</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatDate(backup.created_at)} — {formatBytes(backup.file_size_bytes)}
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-sm font-medium text-rose-700">
            Bu islem geri alinamaz. Mevcut veriler silinecek ve bu yedekteki verilerle degisecek.
          </p>
        </div>

        <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-700">
            Otomatik olarak islem oncesi bir yedek daha alinacak.
          </p>
        </div>

        <label className="mb-6 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
          />
          <span className="select-none text-sm text-slate-700">
            Anladim, devam etmek istiyorum.
          </span>
        </label>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            Iptal
          </button>
          <button
            onClick={onConfirm}
            disabled={!understood || isPending}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Geri Yukle
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Simple Confirm Dialog ─────────────────────────────────────────────────────

function SimpleConfirmDialog({
  title,
  message,
  isPending,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-2 text-base font-semibold text-slate-800">{title}</h3>
        <p className="mb-6 text-sm text-slate-500">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            Iptal
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50 transition"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Onayla
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Backup Row ────────────────────────────────────────────────────────────────

function BackupRow({
  backup,
  onDownload,
  onRestore,
  onDelete,
}: {
  backup: Backup
  onDownload: () => void
  onRestore: () => void
  onDelete: () => void
}) {
  const isRunning = backup.status === 'running' || backup.status === 'restoring' || backup.status === 'pending'

  return (
    <tr className="hover:bg-slate-50/60 transition">
      <td className="px-4 py-3 text-slate-700 tabular-nums text-sm">
        {formatDate(backup.created_at)}
      </td>
      <td className="px-4 py-3 text-slate-500 tabular-nums text-sm">
        {backup.status === 'running' || backup.status === 'pending' ? (
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-blue-500" />
            <span className="text-xs">{backup.progress_percent}%</span>
          </div>
        ) : (
          formatBytes(backup.file_size_bytes)
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            TYPE_CLS[backup.backup_type] ?? 'bg-slate-100 text-slate-600'
          }`}
        >
          {TYPE_LABEL[backup.backup_type] ?? backup.backup_type}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            STATUS_CLS[backup.status] ?? 'bg-slate-100 text-slate-600'
          }`}
        >
          {STATUS_LABEL[backup.status] ?? backup.status}
        </span>
        {backup.error_message && (
          <p
            className="mt-1 max-w-[180px] truncate text-xs text-rose-500"
            title={backup.error_message}
          >
            {backup.error_message.slice(0, 60)}
          </p>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {backup.status === 'completed' && (
            <button
              onClick={onDownload}
              title="Indir"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition"
            >
              <Download size={14} />
            </button>
          )}
          {backup.status === 'completed' && (
            <button
              onClick={onRestore}
              title="Geri Yukle"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition"
            >
              <RotateCcw size={14} />
            </button>
          )}
          <button
            onClick={onDelete}
            title="Sil"
            disabled={isRunning}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 transition"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BackupsPage() {
  const queryClient = useQueryClient()

  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const backupsQ = useQuery({
    queryKey: ['backups'],
    queryFn: backupsApi.list,
    refetchInterval: (query) => {
      const data = query.state.data as { backups: Backup[] } | undefined
      const hasActive = data?.backups?.some(
        (b) => b.status === 'running' || b.status === 'pending' || b.status === 'restoring'
      )
      return hasActive ? 3000 : false
    },
  })

  const backups: Backup[] = backupsQ.data?.backups ?? []
  const hasActive = backups.some(
    (b) => b.status === 'running' || b.status === 'pending' || b.status === 'restoring'
  )

  const createMut = useMutation({
    mutationFn: backupsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      showToast('Yedek aliniyor...')
    },
    onError: (e: any) =>
      showToast(e?.response?.data?.detail ?? 'Yedek alinamadi', 'err'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => backupsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      setDeleteTarget(null)
      showToast('Yedek silindi')
    },
    onError: (e: any) =>
      showToast(e?.response?.data?.detail ?? 'Silinemedi', 'err'),
  })

  const restoreMut = useMutation({
    mutationFn: (id: string) => backupsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      queryClient.invalidateQueries({ queryKey: ['backup-maintenance-status'] })
      setRestoreTarget(null)
      showToast('Geri yukleme baslatildi. Sistem bakim moduna alindi.')
    },
    onError: (e: any) =>
      showToast(e?.response?.data?.detail ?? 'Geri yukleme baslatılamadi', 'err'),
  })

  async function handleDownload(backup: Backup) {
    const filename = backup.filename
    try {
      await backupsApi.downloadBlob(backup.id, filename)
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Indirme basarisiz', 'err')
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl px-5 py-3 text-sm font-medium shadow-xl transition ${
            toast.type === 'ok' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {restoreTarget && (
        <RestoreConfirmModal
          backup={restoreTarget}
          isPending={restoreMut.isPending}
          onConfirm={() => restoreMut.mutate(restoreTarget.id)}
          onCancel={() => setRestoreTarget(null)}
        />
      )}
      {deleteTarget !== null && (
        <SimpleConfirmDialog
          title="Yedegi Sil"
          message="Bu yedegi kalici olarak silmek istediginizden emin misiniz?"
          isPending={deleteMut.isPending}
          onConfirm={() => deleteMut.mutate(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Yedekler</h1>
          <p className="mt-1 text-sm text-slate-500">
            Veritabani ve yuklemeler yedeklerini yonetin
          </p>
        </div>
        <button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending || hasActive}
          className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
        >
          {createMut.isPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <DatabaseBackup size={15} />
          )}
          Yedek Al
        </button>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {backupsQ.isLoading ? (
          <div className="py-16 text-center text-sm text-slate-400">Yukleniyor...</div>
        ) : backups.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Henuz yedek bulunmuyor. "Yedek Al" butonuna tiklayin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '700px' }}>
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Boyut</th>
                  <th className="px-4 py-3">Tip</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3 text-right">Eylemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {backups.map((b) => (
                  <BackupRow
                    key={b.id}
                    backup={b}
                    onDownload={() => handleDownload(b)}
                    onRestore={() => setRestoreTarget(b)}
                    onDelete={() => setDeleteTarget(b.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
