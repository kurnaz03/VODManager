import api from '../utils/api'

export interface SetupStatus {
  initial_admin_created: boolean
  setup_enabled: boolean
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserMe {
  id: number
  username: string
  email: string
  status: string
  roles: string[]
  last_login_at: string | null
  created_at: string
}

export const authService = {
  async getSetupStatus(): Promise<SetupStatus> {
    const res = await api.get<SetupStatus>('/setup/status')
    return res.data
  },

  async createInitialAdmin(data: {
    username: string
    email: string
    password: string
    password_confirm: string
  }): Promise<{ message: string; username: string }> {
    const res = await api.post('/setup/initial-admin', data)
    return res.data
  },

  async login(username: string, password: string): Promise<TokenResponse> {
    const res = await api.post<TokenResponse>('/auth/login', { username, password })
    const { access_token, refresh_token } = res.data
    localStorage.setItem('access_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)
    return res.data
  },

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      await api.post('/auth/logout', { refresh_token: refreshToken }).catch(() => {})
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  },

  async getMe(): Promise<UserMe> {
    const res = await api.get<UserMe>('/auth/me')
    return res.data
  },

  async updateProfile(data: { username?: string; email?: string }): Promise<UserMe> {
    const res = await api.put<UserMe>('/auth/me', data)
    return res.data
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token')
  },
}
