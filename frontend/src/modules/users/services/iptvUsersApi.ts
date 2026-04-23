import api from '../../../utils/api'

export interface BouquetBrief {
  id: number
  name: string
  item_count: number
}

export interface IptvUser {
  id: number
  username: string
  password: string
  owner: string
  max_connections: number
  is_trial: boolean
  is_enabled: boolean
  created_at: string
  expiry_date: string | null
  admin_notes: string | null
  reseller_notes: string | null
  forced_connection: 'disabled' | 'forced_on' | 'forced_off'
  is_restreamer: boolean
  forced_country: string | null
  isp_lock_info: string | null
  access_hls: boolean
  access_mpegts: boolean
  access_rtmp: boolean
  allowed_ips: string[]
  allowed_user_agents: string[]
  active_connections: number
  last_ip: string | null
  last_isp: string | null
  last_country_code: string | null
  bouquets: BouquetBrief[]
}

export interface ActiveConnection {
  id: number
  user_id: number
  ip_address: string
  isp_name: string | null
  country_code: string | null
  country_name: string | null
  user_agent: string | null
  stream_id: number | null
  stream_type: string | null
  started_at: string
  last_seen_at: string
  duration_seconds: number
  is_active: boolean
}

export interface WatchStats {
  total_count: number
  total_duration_seconds: number
  top_streams: Array<{
    stream_name: string | null
    stream_type: string | null
    watch_count: number
    total_seconds: number
  }>
  page: number
  page_size: number
  history: Array<{
    id: number
    stream_id: number | null
    stream_name: string | null
    stream_type: string | null
    ip_address: string | null
    country_code: string | null
    isp_name: string | null
    started_at: string
    ended_at: string | null
    duration_seconds: number | null
  }>
}

export interface IptvUserCreatePayload {
  username?: string | null
  password?: string | null
  owner?: string
  max_connections?: number
  is_trial?: boolean
  is_enabled?: boolean
  expiry_date?: string | null
  admin_notes?: string | null
  reseller_notes?: string | null
  forced_connection?: 'disabled' | 'forced_on' | 'forced_off'
  is_restreamer?: boolean
  forced_country?: string | null
  isp_lock_info?: string | null
  access_hls?: boolean
  access_mpegts?: boolean
  access_rtmp?: boolean
  allowed_ips?: string[]
  allowed_user_agents?: string[]
  bouquet_ids?: number[]
}

export const iptvUsersApi = {
  async list(search?: string): Promise<IptvUser[]> {
    const params = search ? { search } : {}
    const r = await api.get<IptvUser[]>('/iptv-users', { params })
    return r.data
  },
  async create(payload: IptvUserCreatePayload): Promise<IptvUser> {
    const r = await api.post<IptvUser>('/iptv-users', payload)
    return r.data
  },
  async get(id: number): Promise<IptvUser> {
    const r = await api.get<IptvUser>(`/iptv-users/${id}`)
    return r.data
  },
  async update(id: number, payload: IptvUserCreatePayload): Promise<IptvUser> {
    const r = await api.put<IptvUser>(`/iptv-users/${id}`, payload)
    return r.data
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/iptv-users/${id}`)
  },
  async ban(id: number): Promise<void> {
    await api.post(`/iptv-users/${id}/ban`)
  },
  async unban(id: number): Promise<void> {
    await api.post(`/iptv-users/${id}/unban`)
  },
  async killAll(id: number): Promise<void> {
    await api.post(`/iptv-users/${id}/kill`)
  },
  async killConnection(userId: number, connId: number): Promise<void> {
    await api.post(`/iptv-users/${userId}/kill-connection/${connId}`)
  },
  async resetRestrictions(id: number): Promise<void> {
    await api.post(`/iptv-users/${id}/reset-restrictions`)
  },
  async getConnections(id: number): Promise<ActiveConnection[]> {
    const r = await api.get<ActiveConnection[]>(`/iptv-users/${id}/connections`)
    return r.data
  },
  async getStats(id: number, page = 1, pageSize = 50, dateFrom?: string, dateTo?: string): Promise<WatchStats> {
    const params: Record<string, unknown> = { page, page_size: pageSize }
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    const r = await api.get<WatchStats>(`/iptv-users/${id}/stats`, { params })
    return r.data
  },
  m3uUrl(user: IptvUser, fmt: 'm3u_plus' | 'm3u8' | 'enigma2_api' = 'm3u_plus'): string {
    return `http://62.210.92.252:8080/get.php?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(user.password)}&type=${fmt}`
  },
}