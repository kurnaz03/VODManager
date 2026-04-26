import api from '../../../utils/api'

export type DownloadStatus = 'queued' | 'approved' | 'downloading' | 'completed' | 'failed' | 'cancelled'
export type DownloadSourceType = 'url' | 'youtube' | 'm3u8'
export type DownloadResolution = '2160' | '1080' | '720' | 'auto'

export interface DownloadItem {
  id: number
  title: string
  url: string
  source_type: DownloadSourceType
  category_id: number
  category_type: string
  category_name: string | null
  tmdb_id: number | null
  tmdb_title: string | null
  tmdb_overview: string | null
  tmdb_poster_url: string | null
  tmdb_backdrop_url: string | null
  tmdb_year: number | null
  tmdb_rating: number | null
  resolution: DownloadResolution
  file_number: number
  file_path: string | null
  file_size_bytes: number | null
  status: DownloadStatus
  progress_percent: number
  speed_mbps: number | null
  eta_seconds: number | null
  error_message: string | null
  // Dizi indirmesi alanlari
  series_id: number | null
  season_id: number | null
  episode_number: number | null
  created_by: number | null
  created_at: string
  updated_at: string | null
}

export interface DownloadCreatePayload {
  title: string
  url: string
  category_id: number
  // 'movies' veya 'series' – default movies
  category_type: 'movies' | 'series'
  tmdb_id?: number | null
  tmdb_title?: string | null
  tmdb_overview?: string | null
  tmdb_poster_url?: string | null
  tmdb_backdrop_url?: string | null
  tmdb_year?: number | null
  tmdb_rating?: number | null
  resolution: DownloadResolution
  vpn_client_id?: number | null
  // Dizi indirmesi icin ek alanlar – sadece category_type='series' oldugunda gonderilir
  series_id?: number | null
  season_id?: number | null
  episode_number?: number | null
}

export interface TmdbMovie {
  id: number
  title: string
  overview: string | null
  poster_url: string | null
  backdrop_url: string | null
  release_year: number | null
  rating: number | null
}

export interface TmdbTv {
  id: number
  title: string
  overview: string | null
  poster_url: string | null
  backdrop_url: string | null
  first_air_year: number | null
  rating: number | null
  number_of_seasons?: number | null
  genres?: string[]
}

export const downloadsApi = {
  async listDownloads(params?: { status?: string; category_id?: number }) {
    const response = await api.get<DownloadItem[]>('/downloads', { params })
    return response.data
  },

  async createDownload(payload: DownloadCreatePayload) {
    const response = await api.post<DownloadItem>('/downloads', payload)
    return response.data
  },

  async approveDownload(downloadId: number) {
    const response = await api.post<DownloadItem>(`/downloads/${downloadId}/approve`)
    return response.data
  },

  async cancelDownload(downloadId: number) {
    const response = await api.post<DownloadItem>(`/downloads/${downloadId}/cancel`)
    return response.data
  },

  async retryDownload(downloadId: number) {
    const response = await api.post<DownloadItem>(`/downloads/${downloadId}/retry`)
    return response.data
  },

  async deleteDownload(downloadId: number) {
    await api.delete(`/downloads/${downloadId}`)
  },

  async clearDownloads() {
    const response = await api.post<{ deleted: number }>('/downloads/clear')
    return response.data
  },

  async searchTmdbMovies(query: string) {
    const response = await api.get<TmdbMovie[]>('/tmdb/search/movie', {
      params: { query },
    })
    return response.data
  },

  async getTmdbMovie(tmdbId: number) {
    const response = await api.get<TmdbMovie>(`/tmdb/movie/${tmdbId}`)
    return response.data
  },

  async searchTmdbTv(query: string) {
    const response = await api.get<TmdbTv[]>('/tmdb/search/tv', {
      params: { query },
    })
    return response.data
  },

  async getTmdbTv(tmdbId: number) {
    const response = await api.get<TmdbTv>(`/tmdb/tv/${tmdbId}`)
    return response.data
  },
}