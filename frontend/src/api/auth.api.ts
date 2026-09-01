import { http, unwrap } from './client'
import type { Me, Role } from './types'

export interface Invitation {
  email: string
  fullName: string
  role: Role
  roleLabel: string
  tenantName: string
  branding: Record<string, string> | null
  expiresAt: string
}

export const authApi = {
  login: (email: string, password: string) =>
    unwrap<{ token: string; user: Me }>(http.post('/auth/login', { email, password })),
  me: () => unwrap<Me>(http.get('/auth/me')),
  invitation: (token: string) => unwrap<Invitation>(http.get(`/auth/invitation/${token}`)),
  acceptInvitation: (token: string, password: string, confirmPassword: string) =>
    unwrap<{ token: string; user: Me }>(http.post(`/auth/invitation/${token}`, { password, confirmPassword })),
}
