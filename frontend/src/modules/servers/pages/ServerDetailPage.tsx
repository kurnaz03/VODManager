import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowLeft, Crown, HardDrive, RefreshCcw, ServerCog, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MetricBar from '../../../components/ui/MetricBar'
import Sparkline from '../../../components/ui/Sparkline'
import StatusBadge from '../../../components/ui/StatusBadge'
import { serversApi } from '../services/serversApi'

export default function ServerDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const serverQuery = useQuery({
    queryKey: ['server', id],
    queryFn: () => serversApi.getById(id),
    refetchInterval: 30000,
  })
  const historyQuery = useQuery({
    queryKey: ['server-history', id],
    queryFn: () => serversApi.history(id),
    refetchInterval: 60000,
  })
  const installStatusQuery = useQuery({
    queryKey: ['server-install-status', id],
    queryFn: () => serversApi.installStatus(id),
    refetchInterval: (query) => query.state.data?.status === 'installing' ? 3000 : 10000,
  })

  const installMutation = useMutation({
    mutationFn: () => serversApi.install(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-install-status', id] })
      queryClient.invalidateQueries({ queryKey: ['server', id] })
    },
  })

  const restartMutation = useMutation({
    mutationFn: () => serversApi.restart(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['server', id] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => serversApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] })
      navigate('/servers')
    },
  })

  const server = serverQuery.data
  const installStatus = installStatusQuery.data
  const history = historyQuery.data ?? []

  const chartValues = useMemo(() => ({
    cpu: history.map((entry) => entry.cpu_percent),
    ram: history.map((entry) => entry.ram_percent),
    disk: history.map((entry) => entry.disk_percent),
    network: history.map((entry) => entry.network_in_mbps + entry.network_out_mbps),
  }), [history])

  if (!server) {
    return (
      <div className="glass-panel p-10 text-center text-slate-500">
        Sunucu detaylari yukleniyor...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-4">
          <Link to="/servers" className="secondary-button">
            <ArrowLeft size={16} />
            Geri
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{server.name}</h1>
              {server.server_type === 'main' ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 ring-1 ring-amber-200">
                  <Crown size={14} />
                  Main Server
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>{server.ip_address}</span>
              <span>•</span>
              <span>{server.os_info ?? 'OS bilgisi bekleniyor'}</span>
              <StatusBadge status={server.status} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {server.server_type !== 'main' && (
            <>
              <button type="button" className="primary-button" onClick={() => installMutation.mutate()}>
                <ServerCog size={16} />
                {installMutation.isPending ? 'Baslatiliyor...' : 'Kur'}
              </button>
              <button type="button" className="secondary-button" onClick={() => restartMutation.mutate()}>
                <RefreshCcw size={16} />
                Yeniden Baslat
              </button>
              <button type="button" className="danger-button" onClick={() => deleteMutation.mutate()}>
                <Trash2 size={16} />
                Sil
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <div className="glass-panel p-5">
          <div className="icon-chip mb-4"><Activity size={18} /></div>
          <div className="text-sm text-slate-500">CPU Kullanimi</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{(server.latest_metric?.cpu_percent ?? 0).toFixed(0)}%</div>
          <div className="mt-4"><MetricBar label="CPU" value={server.latest_metric?.cpu_percent ?? 0} /></div>
        </div>
        <div className="glass-panel p-5">
          <div className="icon-chip icon-chip-green mb-4"><HardDrive size={18} /></div>
          <div className="text-sm text-slate-500">RAM Kullanimi</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{(server.latest_metric?.ram_percent ?? 0).toFixed(0)}%</div>
          <div className="mt-4"><MetricBar label="RAM" value={server.latest_metric?.ram_percent ?? 0} tone="green" /></div>
        </div>
        <div className="glass-panel p-5">
          <div className="icon-chip icon-chip-amber mb-4"><HardDrive size={18} /></div>
          <div className="text-sm text-slate-500">Disk Kullanimi</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{(server.latest_metric?.disk_percent ?? 0).toFixed(0)}%</div>
          <div className="mt-4"><MetricBar label="Disk" value={server.latest_metric?.disk_percent ?? 0} tone="amber" /></div>
        </div>
        <div className="glass-panel p-5">
          <div className="icon-chip icon-chip-red mb-4"><RefreshCcw size={18} /></div>
          <div className="text-sm text-slate-500">Ag Trafik Toplami</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{((server.latest_metric?.network_in_mbps ?? 0) + (server.latest_metric?.network_out_mbps ?? 0)).toFixed(2)}</div>
          <div className="mt-1 text-sm text-slate-400">Mbps</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="glass-panel p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-900">Son 24 saat metrik akisi</h2>
            <p className="mt-1 text-sm text-slate-500">CPU, RAM, disk ve network trendlerini cizgi akisi ile izle.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <MetricChart title="CPU" values={chartValues.cpu} stroke="#60a5fa" />
            <MetricChart title="RAM" values={chartValues.ram} stroke="#34d399" />
            <MetricChart title="Disk" values={chartValues.disk} stroke="#f59e0b" />
            <MetricChart title="Network" values={chartValues.network} stroke="#f87171" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-6">
            <h2 className="text-xl font-semibold text-slate-900">Sunucu bilgileri</h2>
            <div className="mt-5 grid gap-4 text-sm text-slate-700">
              <InfoRow label="SSH Kullanici" value={server.ssh_username} />
              <InfoRow label="SSH Port" value={String(server.ssh_port)} />
              <InfoRow label="CPU" value={server.cpu_info ?? 'Hazir degil'} />
              <InfoRow label="RAM Toplam" value={server.ram_total ? `${server.ram_total} MB` : 'Hazir degil'} />
              <InfoRow label="Disk Toplam" value={server.disk_total ? `${server.disk_total} MB` : 'Hazir degil'} />
            </div>
          </div>

          <div className="glass-panel p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Kurulum durumu</h2>
                <p className="mt-1 text-sm text-slate-500">Polling ile canli adim takibi</p>
              </div>
              <StatusBadge status={installStatus?.status ?? server.status} />
            </div>

            <div className="mt-5">
              <MetricBar label={installStatus?.running_step ?? 'Kurulum'} value={installStatus?.progress_percent ?? 0} tone="blue" />
              <div className="mt-2 text-sm text-slate-500">
                {installStatus?.completed_steps ?? 0} / {installStatus?.total_steps ?? 0} adim tamamlandi
              </div>
            </div>

            <div className="mt-5 max-h-[320px] space-y-3 overflow-auto rounded-3xl border border-slate-200 bg-slate-50 p-4">
              {(installStatus?.logs ?? []).length === 0 ? (
                <div className="text-sm text-slate-500">Kurulum logu henuz olusmadi.</div>
              ) : (
                installStatus?.logs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-slate-900">{log.step}</div>
                      <StatusBadge status={log.status} />
                    </div>
                    <div className="mt-2 text-sm text-slate-500">{log.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricChart({ title, values, stroke }: { title: string; values: number[]; stroke: string }) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 text-sm font-medium text-slate-900">{title}</div>
      <Sparkline values={values} stroke={stroke} />
      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">24H trend</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-slate-500">{label}</div>
      <div className="max-w-[60%] text-right text-slate-900">{value}</div>
    </div>
  )
}