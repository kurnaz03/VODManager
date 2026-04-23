import api from '../../../utils/api'

export interface ServerMetric {
  id: number
  cpu_percent: number
  ram_percent: number
  ram_used: number
  disk_percent: number
  disk_used: number
  network_in_mbps: number
  network_out_mbps: number
  active_connections: number
  collected_at: string
}

export interface InstallLog {
  id: number
  step: string
  status: string
  message: string | null
  created_at: string
}

export interface Server {
  id: number
  name: string
  ip_address: string
  ssh_port: number
  ssh_username: string
  server_type: 'main' | 'loadbalancer'
  status: 'online' | 'offline' | 'installing' | 'error'
  os_info: string | null
  cpu_info: string | null
  ram_total: number | null
  disk_total: number | null
  domain_name: string | null
  max_clients: number | null
  network_interface: string | null
  network_speed: number | null
  http_port: number | null
  https_port: number | null
  rtmp_port: number | null
  created_at: string
  updated_at: string | null
  latest_metric: ServerMetric | null
}

export interface ServerCheckResponse {
  ok: boolean
  message: string
  os_info: string | null
  cpu_info: string | null
  ram_total: number | null
  disk_total: number | null
}

export interface InstallStatus {
  server_id: number
  status: string
  progress_percent: number
  total_steps: number
  completed_steps: number
  running_step: string | null
  logs: InstallLog[]
}

export interface ServerPayload {
  name: string
  ip_address: string
  ssh_port: number
  ssh_username: string
  ssh_password: string
}

export interface ServerUpdatePayload {
  name?: string
  ip_address?: string
  ssh_port?: number
  ssh_username?: string
  ssh_password?: string
  domain_name?: string
  max_clients?: number
  network_interface?: string
  network_speed?: number
  http_port?: number
  https_port?: number
  rtmp_port?: number
}

export const serversApi = {
  async list() {
    const response = await api.get<Server[]>('/servers')
    return response.data
  },

  async getById(id: string | number) {
    const response = await api.get<Server>(`/servers/${id}`)
    return response.data
  },

  async create(payload: ServerPayload) {
    const response = await api.post<Server>('/servers', payload)
    return response.data
  },

  async update(id: string | number, payload: ServerUpdatePayload) {
    const response = await api.put<Server>(`/servers/${id}`, payload)
    return response.data
  },

  async remove(id: string | number) {
    await api.delete(`/servers/${id}`)
  },

  async check(payload: ServerPayload) {
    const response = await api.post<ServerCheckResponse>('/servers/check', payload)
    return response.data
  },

  async checkSaved(id: string | number) {
    const response = await api.post<ServerCheckResponse>(`/servers/${id}/check`)
    return response.data
  },

  async latestMetrics(id: string | number) {
    const response = await api.get<ServerMetric | null>(`/servers/${id}/metrics`)
    return response.data
  },

  async history(id: string | number) {
    const response = await api.get<ServerMetric[]>(`/servers/${id}/metrics/history`)
    return response.data
  },

  async install(id: string | number) {
    const response = await api.post<{ message: string }>(`/servers/${id}/install`)
    return response.data
  },

  async installStatus(id: string | number) {
    const response = await api.get<InstallStatus>(`/servers/${id}/install/status`)
    return response.data
  },

  async restart(id: string | number) {
    const response = await api.post<{ message: string }>(`/servers/${id}/restart`)
    return response.data
  },
}