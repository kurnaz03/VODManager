import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Crown, Pencil, Plus, ServerCog, ShieldCheck, Trash2, Wifi, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import MetricBar from '../../../components/ui/MetricBar'
import StatusBadge from '../../../components/ui/StatusBadge'
import { Server, ServerPayload, ServerUpdatePayload, serversApi } from '../services/serversApi'

function formatMbps(value: number): string {
  if (value === 0) return '0 Mbps'
  if (value < 0.01) return `${(value * 1000).toFixed(2)} Kbps`
  if (value < 1) return `${value.toFixed(2)} Mbps`
  return `${value.toFixed(1)} Mbps`
}

const NETWORK_INTERFACES = ['eth0', 'eno1', 'eno2', 'enp0s31f6', 'enp3s0', 'bond0', 'em1', 'em2']

interface EditForm extends ServerUpdatePayload {
  ssh_password_new?: string
}

function EditServerModal({ server, onClose }: { server: Server; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<EditForm>({
    defaultValues: {
      name: server.name,
      ip_address: server.ip_address,
      ssh_port: server.ssh_port,
      ssh_username: server.ssh_username,
      domain_name: server.domain_name ?? '',
      max_clients: server.max_clients ?? undefined,
      network_interface: server.network_interface ?? '',
      network_speed: server.network_speed ?? 1000,
      http_port: server.http_port ?? 8080,
      https_port: server.https_port ?? 8443,
      rtmp_port: server.rtmp_port ?? 25462,
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: ServerUpdatePayload) => serversApi.update(server.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] })
      queryClient.invalidateQueries({ queryKey: ['server', server.id] })
      onClose()
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setSaveError(detail ?? 'Guncelleme basarisiz. Lutfen bilgileri kontrol edin.')
    },
  })

  function onSubmit(values: EditForm) {
    setSaveError(null)
    const payload: ServerUpdatePayload = {
      name: values.name,
      ssh_port: Number(values.ssh_port),
      ssh_username: values.ssh_username,
      domain_name: values.domain_name || undefined,
      max_clients: values.max_clients ? Number(values.max_clients) : undefined,
      network_interface: values.network_interface || undefined,
      network_speed: values.network_speed ? Number(values.network_speed) : undefined,
      http_port: values.http_port ? Number(values.http_port) : undefined,
      https_port: values.https_port ? Number(values.https_port) : undefined,
      rtmp_port: values.rtmp_port ? Number(values.rtmp_port) : undefined,
    }
    if (server.server_type !== 'main' && values.ip_address) {
      payload.ip_address = values.ip_address
    }
    if (values.ssh_password_new) {
      payload.ssh_password = values.ssh_password_new
    }
    updateMutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Sunucu Duzenle</div>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">{server.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="secondary-button p-2">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="panel-label">Sunucu Adi</label>
            <input className="panel-input" {...register('name', { required: 'Sunucu adi zorunlu' })} />
            {errors.name && <p className="panel-error">{errors.name.message}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="panel-label">Domain Adi</label>
            <input className="panel-input" placeholder="ornek.com" {...register('domain_name')} />
          </div>

          <div>
            <label className="panel-label">Sunucu IP</label>
            <input
              className="panel-input"
              disabled={server.server_type === 'main'}
              {...register('ip_address')}
            />
            {server.server_type === 'main' && (
              <p className="mt-1 text-xs text-slate-400">Main server IP degistirilemez</p>
            )}
          </div>

          <div>
            <label className="panel-label">SSH Port</label>
            <input type="number" className="panel-input" {...register('ssh_port', { valueAsNumber: true })} />
          </div>

          <div>
            <label className="panel-label">SSH Kullanici Adi</label>
            <input className="panel-input" {...register('ssh_username')} />
          </div>

          <div>
            <label className="panel-label">Root Sifresi (yeni)</label>
            <input
              type="password"
              className="panel-input"
              placeholder="Degistirmek icin yeni sifre girin"
              {...register('ssh_password_new')}
            />
          </div>

          <div>
            <label className="panel-label">Max Istemci</label>
            <input type="number" className="panel-input" {...register('max_clients', { valueAsNumber: true })} />
          </div>

          <div>
            <label className="panel-label">Network Hizi (Mbps)</label>
            <input type="number" className="panel-input" {...register('network_speed', { valueAsNumber: true })} />
          </div>

          <div>
            <label className="panel-label">Network Interface</label>
            <select className="panel-input" {...register('network_interface')}>
              <option value="">Otomatik (tum interface)</option>
              {NETWORK_INTERFACES.map((iface) => (
                <option key={iface} value={iface}>{iface}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Port Ayarlari</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="panel-label">HTTP Port</label>
                <input type="number" className="panel-input" {...register('http_port', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="panel-label">HTTPS Port</label>
                <input type="number" className="panel-input" {...register('https_port', { valueAsNumber: true })} />
              </div>
              <div>
                <label className="panel-label">RTMP Port</label>
                <input type="number" className="panel-input" {...register('rtmp_port', { valueAsNumber: true })} />
              </div>
            </div>
          </div>

          {saveError && (
            <div className="sm:col-span-2">
              <p className="text-sm text-rose-600">{saveError}</p>
            </div>
          )}

          <div className="sm:col-span-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="secondary-button">Iptal</button>
            <button type="submit" className="primary-button" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ServersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editServer, setEditServer] = useState<Server | null>(null)
  const [deleteConfirmServer, setDeleteConfirmServer] = useState<Server | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const { data: servers = [], isLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: serversApi.list,
    refetchInterval: 30000,
  })

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<ServerPayload>({
    defaultValues: {
      name: '',
      ip_address: '',
      ssh_port: 22,
      ssh_username: 'root',
      ssh_password: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: serversApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] })
      setOpen(false)
      reset()
      setTestResult(null)
      setTestError(null)
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setTestError(detail ?? 'Sunucu eklenemedi. Lutfen bilgileri kontrol edin.')
    },
  })

  const testMutation = useMutation({
    mutationFn: serversApi.check,
    onSuccess: (data) => {
      setTestError(null)
      setTestResult(`${data.message} • ${data.os_info ?? 'OS bilgisi hazir'}`)
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setTestResult(null)
      setTestError(detail ?? 'Baglanti testi basarisiz')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => serversApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] })
      setDeleteConfirmServer(null)
    },
  })

  const summary = useMemo(() => {
    const total = servers.length
    const active = servers.filter((server) => server.status === 'online').length
    const main = servers.find((server) => server.server_type === 'main')
    return { total, active, main }
  }, [servers])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-panel p-5">
          <div className="icon-chip mb-4"><ServerCog size={18} /></div>
          <div className="text-3xl font-semibold text-slate-900">{summary.total}</div>
          <div className="mt-1 text-sm text-slate-500">Toplam sunucu havuzu</div>
        </div>
        <div className="glass-panel p-5">
          <div className="icon-chip icon-chip-green mb-4"><ShieldCheck size={18} /></div>
          <div className="text-3xl font-semibold text-slate-900">{summary.active}</div>
          <div className="mt-1 text-sm text-slate-500">Aktif node sayisi</div>
        </div>
        <div className="glass-panel p-5">
          <div className="icon-chip icon-chip-amber mb-4"><Wifi size={18} /></div>
          <div className="text-2xl font-semibold text-slate-900">{summary.main?.ip_address ?? '—'}</div>
          <div className="mt-1 text-sm text-slate-500">Main server adresi</div>
        </div>
        <div className="glass-panel flex items-center justify-between p-5">
          <div>
            <div className="text-sm text-slate-500">Yeni dengeleyici ekle</div>
            <div className="mt-1 text-lg font-medium text-slate-900">SSH ile hizli onboarding</div>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="primary-button">
            <Plus size={18} />
            Yeni Sunucu
          </button>
        </div>
      </div>

      <div className="glass-panel p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Sunucu listesi</h2>
            <p className="mt-1 text-sm text-slate-500">Main server ve load balancer node'lari tek havuzdan yonetilir.</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="secondary-button">
            <Plus size={16} />
            Yeni Sunucu Ekle
          </button>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-12 text-center text-slate-500">
            Sunucular yukleniyor...
          </div>
        ) : (
          <div className="table-shell">
            <div className="table-head hidden grid-cols-[1.7fr,1.2fr,0.8fr,0.9fr,0.9fr,0.9fr,0.9fr,0.9fr,auto] gap-4 px-5 py-4 lg:grid">
              <div>Sunucu</div>
              <div>IP / Tip</div>
              <div>Durum</div>
              <div>CPU</div>
              <div>RAM</div>
              <div>Disk</div>
              <div>Net In</div>
              <div>Net Out</div>
              <div></div>
            </div>

            <div className="divide-y divide-slate-200">
              {servers.map((server, index) => (
                <div
                  key={server.id}
                  className={`grid w-full gap-4 px-5 py-5 lg:grid-cols-[1.7fr,1.2fr,0.8fr,0.9fr,0.9fr,0.9fr,0.9fr,0.9fr,auto] ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/servers/${server.id}`)}
                    className="flex items-center gap-3 min-w-0 text-left"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-blue-600">
                      {server.server_type === 'main' ? <Crown size={20} /> : <ServerCog size={20} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-base font-semibold text-slate-900">{server.name}</div>
                        {server.server_type === 'main' && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 ring-1 ring-amber-200">
                            Main
                          </span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-sm text-slate-500">{server.cpu_info ?? 'Donanim bilgisi bekleniyor'}</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/servers/${server.id}`)}
                    className="text-left"
                  >
                    <div className="text-sm font-medium text-slate-700">{server.ip_address}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{server.server_type}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/servers/${server.id}`)}
                    className="flex items-start lg:items-center"
                  >
                    <StatusBadge status={server.status} />
                  </button>
                  <MetricBar label="CPU" value={server.latest_metric?.cpu_percent ?? 0} tone="blue" />
                  <MetricBar label="RAM" value={server.latest_metric?.ram_percent ?? 0} tone="green" />
                  <MetricBar label="Disk" value={server.latest_metric?.disk_percent ?? 0} tone="amber" />
                  <MetricBar
                    label="Net In"
                    value={Math.min(((server.latest_metric?.network_in_mbps ?? 0) / (server.network_speed ?? 1000)) * 100, 100)}
                    tone="blue"
                    displayValue={formatMbps(server.latest_metric?.network_in_mbps ?? 0)}
                  />
                  <MetricBar
                    label="Net Out"
                    value={Math.min(((server.latest_metric?.network_out_mbps ?? 0) / (server.network_speed ?? 1000)) * 100, 100)}
                    tone="red"
                    displayValue={formatMbps(server.latest_metric?.network_out_mbps ?? 0)}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditServer(server) }}
                      className="secondary-button p-2"
                      title="Duzenle"
                    >
                      <Pencil size={15} />
                    </button>
                    {server.server_type !== 'main' && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmServer(server) }}
                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
                        title="Sil"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl p-6 sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Load balancer onboarding</div>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Yeni sunucu ekle</h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="secondary-button">Kapat</button>
            </div>

            <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="panel-label">Sunucu Adi</label>
                <input className="panel-input" {...register('name', { required: 'Sunucu adi zorunlu' })} />
                {errors.name && <p className="panel-error">{errors.name.message}</p>}
              </div>
              <div>
                <label className="panel-label">IP Adresi</label>
                <input className="panel-input" {...register('ip_address', { required: 'IP zorunlu' })} />
                {errors.ip_address && <p className="panel-error">{errors.ip_address.message}</p>}
              </div>
              <div>
                <label className="panel-label">SSH Port</label>
                <input type="number" className="panel-input" {...register('ssh_port', { valueAsNumber: true, required: 'Port zorunlu' })} />
                {errors.ssh_port && <p className="panel-error">{errors.ssh_port.message}</p>}
              </div>
              <div>
                <label className="panel-label">Kullanici Adi</label>
                <input className="panel-input" {...register('ssh_username', { required: 'Kullanici adi zorunlu' })} />
                {errors.ssh_username && <p className="panel-error">{errors.ssh_username.message}</p>}
              </div>
              <div>
                <label className="panel-label">Sifre</label>
                <input type="password" className="panel-input" {...register('ssh_password', { required: 'Sifre zorunlu' })} />
                {errors.ssh_password && <p className="panel-error">{errors.ssh_password.message}</p>}
              </div>

              <div className="sm:col-span-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-600">
                    Baglanti testi once canli SSH kontrolu yapar, sonra kayit acilir.
                  </div>
                  <button
                    type="button"
                    onClick={() => testMutation.mutate(getValues())}
                    className="secondary-button"
                  >
                    Baglanti Test Et
                  </button>
                </div>
                {testResult && <p className="mt-3 text-sm text-emerald-600">{testResult}</p>}
                {testError && <p className="mt-3 text-sm text-rose-600">{testError}</p>}
              </div>

              <div className="sm:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={() => setOpen(false)} className="secondary-button">Iptal</button>
                <button type="submit" className="primary-button" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 sm:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Sunucuyu Sil</h3>
                <p className="text-sm text-slate-500">Bu islem geri alinamaz.</p>
              </div>
            </div>
            <p className="mb-6 text-sm text-slate-700">
              <span className="font-semibold">{deleteConfirmServer.name}</span> ({deleteConfirmServer.ip_address}) sunucusunu silmek istediginize emin misiniz?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmServer(null)}
                className="secondary-button"
                disabled={deleteMutation.isPending}
              >
                Iptal
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteConfirmServer.id)}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={15} />
                {deleteMutation.isPending ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editServer && (
        <EditServerModal server={editServer} onClose={() => setEditServer(null)} />
      )}
    </div>
  )
}
