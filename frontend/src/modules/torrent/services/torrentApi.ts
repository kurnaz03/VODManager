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
  created_at: string
  updated_at: string | null
}

export interface TorrentAddPayload {
  magnet_link: string
  name?: string
  category: TorrentCategory
  category_id?: number | null
}

export interface TorrentFileItem {
  index: number
  path: string
  size: number
  progress: number
}

export const torrentApi = {
  add: (payload: TorrentAddPayload) =>
    api.post<TorrentItem>('/torrent', payload).then((r) => r.data),

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
}
