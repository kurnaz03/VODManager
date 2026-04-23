import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { authService } from '../../services/auth'
import { useAuthStore } from '../../store/authStore'
import SetupPage from '../../modules/setup/SetupPage'
import LoginPage from '../../modules/auth/LoginPage'
import DashboardPage from '../../modules/dashboard/DashboardPage'
import DashboardLayout from '../../components/layout/DashboardLayout'
import ServersPage from '../../modules/servers/pages/ServersPage'
import ServerDetailPage from '../../modules/servers/pages/ServerDetailPage'
import BouquetsPage from '../../modules/content/pages/BouquetsPage'
import BouquetDetailPage from '../../modules/content/pages/BouquetDetailPage'
import DownloadsPage from '../../modules/downloads/pages/DownloadsPage'
import SettingsPage from '../../modules/settings/pages/SettingsPage'
import MoviesPage from '../../modules/content/pages/MoviesPage'
import SeriesPage from '../../modules/content/pages/SeriesPage'
import TvPage from '../../modules/content/pages/TvPage'
import RadioPage from '../../modules/content/pages/RadioPage'
import AllCategoriesPage from '../../modules/content/pages/AllCategoriesPage'
import TranscodeProfilesPage from '../../modules/transcode/pages/TranscodeProfilesPage'
import TranscodeJobsPage from '../../modules/transcode/pages/TranscodeJobsPage'
import PlaylistPage from '../../modules/playlist/pages/PlaylistPage'
import UsersPage from '../../modules/users/pages/UsersPage'
import AdminPage from '../../modules/admin/pages/AdminPage'
import VpnClientsPage from '../../modules/vpn/pages/VpnClientsPage'

type AppStatus = 'loading' | 'setup' | 'login' | 'dashboard'

function AuthRoute({ isAuthenticated, children }: { status?: AppStatus; isAuthenticated: boolean; children: React.ReactNode }) {
  if (isAuthenticated) return <DashboardLayout>{children}</DashboardLayout>
  return <Navigate to="/login" replace />
}

function AppRouter() {
  const [status, setStatus] = useState<AppStatus>('loading')
  const { isAuthenticated, setUser } = useAuthStore()

  useEffect(() => {
    async function bootstrap() {
      try {
        const setup = await authService.getSetupStatus()
        if (!setup.initial_admin_created) {
          setStatus('setup')
          return
        }
        if (!authService.isAuthenticated()) {
          setStatus('login')
          return
        }
        try {
          const me = await authService.getMe()
          setUser(me)
          setStatus('dashboard')
        } catch {
          setStatus('login')
        }
      } catch {
        setStatus('login')
      }
    }
    bootstrap()
  }, [setUser])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f2f5]">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-lg font-medium text-slate-600 shadow-sm">
          Yukleniyor...
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/setup"
          element={
            status === 'setup'
              ? <SetupPage onComplete={() => setStatus('login')} />
              : <Navigate to="/" replace />
          }
        />
        <Route
          path="/login"
          element={
            isAuthenticated
              ? <Navigate to="/dashboard" replace />
              : <LoginPage onSuccess={async () => {
                  const me = await authService.getMe()
                  setUser(me)
                  setStatus('dashboard')
                }}
                />
          }
        />
        <Route path="/dashboard" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><DashboardPage /></AuthRoute>} />
        <Route path="/servers" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><ServersPage /></AuthRoute>} />
        <Route path="/servers/:id" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><ServerDetailPage /></AuthRoute>} />

        {/* Content Management */}
        <Route path="/downloads" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><DownloadsPage /></AuthRoute>} />
        <Route path="/movies" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><MoviesPage /></AuthRoute>} />
        <Route path="/series" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><SeriesPage /></AuthRoute>} />
        <Route path="/tv" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><TvPage /></AuthRoute>} />
        <Route path="/radio" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><RadioPage /></AuthRoute>} />
        <Route path="/categories" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><AllCategoriesPage /></AuthRoute>} />

        {/* Legacy category routes */}
        <Route path="/categories/movies" element={<Navigate to="/categories" replace />} />
        <Route path="/categories/series" element={<Navigate to="/categories" replace />} />
        <Route path="/categories/tv" element={<Navigate to="/categories" replace />} />
        <Route path="/categories/radio" element={<Navigate to="/categories" replace />} />

        {/* Bouquets */}
        <Route path="/bouquets" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><BouquetsPage /></AuthRoute>} />
        <Route path="/bouquets/:id" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><BouquetDetailPage /></AuthRoute>} />

        <Route path="/users" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><UsersPage /></AuthRoute>} />
        <Route path="/admin-users" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><AdminPage /></AuthRoute>} />
        <Route path="/transcode-profiles" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><TranscodeProfilesPage /></AuthRoute>} />
        <Route path="/transcode" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><TranscodeJobsPage /></AuthRoute>} />
        <Route path="/playlists" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><PlaylistPage /></AuthRoute>} />
        <Route path="/settings" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><SettingsPage /></AuthRoute>} />
        <Route path="/vpn-clients" element={<AuthRoute status={status} isAuthenticated={isAuthenticated}><VpnClientsPage /></AuthRoute>} />
        <Route
          path="*"
          element={
            status === 'setup'
              ? <Navigate to="/setup" replace />
              : isAuthenticated
                ? <Navigate to="/dashboard" replace />
                : <Navigate to="/login" replace />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
