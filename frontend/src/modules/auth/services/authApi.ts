import api from '@/utils/api'

export interface LoginPayload {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<TokenResponse> => {
    const { data } = await api.post('/auth/login', payload)
    return data
  },

  refresh: async (refresh_token: string): Promise<TokenResponse> => {
    const { data } = await api.post('/auth/refresh', { refresh_token })
    return data
  },

  logout: async (refresh_token: string): Promise<void> => {
    await api.post('/auth/logout', { refresh_token })
  },

  me: async () => {
    const { data } = await api.get('/auth/me')
    return data
  },
}
