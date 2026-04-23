import { create } from 'zustand'
import { UserMe } from '../services/auth'

interface AuthState {
  user: UserMe | null
  isAuthenticated: boolean
  setUser: (user: UserMe | null) => void
  setAuthenticated: (val: boolean) => void
  logout: () => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setAuthenticated: (val) => set({ isAuthenticated: val }),

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false })
  },

  clearAuth: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false })
  },
}))
