import api from '../../../utils/api'

export interface TranscodeJob {
  id: number
  movie_content_id: number
  movie_title: string | null
  movie_file_path: string | null
  transcode_profile_id: number
  profile_name: string | null
  server_id: number | null
  server_name: string | null
  source_file_path: string
  output_file_path: string | null
  unique_number: number
  overlay_text: string | null
  text_position: string
  text_size: number
  text_color: string
  text_bg_enabled: boolean
  text_bg_color: string
  // Yazi kenar boslugu (padding)
  text_padding_top: number
  text_padding_bottom: number
  // Yazi fade in/out efekti
  text_fade_enabled: boolean
  text_fade_interval: number
  text_fade_duration: number
  text_fade_in_time: number
  text_fade_out_time: number
  countdown_enabled: boolean
  countdown_position: string
  status: string
  progress: number
  eta_seconds: number | null
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string | null
}

export interface TranscodeJobCreate {
  movie_content_id: number
  transcode_profile_id: number
  server_id?: number | null
  overlay_text?: string | null
  text_position?: string
  text_size?: number
  text_color?: string
  text_bg_enabled?: boolean
  text_bg_color?: string
  // Yazi kenar boslugu (padding)
  text_padding_top?: number
  text_padding_bottom?: number
  // Yazi fade in/out efekti
  text_fade_enabled?: boolean
  text_fade_interval?: number
  text_fade_duration?: number
  text_fade_in_time?: number
  text_fade_out_time?: number
  countdown_enabled?: boolean
  countdown_position?: string
}

export interface JobProgress {
  id: number
  status: string
  progress: number
  eta_seconds: number | null
}

export const transcodeJobApi = {
  async list(): Promise<TranscodeJob[]> {
    const r = await api.get<TranscodeJob[]>('/transcode-jobs')
    return r.data
  },
  async get(id: number): Promise<TranscodeJob> {
    const r = await api.get<TranscodeJob>(`/transcode-jobs/${id}`)
    return r.data
  },
  async create(payload: TranscodeJobCreate): Promise<TranscodeJob> {
    const r = await api.post<TranscodeJob>('/transcode-jobs', payload)
    return r.data
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/transcode-jobs/${id}`)
  },
  async start(id: number): Promise<TranscodeJob> {
    const r = await api.post<TranscodeJob>(`/transcode-jobs/${id}/start`)
    return r.data
  },
  async stop(id: number): Promise<TranscodeJob> {
    const r = await api.post<TranscodeJob>(`/transcode-jobs/${id}/stop`)
    return r.data
  },
  async preview(id: number): Promise<{ job_id: number; preview_path: string }> {
    const r = await api.post(`/transcode-jobs/${id}/preview`)
    return r.data
  },
  async startQueue(): Promise<{ started: boolean; message?: string; job_id?: number }> {
    const r = await api.post('/transcode-jobs/start-queue')
    return r.data
  },
  async clear(): Promise<{ cleared: number }> {
    const r = await api.post('/transcode-jobs/clear')
    return r.data
  },
  async clearByStatus(statusFilter: string): Promise<{ cleared: number }> {
    const r = await api.post(`/transcode-jobs/clear?status=${encodeURIComponent(statusFilter)}`)
    return r.data
  },
  async clearSelected(ids: number[]): Promise<{ cleared: number }> {
    const r = await api.post('/transcode-jobs/clear-selected', { ids })
    return r.data
  },
  async progress(id: number): Promise<JobProgress> {
    const r = await api.get<JobProgress>(`/transcode-jobs/progress/${id}`)
    return r.data
  },
  async previewFileBlob(id: number): Promise<string> {
    const r = await api.get(`/transcode-jobs/${id}/preview-file`, { responseType: 'blob' })
    return URL.createObjectURL(r.data)
  },
}
