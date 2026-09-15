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

/**
 * What a tenant's own sign-in page knows about it before anybody has signed in.
 *
 * Its name and its colours, so the page wears the right brand from the first paint rather
 * than flashing the platform's default and then correcting itself. The demo accounts come
 * from that tenant's own database and are empty unless the deployment says it is a demo.
 */
export interface WorkspaceSummary {
  slug: string
  name: string
  nameAr: string
  branding: { primaryColor: string; secondaryColor: string; accentColor: string; logoUrl: string | null; logoText: string }
}

export interface TenantFront {
  slug: string
  name: string
  nameAr: string
  branding: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    logoUrl: string | null
    logoText: string
  }
  locale: 'en' | 'ar'
  secondaryLocale: 'en' | 'ar'
  demoLogins: { label: string; email: string; password: string; role: Role }[]
}

export const authApi = {
  logout: () => unwrap<{ ok: boolean }>(http.post('/auth/logout', {})),
  /** `tenant` is the handle the per-tenant page was reached at; without one the directory decides. */
  login: (email: string, password: string, tenant?: string) =>
    unwrap<{ token: string; user: Me }>(http.post('/auth/login', { email, password, ...(tenant ? { tenant } : {}) })),
  tenantFront: (slug: string) => unwrap<TenantFront>(http.get(`/public/tenants/${slug}`)),
  /**
   * The workspaces to choose between at the platform's own front door.
   *
   * Empty on a real deployment: being able to ask a server for a list of every company using
   * it is enumeration, which the per-handle endpoint already refuses. A demonstration says so
   * in its configuration and gets a list to click.
   */
  workspaces: () => unwrap<WorkspaceSummary[]>(http.get('/public/workspaces')),
  me: () => unwrap<Me>(http.get('/auth/me')),
  invitation: (token: string) => unwrap<Invitation>(http.get(`/auth/invitation/${token}`)),
  acceptInvitation: (token: string, password: string, confirmPassword: string) =>
    unwrap<{ token: string; user: Me }>(http.post(`/auth/invitation/${token}`, { password, confirmPassword })),
}
