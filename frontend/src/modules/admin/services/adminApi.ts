import api from '../../../services/api'

export interface AdminUser {
  id: number
  username: string
  email: string
  status: string
  roles: string[]
  created_at: string
  last_login_at: string | null
}

export interface AdminUserCreate {
  username: string
  email: string
  password: string
  role: string
  status: string
}

export interface AdminUserUpdate {
  username?: string
  email?: string
  status?: string
  role?: string
}

export interface ChangePasswordRequest {
  old_password: string
  new_password: string
  new_password_confirm: string
}

export const adminApi = {
  listUsers: (): Promise<AdminUser[]> =>
    api.get('/auth/users').then((r) => r.data),

  createUser: (data: AdminUserCreate): Promise<AdminUser> =>
    api.post('/auth/users', data).then((r) => r.data),

  updateUser: (id: number, data: AdminUserUpdate): Promise<AdminUser> =>
    api.put(`/auth/users/${id}`, data).then((r) => r.data),

  deleteUser: (id: number): Promise<void> =>
    api.delete(`/auth/users/${id}`).then((r) => r.data),

  changePassword: (data: ChangePasswordRequest): Promise<{ message: string }> =>
    api.put('/auth/change-password', data).then((r) => r.data),
}
