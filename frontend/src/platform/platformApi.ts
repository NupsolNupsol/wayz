import { platformHttp, unwrapPlatform, type PlatformAdmin } from './platformClient'

/** What the control plane knows about a tenant: everything except a byte of its data. */
export interface TenantBranding {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  logoUrl: string | null
  logoText: string
  faviconUrl: string | null
  fontFamily?: string
}

export interface TenantInvoiceIdentity {
  legalName: string
  legalNameAr: string
  crNumber: string
  vatNumber: string
  address: string
  addressAr: string
  phone: string
  email: string
  vatRate: number
}

export type TenantLifecycle = 'ACTIVE' | 'SUSPENDED' | 'PROVISIONING' | 'FAILED'

export interface ProvisioningStep {
  step: string
  status: 'PENDING' | 'DONE' | 'FAILED'
  at: string | null
  error: string | null
}

export interface PlatformTenant {
  id: string
  slug: string
  name: string
  nameAr: string
  dbName: string
  lifecycle: TenantLifecycle
  branding: TenantBranding
  invoice: TenantInvoiceIdentity
  currency: string
  timezone: string
  locale: 'en' | 'ar'
  secondaryLocale: 'en' | 'ar'
  capabilities: string[]
  enabledProfiles: string[]
  provisioning: {
    steps: ProvisioningStep[]
    done: number
    total: number
    lastError: string | null
    startedAt: string | null
    completedAt: string | null
  }
  suspendedReason: string | null
  /** Where this tenant's own staff sign in. The control plane links out to it, never through it. */
  loginPath: string
  createdAt: string
}

export interface CapabilityDef {
  key: string
  label: string
  labelAr: string
  blurb: string
  group: 'OPERATIONS' | 'DOMAIN' | 'BACK_OFFICE'
}

export interface ProfileDef {
  key: string
  label: string
  labelAr: string
  blurb: string
  role: string
  requires: string[]
  deskScoped?: boolean
}

export interface PlatformAuditRow {
  _id: string
  actorId: string
  actorEmail: string
  action: string
  tenantId: string | null
  detail: string
  /** The field the entries are actually written with. `createdAt` was never on these rows. */
  at: string
}

export interface TenantEstateRow {
  slug: string
  name: string
  lifecycle: TenantLifecycle
  dbName: string
  isSynthetic: boolean
  createdAt: string | null
  capabilities: string[]
  reachable: boolean
  /** null wherever the real figure could not be obtained. The screen omits it rather than inventing one. */
  storageBytes: number | null
  collections: number | null
  users: number | null
  sites: number | null
  stations: number | null
  provisioning: { done: number; total: number; failed: boolean }
}

export interface PlatformOverview {
  tenants: { total: number; byLifecycle: Record<string, number>; provisioningFailed: number }
  people: { platformAdmins: number; tenantUsers: number | null }
  estate: { databases: number; reachable: number; storageBytes: number | null }
  activity: { auditEntriesLast7Days: number; lastEventAt: string | null }
  newestTenants: { slug: string; name: string; lifecycle: TenantLifecycle; createdAt: string | null }[]
}

export interface HealthReport {
  api: { status: 'UP'; version: string; startedAt: string; uptimeSeconds: number; mode: string; nodeEnv: string }
  controlPlane: { status: 'UP' | 'DOWN'; database: string; latencyMs: number | null }
  tenantDatabases: { slug: string; dbName: string; status: 'UP' | 'DOWN'; latencyMs: number | null }[]
  provisioning: { failed: { slug: string; name: string; lastError: string | null }[] }
  checkedAt: string
}

export interface PlatformReports {
  growth: { month: string; created: number; cumulative: number }[]
  capabilityAdoption: { key: string; label: string; tenants: number }[]
  profileAdoption: { key: string; label: string; tenants: number }[]
  estate: TenantEstateRow[]
  auditByAction: { action: string; count: number }[]
}

export interface TenantStructure {
  sites: { _id: string; name: string; city?: string }[]
  stations: { _id: string; name: string; siteId: string }[]
  kiosks: { _id: string; name: string; stationId: string; engineKind?: string }[]
  gates: { _id: string; name: string; stationId: string; code?: string }[]
  admins: { _id: string; email: string; fullName: string; active: boolean; createdAt?: string; lastLoginAt?: string | null }[]
  staffCount: number
}

export interface PlatformAdminRow {
  _id: string
  email: string
  fullName: string
  active: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface AuditQuery {
  q?: string
  tenantId?: string
  action?: string
  since?: string
  limit?: number
}

export interface NewTenantInput {
  slug: string
  name: string
  nameAr?: string
  currency?: string
  timezone?: string
  locale?: 'en' | 'ar'
  secondaryLocale?: 'en' | 'ar'
  invoice?: Partial<TenantInvoiceIdentity>
  branding?: Partial<TenantBranding>
  capabilities?: string[]
  enabledProfiles?: string[]
  admin: { email: string; fullName: string; password: string }
}

export const platformApi = {
  signIn: (email: string, password: string) =>
    unwrapPlatform<{ token: string; admin: PlatformAdmin }>(
      platformHttp.post('/auth/login', { email, password }),
    ),
  me: () => unwrapPlatform<PlatformAdmin>(platformHttp.get('/auth/me')),

  vocabulary: () =>
    unwrapPlatform<{ capabilities: CapabilityDef[]; profiles: ProfileDef[] }>(platformHttp.get('/vocabulary')),

  tenants: () => unwrapPlatform<PlatformTenant[]>(platformHttp.get('/tenants')),
  tenant: (id: string) => unwrapPlatform<PlatformTenant>(platformHttp.get(`/tenants/${id}`)),
  create: (input: NewTenantInput) => unwrapPlatform<PlatformTenant>(platformHttp.post('/tenants', input)),
  update: (id: string, patch: Partial<NewTenantInput>) =>
    unwrapPlatform<PlatformTenant>(platformHttp.patch(`/tenants/${id}`, patch)),
  retryProvisioning: (id: string, admin?: NewTenantInput['admin']) =>
    unwrapPlatform<PlatformTenant>(platformHttp.post(`/tenants/${id}/provision`, admin ? { admin } : {})),
  setLifecycle: (id: string, lifecycle: 'ACTIVE' | 'SUSPENDED', reason?: string) =>
    unwrapPlatform<PlatformTenant>(platformHttp.post(`/tenants/${id}/lifecycle`, { lifecycle, reason })),

  /** Requires the tenant to be suspended and its handle typed back. Drops its database. */
  remove: (id: string, confirm: string) =>
    unwrapPlatform<{ removed: string; dbName: string }>(
      platformHttp.delete(`/tenants/${id}`, { data: { confirm } }),
    ),

  audit: (query: AuditQuery = {}) =>
    unwrapPlatform<{ rows: PlatformAuditRow[]; total: number; actions: string[] }>(
      platformHttp.get('/audit', { params: query }),
    ),

  /* The platform describing itself. Every figure is measured; none is generated. */
  overview: () => unwrapPlatform<PlatformOverview>(platformHttp.get('/overview')),
  health: () => unwrapPlatform<HealthReport>(platformHttp.get('/health')),
  reports: () => unwrapPlatform<PlatformReports>(platformHttp.get('/reports')),

  /** A tenant's estate and administrators, read live from its own database. Nothing is copied. */
  structure: (id: string) => unwrapPlatform<TenantStructure>(platformHttp.get(`/tenants/${id}/structure`)),

  admins: () => unwrapPlatform<PlatformAdminRow[]>(platformHttp.get('/admins')),
  createAdmin: (input: { email: string; fullName: string; password: string }) =>
    unwrapPlatform<PlatformAdminRow>(platformHttp.post('/admins', input)),
  setAdminActive: (id: string, active: boolean) =>
    unwrapPlatform<PlatformAdminRow>(platformHttp.post(`/admins/${id}/active`, { active })),
}
