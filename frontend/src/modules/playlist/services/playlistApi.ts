import api from '../../../utils/api'

export interface PlaylistItem {
  id: number
  playlist_id: number
  transcode_job_id: number
  position: number
  title: string
  duration_seconds: number
  file_path: string
  tmdb_id: number | null
  tmdb_title: string | null
  tmdb_overview: string | null
  tmdb_poster_url: string | null
  is_visible_in_category: boolean
  created_at: string
}

export interface Playlist {
  id: number
  name: string
  description: string | null
  status: string
  server_id: number | null
  server_name: string | null
  server_type?: string | null
  current_item_index: number
  started_at: string | null
  total_duration_seconds: number
  loop: boolean
  ffmpeg_pid: number | null
  stream_url: string | null
  item_count: number
  created_at: string
  updated_at: string | null
  items: PlaylistItem[]
}

export interface PlaylistCreate {
  name: string
  description?: string | null
  server_id?: number | null
  loop?: boolean
}

export interface TranscodeJobForPlaylist {
  id: number
  movie_title: string | null
  output_file_path: string | null
  transcode_profile_id: number
  profile_name: string | null
  status: string
  completed_at: string | null
  is_in_playlist: boolean
}

export interface BroadcastStatus {
  playlist_id: number
  status: string
  ffmpeg_pid: number | null
  stream_url: string | null
  started_at: string | null
  elapsed_seconds: number
  current_item_index: number
  current_title: string | null
  is_running: boolean
}

export interface EpgProgram {
  start: string
  stop: string
  title: string
  desc: string
  poster: string
  duration_seconds: number
  is_current: boolean
}

export const playlistApi = {
  async list(): Promise<Playlist[]> {
    const r = await api.get<Playlist[]>('/playlists')
    return r.data
  },
  async get(id: number): Promise<Playlist> {
    const r = await api.get<Playlist>(`/playlists/${id}`)
    return r.data
  },
  async create(payload: PlaylistCreate): Promise<Playlist> {
    const r = await api.post<Playlist>('/playlists', payload)
    return r.data
  },
  async update(id: number, payload: Partial<PlaylistCreate & { status?: string }>): Promise<Playlist> {
    const r = await api.put<Playlist>(`/playlists/${id}`, payload)
    return r.data
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/playlists/${id}`)
  },
  async addItem(playlistId: number, transcodeJobId: number): Promise<PlaylistItem> {
    const r = await api.post<PlaylistItem>(`/playlists/${playlistId}/items`, {
      transcode_job_id: transcodeJobId,
    })
    return r.data
  },
  async removeItem(playlistId: number, itemId: number): Promise<void> {
    await api.delete(`/playlists/${playlistId}/items/${itemId}`)
  },
  async reorder(playlistId: number, itemIds: number[]): Promise<Playlist> {
    const r = await api.put<Playlist>(`/playlists/${playlistId}/items/reorder`, { item_ids: itemIds })
    return r.data
  },
  async jobsByProfile(profileId: number): Promise<TranscodeJobForPlaylist[]> {
    const r = await api.get<TranscodeJobForPlaylist[]>(`/playlists/jobs/by-profile/${profileId}`)
    return r.data
  },
  async startBroadcast(playlistId: number): Promise<{ ok: boolean; pid: number; stream_url: string }> {
    const r = await api.post(`/playlists/${playlistId}/start`)
    return r.data
  },
  async stopBroadcast(playlistId: number): Promise<{ ok: boolean }> {
    const r = await api.post(`/playlists/${playlistId}/stop`)
    return r.data
  },
  async getBroadcastStatus(playlistId: number): Promise<BroadcastStatus> {
    const r = await api.get<BroadcastStatus>(`/playlists/${playlistId}/status`)
    return r.data
  },
  async updateBroadcastList(playlistId: number): Promise<{ ok: boolean }> {
    const r = await api.post(`/playlists/${playlistId}/update-list`)
    return r.data
  },
  async getEpgPrograms(playlistId: number): Promise<EpgProgram[]> {
    const r = await api.get<EpgProgram[]>(`/playlists/${playlistId}/epg/programs`)
    return r.data
  },
}
