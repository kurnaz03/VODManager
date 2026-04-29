import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Download,
  Plus,
  Server,
  Settings,
  Shield,
  Trash2,
  X,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { VpnClient, VpnClientCreate, VpnServerConfig, vpnApi } from '../services/vpnApi'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function VpnClientsPage() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VpnClient | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const clientsQuery = useQuery({
    queryKey: ['vpn-clients'],
    queryFn: vpnApi.listClients,
  })

  const createMutation = useMutation({
    mutationFn: (payload: VpnClientCreate) => vpnApi.createClient(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-clients'] })
      setShowCreateModal(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => vpnApi.deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-clients'] })
      setDeleteTarget(null)
    },
  })

  const handleDownload = async (client: VpnClient) => {
    setDownloadingId(client.id)
    try {
      await vpnApi.downloadOvpn(client.id, client.name)
    } catch (e) {
      console.error(e)
    } finally {
      setDownloadingId(null)
    }
  }

  const clients = clientsQuery.data ?? []
  const activeCount = clients.filter((c) => c.is_active).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="glass-panel p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Ag Yonetimi</div>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">VPN Istemcileri</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              OpenVPN istemci sertifikasi olusturun, indirin ve yonetin. Her istemci icin benzersiz .ovpn dosyasi uretilir.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
              <div className="text-2xl font-semibold text-slate-900">{clients.length}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">Toplam</div>
            </div>
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
              <div className="text-2xl font-semibold text-emerald-700">{activeCount}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.14em] text-emerald-600">Aktif</div>
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="primary-button"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={16} />
          Yeni Istemci Olustur
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setShowConfigModal(true)}
        >
          <Settings size={16} />
          Sunucu Ayarlari
        </button>
      </div>

      {/* Clients table */}
      <section className="glass-panel overflow-hidden p-0">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="vm-primary-text" />
            <h3 className="text-base font-semibold text-slate-900">Istemci Listesi</h3>
          </div>
        </div>

        {clientsQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Yukleniyor...</div>
        ) : clients.length === 0 ? (
          <div className="p-10 text-center">
            <Shield size={36} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500">Henuz istemci olusturulmadi.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{minWidth: '600px'}}>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Ad</th>
                  <th className="px-5 py-3">Aciklama</th>
                  <th className="px-5 py-3">Durum</th>
                  <th className="px-5 py-3">Olusturulma</th>
                  <th className="px-5 py-3">Son Kullanim</th>
                  <th className="px-5 py-3 text-right">Islemler</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        <Server size={14} className="shrink-0 text-slate-400" />
                        {client.name}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{client.description || '-'}</td>
                    <td className="px-5 py-3.5">
                      {client.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 size={11} />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                          <XCircle size={11} />
                          Iptal
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{formatDate(client.created_at)}</td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {client.expires_at ? formatDate(client.expires_at) : '-'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {client.is_active && (
                          <button
                            type="button"
                            className="primary-button px-3 py-1.5 text-xs"
                            onClick={() => handleDownload(client)}
                            disabled={downloadingId === client.id}
                          >
                            <Download size={13} />
                            {downloadingId === client.id ? 'Hazirlaniyor...' : '.ovpn Indir'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="danger-button px-3 py-1.5 text-xs"
                          onClick={() => setDeleteTarget(client)}
                        >
                          <Trash2 size={13} />
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create Client Modal */}
      {showCreateModal && (
        <CreateClientModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(payload) => createMutation.mutate(payload)}
          isPending={createMutation.isPending}
          error={createMutation.error ? String((createMutation.error as any)?.response?.data?.detail || 'Hata olustu') : null}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100">
              <AlertTriangle size={22} className="text-rose-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Istemciyi Sil</h3>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold">{deleteTarget.name}</span> istemcisinin sertifikasi iptal edilecek ve kayit silinecek. Bu islemi geri alamazsiniz.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="secondary-button" onClick={() => setDeleteTarget(null)}>
                <X size={15} /> Iptal
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={15} /> {deleteMutation.isPending ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server Config Modal */}
      {showConfigModal && (
        <ServerConfigModal onClose={() => setShowConfigModal(false)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create Client Modal
// ---------------------------------------------------------------------------

interface CreateClientModalProps {
  onClose: () => void
  onCreate: (payload: VpnClientCreate) => void
  isPending: boolean
  error: string | null
}

function CreateClientModal({ onClose, onCreate, isPending, error }: CreateClientModalProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<VpnClientCreate>()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Yeni VPN Istemcisi</h3>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onCreate)}>
          <div>
            <label className="panel-label">Istemci Adi *</label>
            <input
              className="panel-input"
              placeholder="Ornek: laptop-ali veya server01"
              {...register('name', {
                required: 'Ad zorunludur',
                pattern: {
                  value: /^[a-zA-Z0-9_-]+$/,
                  message: 'Sadece harf, rakam, tire ve alt cizgi kullanabilirsiniz',
                },
                minLength: { value: 2, message: 'En az 2 karakter' },
                maxLength: { value: 100, message: 'En fazla 100 karakter' },
              })}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="panel-label">Aciklama</label>
            <input
              className="panel-input"
              placeholder="Isteğe bagli"
              {...register('description')}
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" className="secondary-button" onClick={onClose}>
              Iptal
            </button>
            <button type="submit" className="primary-button" disabled={isPending}>
              <Plus size={15} />
              {isPending ? 'Olusturuluyor...' : 'Olustur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Server Config Modal
// ---------------------------------------------------------------------------

function ServerConfigModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: config, isLoading } = useQuery({
    queryKey: ['vpn-server-config'],
    queryFn: vpnApi.getServerConfig,
  })

  const { register, handleSubmit } = useForm<Omit<VpnServerConfig, 'id' | 'updated_at'>>()

  const updateMutation = useMutation({
    mutationFn: (payload: Omit<VpnServerConfig, 'id' | 'updated_at'>) =>
      vpnApi.updateServerConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-server-config'] })
      onClose()
    },
  })

  if (isLoading || !config) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl text-center text-sm text-slate-500">
          Yukleniyor...
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Sunucu Ayarlari</h3>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form
          className="space-y-3"
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="panel-label">Sunucu IP</label>
              <input className="panel-input" defaultValue={config.server_ip} {...register('server_ip')} />
            </div>
            <div>
              <label className="panel-label">Port</label>
              <input className="panel-input" type="number" defaultValue={config.server_port} {...register('server_port', { valueAsNumber: true })} />
            </div>
          </div>
          <div>
            <label className="panel-label">Protokol</label>
            <select className="panel-select" defaultValue={config.protocol} {...register('protocol')}>
              <option value="udp">UDP</option>
              <option value="tcp">TCP</option>
            </select>
          </div>
          {[
            ['CA Sertifika Yolu', 'ca_cert_path'],
            ['Sunucu Sertifika Yolu', 'server_cert_path'],
            ['Sunucu Anahtar Yolu', 'server_key_path'],
            ['DH Params Yolu', 'dh_params_path'],
            ['TA Anahtar Yolu', 'ta_key_path'],
            ['easy-rsa Dizini', 'easy_rsa_dir'],
            ['Istemciler Dizini', 'clients_dir'],
          ].map(([label, field]) => (
            <div key={field}>
              <label className="panel-label">{label}</label>
              <input
                className="panel-input font-mono text-xs"
                defaultValue={(config as any)[field]}
                {...register(field as any)}
              />
            </div>
          ))}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="secondary-button" onClick={onClose}>Iptal</button>
            <button type="submit" className="primary-button" disabled={updateMutation.isPending}>
              <Settings size={15} />
              {updateMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
