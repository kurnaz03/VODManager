import api from '../../../utils/api'

export interface NowPlayingChannel {
  channel_number: number
  playlist_id: number
  playlist_name: string
  stream_url: string | null
  status: string
  current_title: string | null
  current_poster: string | null
  current_overview: string | null
}

export interface InfoScreenTemplate {
  id: number
  name: string
  is_default: boolean
  bg_image_url: string | null
  title_text: string
  subtitle_text: string | null
  primary_color: string
  bg_overlay_opacity: number
  font_family: string
  layout: string
  bouquet_id: number | null
  server_id: number | null
  created_at: string
  updated_at: string | null
}

export interface InfoScreenStreamStatus {
  running: boolean
  pid: number | null
  stream_url: string | null
  started_at: string | null
  remote?: boolean
}

export interface BouquetOption {
  id: number
  name: string
}

export interface ServerOption {
  id: number
  name: string
  ip_address: string
}

export const nowPlayingApi = {
  async getNowPlaying(): Promise<NowPlayingChannel[]> {
    const r = await api.get<NowPlayingChannel[]>('/playlists/now-playing')
    return r.data
  },
  async listTemplates(): Promise<InfoScreenTemplate[]> {
    const r = await api.get<InfoScreenTemplate[]>('/playlists/info-screen/templates')
    return r.data
  },
  async createTemplate(data: Partial<InfoScreenTemplate>): Promise<InfoScreenTemplate> {
    const r = await api.post<InfoScreenTemplate>('/playlists/info-screen/templates', data)
    return r.data
  },
  async updateTemplate(id: number, data: Partial<InfoScreenTemplate>): Promise<InfoScreenTemplate> {
    const r = await api.put<InfoScreenTemplate>(`/playlists/info-screen/templates/${id}`, data)
    return r.data
  },
  async deleteTemplate(id: number): Promise<void> {
    await api.delete(`/playlists/info-screen/templates/${id}`)
  },
  async setDefault(id: number): Promise<void> {
    await api.post(`/playlists/info-screen/templates/${id}/set-default`)
  },
  async uploadBg(file: File): Promise<{ url: string }> {
    const form = new FormData()
    form.append('file', file)
    const r = await api.post('/playlists/info-screen/upload-bg', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data
  },
  async startStream(): Promise<{ ok: boolean; pid: number; stream_url: string }> {
    const r = await api.post('/playlists/info-screen/stream/start')
    return r.data
  },
  async stopStream(): Promise<{ ok: boolean }> {
    const r = await api.post('/playlists/info-screen/stream/stop')
    return r.data
  },
  async getStreamStatus(): Promise<InfoScreenStreamStatus> {
    const r = await api.get<InfoScreenStreamStatus>('/playlists/info-screen/stream/status')
    return r.data
  },
  async listBouquets(): Promise<BouquetOption[]> {
    const r = await api.get<{ id: number; name: string }[]>('/bouquets')
    return r.data.map((b) => ({ id: b.id, name: b.name }))
  },
  async listServers(): Promise<ServerOption[]> {
    const r = await api.get<{ id: number; name: string; ip_address: string }[]>('/servers')
    return r.data.map((s) => ({ id: s.id, name: s.name, ip_address: s.ip_address }))
  },
}
