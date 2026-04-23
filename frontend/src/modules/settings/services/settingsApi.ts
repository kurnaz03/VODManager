import api from '../../../utils/api'

export interface ThemeSettings {
  panel_name: string
  logo_url: string | null
  primary_color: string
  sidebar_color: string
  accent_color: string
}

export interface ThemeSettingsPayload {
  panel_name: string
  primary_color: string
  sidebar_color: string
  accent_color: string
}

export interface TmdbSettings {
  api_key_masked: string | null
  has_api_key: boolean
  language: string
}

export interface TmdbSettingsPayload {
  api_key?: string
  language: string
}

export interface TmdbTestResult {
  success: boolean
  message: string
  language: string
  sample_title: string | null
}

export interface YoutubeSettings {
  email: string | null
  mode: 'automatic' | 'manual' | null
  status: 'active' | 'expired' | 'error'
  last_refresh_at: string | null
  next_refresh_at: string | null
  error_message: string | null
  cookies_available: boolean
  has_credentials: boolean
  updated_at: string | null
  message: string | null
}

export interface YoutubeLoginPayload {
  email: string
  password: string
}

export interface DownloadSettings {
  max_concurrent_downloads: number
  max_download_speed_mbps: number
  default_download_directory: string
}

export interface DownloadSettingsPayload {
  max_concurrent_downloads: number
  max_download_speed_mbps: number
}

export const settingsApi = {
  async getTheme() {
    const response = await api.get<ThemeSettings>('/settings/theme')
    return response.data
  },

  async updateTheme(payload: ThemeSettingsPayload) {
    const response = await api.put<ThemeSettings>('/settings/theme', payload)
    return response.data
  },

  async uploadLogo(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<ThemeSettings>('/settings/theme/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  async deleteLogo() {
    const response = await api.delete<ThemeSettings>('/settings/theme/logo')
    return response.data
  },

  async getTmdb() {
    const response = await api.get<TmdbSettings>('/settings/tmdb')
    return response.data
  },

  async updateTmdb(payload: TmdbSettingsPayload) {
    const response = await api.put<TmdbSettings>('/settings/tmdb', payload)
    return response.data
  },

  async testTmdb() {
    const response = await api.post<TmdbTestResult>('/settings/tmdb/test')
    return response.data
  },

  async getYoutube() {
    const response = await api.get<YoutubeSettings>('/settings/youtube')
    return response.data
  },

  async loginYoutube(payload: YoutubeLoginPayload) {
    const response = await api.post<YoutubeSettings>('/settings/youtube/login', payload)
    return response.data
  },

  async uploadYoutubeCookiesText(cookies_text: string) {
    const response = await api.post<YoutubeSettings>('/settings/youtube/cookies/text', { cookies_text })
    return response.data
  },

  async uploadYoutubeCookiesFile(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post<YoutubeSettings>('/settings/youtube/cookies/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  async refreshYoutube() {
    const response = await api.post<YoutubeSettings>('/settings/youtube/refresh')
    return response.data
  },

  async deleteYoutube() {
    const response = await api.delete<YoutubeSettings>('/settings/youtube')
    return response.data
  },

  async getDownloadSettings() {
    const response = await api.get<DownloadSettings>('/downloads/settings')
    return response.data
  },

  async updateDownloadSettings(payload: DownloadSettingsPayload) {
    const response = await api.put<DownloadSettings>('/downloads/settings', payload)
    return response.data
  },
}