import api from '../../../utils/api'

export interface TranscodeProfile {
  id: number
  name: string
  logo_path: string | null
  logo_url: string | null
  logo_width: number | null
  logo_height: number | null
  logo_position: string
  logo_opacity: number
  logo_margin_x: number
  logo_margin_y: number
  video_codec: string
  video_bitrate: string | null
  video_maxrate: string | null
  video_bufsize: string | null
  video_crf: number | null
  video_width: number | null
  video_height: number | null
  video_fps: number | null
  video_profile: string | null
  video_level: string | null
  video_preset: string | null
  video_tune: string | null
  video_pixel_format: string
  video_gop_size: number | null
  video_b_frames: number | null
  video_reference_frames: number | null
  deinterlace: boolean
  deinterlace_mode: string
  scaling_algorithm: string
  sc_threshold: number
  audio_codec: string
  audio_bitrate: string | null
  audio_sample_rate: number | null
  audio_channels: number | null
  audio_volume: number
  audio_normalization: boolean
  async_audio_sync: number | null
  audio_map: string
  audio_map_channel: number | null
  audio_normalize: boolean
  output_format: string
  output_type: string
  container_format: string
  muxer_flags: string | null
  segment_duration: number | null
  movflags_faststart: boolean
  map_metadata: boolean
  vsync_mode: string
  avoid_negative_ts: string
  fflags_mode: string
  thread_queue_size: number
  hardware_accel: string | null
  hwaccel_type: string | null
  extra_ffmpeg_args: string | null
  x264_params: string | null
  is_default: boolean
  hidden_category_id: number | null
  created_at: string
  updated_at: string | null
}

export type TranscodeProfileCreate = Omit<TranscodeProfile, 'id' | 'logo_path' | 'logo_url' | 'hidden_category_id' | 'created_at' | 'updated_at'>
export type TranscodeProfileUpdate = Partial<TranscodeProfileCreate>

export const transcodeApi = {
  async list(): Promise<TranscodeProfile[]> {
    const r = await api.get<TranscodeProfile[]>('/transcode-profiles')
    return r.data
  },
  async get(id: number): Promise<TranscodeProfile> {
    const r = await api.get<TranscodeProfile>(`/transcode-profiles/${id}`)
    return r.data
  },
  async create(payload: TranscodeProfileCreate): Promise<TranscodeProfile> {
    const r = await api.post<TranscodeProfile>('/transcode-profiles', payload)
    return r.data
  },
  async update(id: number, payload: TranscodeProfileUpdate): Promise<TranscodeProfile> {
    const r = await api.put<TranscodeProfile>(`/transcode-profiles/${id}`, payload)
    return r.data
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/transcode-profiles/${id}`)
  },
  async uploadLogo(id: number, file: File): Promise<TranscodeProfile> {
    const form = new FormData()
    form.append('file', file)
    const r = await api.post<TranscodeProfile>(`/transcode-profiles/${id}/logo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return r.data
  },
}
