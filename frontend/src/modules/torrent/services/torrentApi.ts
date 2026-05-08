import api from '../../../utils/api'

export type TorrentStatus = 'downloading' | 'seeding' | 'completed' | 'paused' | 'error' | 'queued'
export type TorrentCategory = 'movie' | 'series'

export interface TorrentItem {
  id: number
  name: string
  magnet_link: string | null
  torrent_file_path: string | null
  category: TorrentCategory
  category_id: number | null
  season_id: number | null
  status: TorrentStatus
  progress: number
  download_speed: number | null
  upload_speed: number | null
  size_total: number | null
  size_downloaded: number | null
  eta_seconds: number | null
  save_path: string | null
  info_hash: string | null
  error_message: string | null
  no_seed: boolean
  created_at: string
  updated_at: string | null
}

export interface TorrentAddPayload {
  magnet_link: string
  name?: string
  category: TorrentCategory
  category_id?: number | null
  season_id?: number | null
  no_seed?: boolean
}

export interface TorrentFileItem {
  index: number
  path: string
  size: number
  progress: number
}

export interface TMDBResult {
  tmdb_id: number
  title: string
  original_title: string
  year: number | null
  overview: string
  poster_url: string | null
}

export const torrentApi = {
  add: (payload: TorrentAddPayload) =>
    api.post<TorrentItem>('/torrent', payload).then((r) => r.data),

  addFile: (formData: FormData) =>
    api.post<TorrentItem>('/torrent/add-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  list: () =>
    api.get<TorrentItem[]>('/torrent').then((r) => r.data),

  pause: (id: number) =>
    api.put<TorrentItem>(`/torrent/${id}/pause`).then((r) => r.data),

  resume: (id: number) =>
    api.put<TorrentItem>(`/torrent/${id}/resume`).then((r) => r.data),

  delete: (id: number, removeFiles = false) =>
    api.delete(`/torrent/${id}`, { params: { remove_files: removeFiles } }),

  files: (id: number) =>
    api.get<TorrentFileItem[]>(`/torrent/${id}/files`).then((r) => r.data),

  tmdbSearch: (query: string) =>
    api.get<TMDBResult[]>('/torrent/tmdb-search', { params: { query } }).then((r) => r.data),
}
