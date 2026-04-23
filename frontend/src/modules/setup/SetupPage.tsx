import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { authService } from '../../services/auth'

interface FormData {
  username: string
  email: string
  password: string
  password_confirm: string
}

interface Props {
  onComplete: () => void
}

export default function SetupPage({ onComplete }: Props) {
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>()
  const password = watch('password')

  const onSubmit = async (data: FormData) => {
    setServerError('')
    try {
      await authService.createInitialAdmin(data)
      setSuccess(true)
      setTimeout(() => onComplete(), 1500)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setServerError(e.response?.data?.detail || 'Bir hata olustu.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f0f2f5] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500">
            <svg className="h-9 w-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">VOD Manager</h1>
          <p className="mt-1 text-sm text-slate-500">Ilk kurulum - sistem yonetici hesabi olustur</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          {success ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-medium text-emerald-600">Admin hesabi olusturuldu!</p>
              <p className="mt-1 text-sm text-slate-500">Giris sayfasina yonlendiriliyorsunuz...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {[
                { name: 'username' as const, label: 'Kullanici Adi', type: 'text', placeholder: 'admin', rules: { required: 'Zorunludur', minLength: { value: 3, message: 'En az 3 karakter' } } },
                { name: 'email' as const, label: 'E-posta', type: 'email', placeholder: 'admin@example.com', rules: { required: 'Zorunludur', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Gecerli e-posta girin' } } },
                { name: 'password' as const, label: 'Sifre', type: 'password', placeholder: 'En az 8 karakter', rules: { required: 'Zorunludur', minLength: { value: 8, message: 'En az 8 karakter' } } },
                { name: 'password_confirm' as const, label: 'Sifre Tekrar', type: 'password', placeholder: 'Sifreyi tekrar girin', rules: { required: 'Zorunludur', validate: (value: string) => value === password || 'Sifreler eslesmiyor' } },
              ].map((field) => (
                <div key={field.name}>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">{field.label}</label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    autoComplete={field.type === 'password' ? 'new-password' : field.name}
                    className={`w-full rounded-xl border bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 ${errors[field.name] ? 'border-rose-400' : 'border-slate-300'}`}
                    {...register(field.name, field.rules)}
                  />
                  {errors[field.name] && <p className="mt-1 text-xs text-rose-500">{errors[field.name]?.message}</p>}
                </div>
              ))}

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
                {isSubmitting ? 'Olusturuluyor...' : 'Admin Hesabi Olustur'}
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">Bu ekran yalnizca bir kez gosterilebilir.</p>
      </div>
    </div>
  )
}