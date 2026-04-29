import api from '../../../utils/api'

export interface TvChannelServerOut {
  id: number
  tv_channel_id: number
  server_id: number
  server_name: string | null
  server_ip: string | null
  is_active: boolean
  priority: number
  created_at: string
}

export interface TvChannelBouquetOut {
  id: number
  tv_channel_id: number
  bouquet_id: number
  bouquet_name: string | null
  position: number
  created_at: string
}

export interface TvChannel {
  id: number
  name: string
  logo_url: string | null
  epg_channel_id: string | null
  stream_url: string
  category_id: number | null
  category_name: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  servers: TvChannelServerOut[]
  bouquet_assignments: TvChannelBouquetOut[]
  backup_urls: string[]
  on_demand: boolean
  on_demand_timeout: number
  on_demand_server_id: number | null
  on_demand_server_name: string | null
  started_at: string | null
  uptime_seconds: number | null
}

export interface TvChannelCreate {
  name: string
  logo_url?: string | null
  epg_channel_id?: string | null
  stream_url: string
  category_id?: number | null
  is_active: boolean
  sort_order: number
  server_ids: number[]
  bouquet_ids: number[]
  backup_urls?: string[]
  on_demand?: boolean
  on_demand_timeout?: number
  on_demand_server_id?: number | null
}

export interface TvChannelUpdate {
  name?: string
  logo_url?: string | null
  epg_channel_id?: string | null
  stream_url?: string
  category_id?: number | null
  is_active?: boolean
  sort_order?: number
  server_ids?: number[]
  bouquet_ids?: number[]
  backup_urls?: string[]
  on_demand?: boolean
  on_demand_timeout?: number
  on_demand_server_id?: number | null
}

export interface TvChannelTestResult {
  channel_id: number
  stream_url: string
  ok: boolean
  status_code: number | null
  message: string
}

export interface ViewerInfo {
  username: string
  ip_address: string
  connected_at: number
  duration_seconds: number
}

export interface ChannelViewerCounts {
  counts: { [channelId: number]: number }
}

export const tvChannelsApi = {
  async list(categoryId?: number, activeOnly?: boolean): Promise<TvChannel[]> {
    const params: Record<string, string | number | boolean> = {}
    if (categoryId != null) params.category_id = categoryId
    if (activeOnly != null) params.active_only = activeOnly
    const r = await api.get<TvChannel[]>('/tv/channels', { params })
    return r.data
  },

  async get(id: number): Promise<TvChannel> {
    const r = await api.get<TvChannel>(`/tv/channels/${id}`)
    return r.data
  },

  async create(payload: TvChannelCreate): Promise<TvChannel> {
    const r = await api.post<TvChannel>('/tv/channels', payload)
    return r.data
  },

  async update(id: number, payload: TvChannelUpdate): Promise<TvChannel> {
    const r = await api.put<TvChannel>(`/tv/channels/${id}`, payload)
    return r.data
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/tv/channels/${id}`)
  },

  async test(id: number): Promise<TvChannelTestResult> {
    const r = await api.get<TvChannelTestResult>(`/tv/channels/${id}/test`)
    return r.data
  },

  async start(id: number): Promise<TvChannel> {
    const r = await api.post<TvChannel>(`/tv/channels/${id}/start`)
    return r.data
  },

  async stop(id: number): Promise<TvChannel> {
    const r = await api.post<TvChannel>(`/tv/channels/${id}/stop`)
    return r.data
  },

  async restart(id: number): Promise<TvChannel> {
    const r = await api.post<TvChannel>(`/tv/channels/${id}/restart`)
    return r.data
  },

  async getViewerCounts(): Promise<ChannelViewerCounts> {
    const r = await api.get<ChannelViewerCounts>('/tv/channels/viewers/counts')
    return r.data
  },

  async getChannelViewers(channelId: number): Promise<ViewerInfo[]> {
    const r = await api.get<ViewerInfo[]>(`/tv/channels/${channelId}/viewers`)
    return r.data
  },
}
