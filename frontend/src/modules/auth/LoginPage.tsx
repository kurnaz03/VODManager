import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { authService } from '../../services/auth'
import { useAuthStore } from '../../store/authStore'
import { useBrandingStore } from '../../store/brandingStore'

interface FormData {
  username: string
  password: string
}

interface Props {
  onSuccess: () => void
}

export default function LoginPage({ onSuccess }: Props) {
  const [serverError, setServerError] = useState('')
  const { setUser } = useAuthStore()
  const theme = useBrandingStore((state) => state.theme)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>()

  const onSubmit = async (data: FormData) => {
    setServerError('')
    try {
      await authService.login(data.username, data.password)
      const me = await authService.getMe()
      setUser(me)
      onSuccess()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setServerError(e.response?.data?.detail || 'Giris basarisiz.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f2f5] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500">
            {theme.logo_url ? (
              <img src={theme.logo_url} alt={theme.panel_name} className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <svg className="h-9 w-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{theme.panel_name}</h1>
          <p className="mt-1 text-sm text-slate-500">Yonetim paneline giris yapin</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Kullanici Adi</label>
              <input
                type="text"
                autoFocus
                autoComplete="username"
                placeholder="Kullanici adinizi girin"
                className={`w-full rounded-xl border bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 ${errors.username ? 'border-rose-400' : 'border-slate-300'}`}
                {...register('username', { required: 'Kullanici adi zorunludur' })}
              />
              {errors.username && <p className="mt-1 text-xs text-rose-500">{errors.username.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Sifre</label>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Sifrenizi girin"
                className={`w-full rounded-xl border bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 ${errors.password ? 'border-rose-400' : 'border-slate-300'}`}
                {...register('password', { required: 'Sifre zorunludur' })}
              />
              {errors.password && <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p>}
            </div>

            {serverError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-sm text-rose-600">{serverError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-blue-500 py-3 font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              {isSubmitting ? 'Giris yapiliyor...' : 'Giris Yap'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}