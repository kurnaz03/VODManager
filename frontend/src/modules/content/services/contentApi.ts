import api from '../../../utils/api'

export type CategoryType = 'movies' | 'series' | 'tv' | 'radio'
export type BouquetType = 'mixed' | 'movies' | 'series' | 'tv' | 'radio'
export type BouquetItemType = 'tv' | 'series' | 'vod_channel' | 'radio' | 'movie'

export interface Category {
  id: number
  name: string
  description: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface CategoryPayload {
  name: string
  description?: string | null
  icon?: string | null
  sort_order: number
  is_active: boolean
}

export interface Bouquet {
  id: number
  name: string
  description: string | null
  bouquet_type: BouquetType
  is_active: boolean
  sort_order: number
  category_count: number
  item_count: number
  created_at: string
  updated_at: string | null
}

export interface BouquetCategoryAssignment {
  id: number
  category_type: CategoryType
  category_id: number
  sort_order: number
  category_name: string
  category_description: string | null
  icon: string | null
  is_active: boolean
  created_at: string
}

export interface BouquetDetail {
  id: number
  name: string
  description: string | null
  bouquet_type: BouquetType
  is_active: boolean
  sort_order: number
  categories: BouquetCategoryAssignment[]
  created_at: string
  updated_at: string | null
}

export interface BouquetItem {
  id: number
  bouquet_id: number
  item_type: BouquetItemType
  item_id: number
  position: number
  item_title: string | null
  item_logo: string | null
  created_at: string
}

export interface BouquetItemAdd {
  item_type: BouquetItemType
  item_id: number
  position?: number
}

export interface BouquetPayload {
  name: string
  description?: string | null
  bouquet_type: BouquetType
  is_active: boolean
  sort_order: number
}

export const contentApi = {
  async listCategories(categoryType: CategoryType) {
    const response = await api.get<Category[]>(`/categories/${categoryType}`)
    return response.data
  },

  async createCategory(categoryType: CategoryType, payload: CategoryPayload) {
    const response = await api.post<Category>(`/categories/${categoryType}`, payload)
    return response.data
  },

  async updateCategory(categoryType: CategoryType, categoryId: number, payload: Partial<CategoryPayload>) {
    const response = await api.put<Category>(`/categories/${categoryType}/${categoryId}`, payload)
    return response.data
  },

  async deleteCategory(categoryType: CategoryType, categoryId: number) {
    await api.delete(`/categories/${categoryType}/${categoryId}`)
  },

  async listBouquets() {
    const response = await api.get<Bouquet[]>('/bouquets')
    return response.data
  },

  async createBouquet(payload: BouquetPayload) {
    const response = await api.post<Bouquet>('/bouquets', payload)
    return response.data
  },

  async getBouquet(bouquetId: string | number) {
    const response = await api.get<BouquetDetail>(`/bouquets/${bouquetId}`)
    return response.data
  },

  async updateBouquet(bouquetId: string | number, payload: Partial<BouquetPayload>) {
    const response = await api.put<BouquetDetail>(`/bouquets/${bouquetId}`, payload)
    return response.data
  },

  async deleteBouquet(bouquetId: string | number) {
    await api.delete(`/bouquets/${bouquetId}`)
  },

  async replaceBouquetCategories(
    bouquetId: string | number,
    categories: Array<{ category_type: CategoryType; category_id: number; sort_order: number }>,
  ) {
    const response = await api.put<BouquetDetail>(`/bouquets/${bouquetId}/categories`, { categories })
    return response.data
  },

  async addBouquetCategory(
    bouquetId: string | number,
    payload: { category_type: CategoryType; category_id: number; sort_order: number },
  ) {
    const response = await api.post<BouquetCategoryAssignment>(`/bouquets/${bouquetId}/categories`, payload)
    return response.data
  },

  async removeBouquetCategory(bouquetId: string | number, categoryType: CategoryType, categoryId: number) {
    await api.delete(`/bouquets/${bouquetId}/categories/${categoryType}/${categoryId}`)
  },

  async listBouquetItems(bouquetId: string | number) {
    const response = await api.get<BouquetItem[]>(`/bouquets/${bouquetId}/items`)
    return response.data
  },

  async addBouquetItems(bouquetId: string | number, items: BouquetItemAdd[]) {
    const response = await api.post<BouquetItem[]>(`/bouquets/${bouquetId}/items`, { items })
    return response.data
  },

  async removeBouquetItem(bouquetId: string | number, itemId: number) {
    await api.delete(`/bouquets/${bouquetId}/items/${itemId}`)
  },
}

// ── Movies Content API ────────────────────────────────────────────────────────

export interface MovieContent {
  id: number
  title: string
  description: string | null
  category_id: number | null
  category_name: string | null
  tmdb_id: number | null
  poster_url: string | null
  backdrop_url: string | null
  release_year: number | null
  rating: number | null
  resolution: string | null
  audio_bitrate: number | null
  file_path: string | null
  file_size_bytes: number | null
  source_url: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface MovieContentUpdate {
  title?: string
  description?: string | null
  category_id?: number | null
  poster_url?: string | null
  is_public?: boolean
}

export const moviesApi = {
  async list(categoryId?: number) {
    const params = categoryId != null ? { category_id: categoryId } : {}
    const r = await api.get<MovieContent[]>('/movies', { params })
    return r.data
  },
  async update(id: number, payload: MovieContentUpdate) {
    const r = await api.put<MovieContent>(`/movies/${id}`, payload)
    return r.data
  },
  async remove(id: number) {
    await api.delete(`/movies/${id}`)
  },
}

// ── Series Content API ────────────────────────────────────────────────────────

export interface SeriesContent {
  id: number
  title: string
  description: string | null
  category_id: number | null
  category_name: string | null
  tmdb_id: number | null
  poster_url: string | null
  backdrop_url: string | null
  release_year: number | null
  rating: number | null
  season_count: number
  broadcast_day: string | null
  broadcast_channel: string | null
  channel_logo_url: string | null
  created_at: string
  updated_at: string
}

export interface SeriesContentCreate {
  title: string
  description?: string | null
  category_id?: number | null
  tmdb_id?: number | null
  poster_url?: string | null
  backdrop_url?: string | null
  release_year?: number | null
  rating?: number | null
  broadcast_day?: string | null
  broadcast_channel?: string | null
  channel_logo_url?: string | null
}

export interface Season {
  id: number
  series_id: number
  season_number: number
  title: string | null
  episode_count: number
  created_at: string
}

export interface Episode {
  id: number
  season_id: number
  episode_number: number
  title: string | null
  duration: number | null
  resolution: string | null
  audio_bitrate: number | null
  file_path: string | null
  source_url: string | null
  created_at: string
}

export interface EpisodeCreate {
  episode_number: number
  title?: string | null
  duration?: number | null
  resolution?: string | null
  audio_bitrate?: number | null
  file_path?: string | null
  source_url?: string | null
}

export const seriesApi = {
  async list(categoryId?: number) {
    const params = categoryId != null ? { category_id: categoryId } : {}
    const r = await api.get<SeriesContent[]>('/series', { params })
    return r.data
  },
  async broadcastToday() {
    const r = await api.get<SeriesContent[]>('/series/broadcast/today')
    return r.data
  },
  async create(payload: SeriesContentCreate) {
    const r = await api.post<SeriesContent>('/series', payload)
    return r.data
  },
  async update(id: number, payload: Partial<SeriesContentCreate>) {
    const r = await api.put<SeriesContent>(`/series/${id}`, payload)
    return r.data
  },
  async remove(id: number) {
    await api.delete(`/series/${id}`)
  },
  async listSeasons(seriesId: number) {
    const r = await api.get<Season[]>(`/series/${seriesId}/seasons`)
    return r.data
  },
  async createSeason(seriesId: number, payload: { season_number: number; title?: string | null }) {
    const r = await api.post<Season>(`/series/${seriesId}/seasons`, payload)
    return r.data
  },
  async deleteSeason(seriesId: number, seasonId: number) {
    await api.delete(`/series/${seriesId}/seasons/${seasonId}`)
  },
  async listEpisodes(seasonId: number) {
    const r = await api.get<Episode[]>(`/seasons/${seasonId}/episodes`)
    return r.data
  },
  async createEpisode(seasonId: number, payload: EpisodeCreate) {
    const r = await api.post<Episode>(`/seasons/${seasonId}/episodes`, payload)
    return r.data
  },
  async updateEpisode(episodeId: number, payload: Partial<EpisodeCreate>) {
    const r = await api.put<Episode>(`/episodes/${episodeId}`, payload)
    return r.data
  },
  async deleteEpisode(episodeId: number) {
    await api.delete(`/episodes/${episodeId}`)
  },
}

// ── TV/Radio Content API ──────────────────────────────────────────────────────

export interface StreamContent {
  id: number
  title: string
  description: string | null
  category_id: number | null
  category_name: string | null
  logo_url: string | null
  stream_url: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export const tvApi = {
  async list(categoryId?: number) {
    const params = categoryId != null ? { category_id: categoryId } : {}
    const r = await api.get<StreamContent[]>('/tv', { params })
    return r.data
  },
  async update(id: number, payload: Partial<StreamContent>) {
    const r = await api.put<StreamContent>(`/tv/${id}`, payload)
    return r.data
  },
  async remove(id: number) {
    await api.delete(`/tv/${id}`)
  },
}

export interface RadioContent {
  id: number
  title: string
  description: string | null
  category_id: number | null
  category_name: string | null
  logo_url: string | null
  stream_url: string | null
  visual_url: string | null
  visual_type: 'video' | 'image' | 'none'
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface RadioContentCreate {
  title: string
  description?: string | null
  category_id?: number | null
  logo_url?: string | null
  stream_url?: string | null
  visual_url?: string | null
  visual_type?: 'video' | 'image' | 'none'
  is_public?: boolean
}

export const radioApi = {
  async list(categoryId?: number) {
    const params = categoryId != null ? { category_id: categoryId } : {}
    const r = await api.get<RadioContent[]>('/radio', { params })
    return r.data
  },
  async create(payload: RadioContentCreate) {
    const r = await api.post<RadioContent>('/radio', payload)
    return r.data
  },
  async update(id: number, payload: Partial<RadioContentCreate>) {
    const r = await api.put<RadioContent>(`/radio/${id}`, payload)
    return r.data
  },
  async remove(id: number) {
    await api.delete(`/radio/${id}`)
  },
}

// ── Music API ─────────────────────────────────────────────────────────────────

export interface MusicTrack {
  id: number
  title: string
  artist: string | null
  duration_seconds: number | null
  file_path: string | null
  stream_url: string | null
  category_id: number | null
  category_name: string | null
  cover_url: string | null
  created_at: string
}

export interface MusicTrackCreate {
  title: string
  artist?: string | null
  stream_url?: string | null
  category_id?: number | null
  cover_url?: string | null
}

export interface MusicPlaylistItem {
  id: number
  playlist_id: number
  track_id: number
  position: number
  track: MusicTrack
}

export interface MusicPlaylist {
  id: number
  name: string
  description: string | null
  visual_url: string | null
  visual_type: 'video' | 'image' | 'none'
  is_active: boolean
  server_id: number | null
  ffmpeg_pid: number | null
  stream_url: string | null
  status: 'stopped' | 'playing'
  started_at: string | null
  items: MusicPlaylistItem[]
  created_at: string
}

export interface MusicPlaylistCreate {
  name: string
  description?: string | null
  visual_url?: string | null
  visual_type?: 'video' | 'image' | 'none'
  server_id?: number | null
}

export interface MusicPlaylistStatus {
  id: number
  status: string
  is_running: boolean
  pid: number | null
  stream_url: string | null
  elapsed_seconds: number | null
  current_title: string | null
}

export const musicApi = {
  tracks: {
    async list(categoryId?: number) {
      const params = categoryId != null ? { category_id: categoryId } : {}
      const r = await api.get<MusicTrack[]>('/music/tracks', { params })
      return r.data
    },
    async create(payload: MusicTrackCreate) {
      const r = await api.post<MusicTrack>('/music/tracks', payload)
      return r.data
    },
    async update(id: number, payload: Partial<MusicTrackCreate>) {
      const r = await api.put<MusicTrack>(`/music/tracks/${id}`, payload)
      return r.data
    },
    async remove(id: number) {
      await api.delete(`/music/tracks/${id}`)
    },
  },
  playlists: {
    async list() {
      const r = await api.get<MusicPlaylist[]>('/music/playlists')
      return r.data
    },
    async get(id: number) {
      const r = await api.get<MusicPlaylist>(`/music/playlists/${id}`)
      return r.data
    },
    async create(payload: MusicPlaylistCreate) {
      const r = await api.post<MusicPlaylist>('/music/playlists', payload)
      return r.data
    },
    async update(id: number, payload: Partial<MusicPlaylistCreate>) {
      const r = await api.put<MusicPlaylist>(`/music/playlists/${id}`, payload)
      return r.data
    },
    async remove(id: number) {
      await api.delete(`/music/playlists/${id}`)
    },
    async addItem(id: number, track_id: number, position?: number) {
      const r = await api.post<MusicPlaylistItem>(`/music/playlists/${id}/items`, { track_id, position })
      return r.data
    },
    async removeItem(id: number, item_id: number) {
      await api.delete(`/music/playlists/${id}/items/${item_id}`)
    },
    async reorderItems(id: number, item_ids: number[]) {
      const r = await api.put<MusicPlaylist>(`/music/playlists/${id}/items/reorder`, { item_ids })
      return r.data
    },
    async start(id: number) {
      const r = await api.post<MusicPlaylistStatus>(`/music/playlists/${id}/start`)
      return r.data
    },
    async stop(id: number) {
      const r = await api.post<MusicPlaylistStatus>(`/music/playlists/${id}/stop`)
      return r.data
    },
    async status(id: number) {
      const r = await api.get<MusicPlaylistStatus>(`/music/playlists/${id}/status`)
      return r.data
    },
  },
}

// ── TMDB API ─────────────────────────────────────────────────────────────────

export interface TmdbEpisode {
  episode_number: number
  name: string | null
  overview: string | null
  still_path: string | null
  runtime: number | null
}

export interface TmdbSeason {
  season_number: number
  name: string | null
  episode_count: number
  poster: string | null
  episodes: TmdbEpisode[]
}

export const tmdbApi = {
  async getTvSeasons(tmdbId: number): Promise<TmdbSeason[]> {
    const r = await api.get<TmdbSeason[]>(`/tmdb/tv/${tmdbId}/seasons`)
    return r.data
  },
}

// ── File Browser API ──────────────────────────────────────────────────────────

export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  ext?: string
}

export interface BrowseResult {
  current_path: string
  parent_path: string | null
  dirs: FileEntry[]
  files: FileEntry[]
}

export const filesApi = {
  async browse(path: string, serverId?: number): Promise<BrowseResult> {
    const params: Record<string, string | number> = { path }
    if (serverId != null) params.server_id = serverId
    const r = await api.get<BrowseResult>('/files/browse', { params })
    return r.data
  },
}

export const episodeDownloadUrl = (episodeId: number): string => {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '')
  return `${base}/episodes/${episodeId}/download`
}