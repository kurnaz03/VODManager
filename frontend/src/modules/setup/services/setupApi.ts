import api from '@/utils/api'

export interface SetupStatus {
  initial_admin_created: boolean
  setup_enabled: boolean
}

export interface InitialAdminPayload {
  username: string
  email: string
  password: string
  password_confirm: string
}

export const setupApi = {
  getStatus: async (): Promise<SetupStatus> => {
    const { data } = await api.get('/setup/status')
    return data
  },

  createInitialAdmin: async (payload: InitialAdminPayload): Promise<{ message: string; username: string }> => {
    const { data } = await api.post('/setup/initial-admin', payload)
    return data
  },
}
