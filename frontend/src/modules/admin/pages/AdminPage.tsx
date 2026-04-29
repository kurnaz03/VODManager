import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Key, Loader2, Pencil, Plus, ShieldCheck, Trash2, UserCog,
} from 'lucide-react'
import { adminApi, AdminUser } from '../services/adminApi'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  reseller: 'Bayi',
  moderator: 'Moderator',
  user: 'Kullanici',
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  reseller: 'bg-amber-100 text-amber-700',
  moderator: 'bg-teal-100 text-teal-700',
  user: 'bg-slate-100 text-slate-600',
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    blocked: 'bg-rose-100 text-rose-700',
    expired: 'bg-slate-200 text-slate-500',
  }
  const label: Record<string, string> = { active: 'Aktif', blocked: 'Bloke', expired: 'Suresi Dolmus' }
  const cls = map[status] ?? 'bg-slate-100 text-slate-500'
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label[status] ?? status}</span>
}

// ── User Form Modal ────────────────────────────────────────────────────────────
interface UserModalProps {
  editUser: AdminUser | null
  onClose: () => void
  onSaved: () => void
  onError: (msg: string) => void
}

function UserModal({ editUser, onClose, onSaved, onError }: UserModalProps) {
  const [username, setUsername] = useState(editUser?.username ?? '')
  const [email, setEmail] = useState(editUser?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(editUser?.roles[0] ?? 'admin')
  const [userStatus, setUserStatus] = useState(editUser?.status ?? 'active')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editUser) {
        const payload: Record<string, string> = { username, email, status: userStatus, role }
        await adminApi.updateUser(editUser.id, payload)
      } else {
        await adminApi.createUser({ username, email, password, role, status: userStatus })
      }
      onSaved()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Islem hatasi'
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h3 className="mb-5 text-lg font-semibold text-slate-800">
          {editUser ? 'Yonetici Duzenle' : 'Yeni Yonetici'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Kullanici Adi</label>
            <input
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          {!editUser && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sifre</label>
              <input
                required
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rol</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              >
                <option value="admin">Admin</option>
                <option value="reseller">Bayi</option>
                <option value="moderator">Moderator</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Durum</label>
              <select
                value={userStatus}
                onChange={e => setUserStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              >
                <option value="active">Aktif</option>
                <option value="blocked">Bloke</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="secondary-button">Iptal</button>
            <button type="submit" disabled={loading} className="primary-button">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {editUser ? 'Kaydet' : 'Olustur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Change Password Modal ──────────────────────────────────────────────────────
interface ChangePasswordModalProps {
  onClose: () => void
  onSaved: () => void
  onError: (msg: string) => void
}

function ChangePasswordModal({ onClose, onSaved, onError }: ChangePasswordModalProps) {
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) {
      onError('Sifreler eslesmiyor')
      return
    }
    setLoading(true)
    try {
      await adminApi.changePassword({ old_password: oldPw, new_password: newPw, new_password_confirm: confirmPw })
      onSaved()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Sifre degistirme hatasi'
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h3 className="mb-5 text-lg font-semibold text-slate-800">Sifre Degistir</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mevcut Sifre</label>
            <input
              required type="password" value={oldPw} onChange={e => setOldPw(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Yeni Sifre</label>
            <input
              required type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Yeni Sifre (Tekrar)</label>
            <input
              required type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="secondary-button">Iptal</button>
            <button type="submit" disabled={loading} className="primary-button">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              Degistir
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [showPwModal, setShowPwModal] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const usersQ = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers(),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      showToast('Yonetici silindi', 'ok')
    },
    onError: () => showToast('Silme hatasi', 'err'),
  })

  const users = usersQ.data ?? []

  function handleEdit(u: AdminUser) {
    setEditUser(u)
    setShowModal(true)
  }

  function handleNew() {
    setEditUser(null)
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 rounded-xl px-5 py-3 text-sm font-semibold shadow-xl text-white ${toast.type === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <section className="glass-panel p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Yonetim</div>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Yoneticiler</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Panel yoneticilerini ve bayileri buradan yonetebilirsiniz.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowPwModal(true)} className="secondary-button">
              <Key size={16} />
              Sifre Degistir
            </button>
            <button type="button" onClick={handleNew} className="primary-button">
              <Plus size={18} />
              Yeni Yonetici
            </button>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{minWidth: '600px'}}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Kullanici Adi</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Islemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersQ.isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Loader2 size={24} className="animate-spin text-slate-400 mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 text-sm">Yonetici bulunamadi.</td>
                </tr>
              ) : users.map((u, i) => (
                <tr key={u.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-4 py-3 font-mono text-slate-400 text-xs">#{u.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                        <UserCog size={14} />
                      </span>
                      <span className="font-semibold text-slate-800">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.roles.map((r) => (
                      <span key={r} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[r] ?? 'bg-slate-100 text-slate-600'}`}>
                        <ShieldCheck size={11} />
                        {ROLE_LABELS[r] ?? r}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(u.created_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-4 py-3">{statusBadge(u.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => handleEdit(u)} className="secondary-button px-2.5 py-1.5">
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (confirm(`${u.username} silinsin mi?`)) deleteMut.mutate(u.id) }}
                        disabled={deleteMut.isPending}
                        className="danger-button px-2.5 py-1.5"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <UserModal
          editUser={editUser}
          onClose={() => { setShowModal(false); setEditUser(null) }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] })
            setShowModal(false)
            setEditUser(null)
            showToast(editUser ? 'Yonetici guncellendi' : 'Yonetici olusturuldu', 'ok')
          }}
          onError={(msg) => showToast(msg, 'err')}
        />
      )}

      {showPwModal && (
        <ChangePasswordModal
          onClose={() => setShowPwModal(false)}
          onSaved={() => {
            setShowPwModal(false)
            showToast('Sifre basariyla degistirildi', 'ok')
          }}
          onError={(msg) => showToast(msg, 'err')}
        />
      )}
    </div>
  )
}
