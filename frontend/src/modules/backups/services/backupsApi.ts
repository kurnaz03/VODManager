import api from '../../../utils/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed' | 'restoring'
export type BackupType = 'manual' | 'auto' | 'pre_restore'

export interface Backup {
  id: string
  filename: string
  file_size_bytes: number | null
  backup_type: BackupType
  status: BackupStatus
  task_id: string | null
  progress_percent: number
  error_message: string | null
  created_by: number | null
  created_at: string
  completed_at: string | null
}

export interface BackupListResponse {
  backups: Backup[]
  total: number
}

export interface MaintenanceStatus {
  maintenance_mode: boolean
}

// ── API ───────────────────────────────────────────────────────────────────────

export const backupsApi = {
  async list(): Promise<BackupListResponse> {
    const r = await api.get<BackupListResponse>('/backups')
    return r.data
  },

  async get(id: string): Promise<Backup> {
    const r = await api.get<Backup>(`/backups/${id}`)
    return r.data
  },

  async create(): Promise<Backup> {
    const r = await api.post<Backup>('/backups')
    return r.data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/backups/${id}`)
  },

  async restore(id: string): Promise<Backup> {
    const r = await api.post<Backup>(`/backups/${id}/restore`, { confirm: true })
    return r.data
  },

  async downloadBlob(id: string, filename: string): Promise<void> {
    const r = await api.get(`/backups/${id}/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(r.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  async getMaintenanceStatus(): Promise<MaintenanceStatus> {
    const r = await api.get<MaintenanceStatus>('/backups/maintenance-status')
    return r.data
  },
}
