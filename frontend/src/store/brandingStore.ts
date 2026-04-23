import { create } from 'zustand'
import { settingsApi, ThemeSettings } from '../modules/settings/services/settingsApi'

const defaultTheme: ThemeSettings = {
  panel_name: 'VOD Manager',
  logo_url: null,
  primary_color: '#3B82F6',
  sidebar_color: '#0F172A',
  accent_color: '#14B8A6',
}

function applyTheme(theme: ThemeSettings) {
  document.documentElement.style.setProperty('--vm-primary', theme.primary_color)
  document.documentElement.style.setProperty('--vm-primary-soft', `${theme.primary_color}1A`)
  document.documentElement.style.setProperty('--vm-sidebar', theme.sidebar_color)
  document.documentElement.style.setProperty('--vm-accent', theme.accent_color)
  document.title = theme.panel_name
}

interface BrandingState {
  theme: ThemeSettings
  isLoaded: boolean
  loadTheme: () => Promise<void>
  setTheme: (theme: ThemeSettings) => void
  resetTheme: () => void
}

export const useBrandingStore = create<BrandingState>((set) => ({
  theme: defaultTheme,
  isLoaded: false,
  loadTheme: async () => {
    try {
      const theme = await settingsApi.getTheme()
      applyTheme(theme)
      set({ theme, isLoaded: true })
    } catch {
      applyTheme(defaultTheme)
      set({ theme: defaultTheme, isLoaded: true })
    }
  },
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme, isLoaded: true })
  },
  resetTheme: () => {
    applyTheme(defaultTheme)
    set({ theme: defaultTheme, isLoaded: true })
  },
}))

export const defaultBrandingTheme = defaultTheme