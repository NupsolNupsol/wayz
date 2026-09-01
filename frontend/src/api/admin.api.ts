import { http, unwrap } from './client'
import type { EngineKind, Role } from './types'

export interface TenantOverview {
  tenant: {
    _id: string
    name: string
    legalName: string
    crNumber: string
    vatNumber: string
    currency: string
    vatRate: number
    enabledEngines: EngineKind[]
    branding: Record<string, string>
    company: Record<string, string>
  }
  estate: {
    sites: number
    stations: number
    kiosks: number
    assetTypes: number
    units: number
    inUse: number
    available: number
    outOfService: number
    utilisationPct: number
  }
  people: { total: number; active: number; byRole: Record<Role, number> }
  operations: {
    live: number
    overdue: number
    bookings30d: number
    customers: number
    openIncidents: number
    openTills: number
    reconciling: number
    deliveries: number
    deliveriesOpen: number
  }
  money: {
    today: number
    last30Days: number
    refunded30Days: number
    cash30Days: number
    card30Days: number
    expectedInTills: number
  }
  byEngine: { engineKind: EngineKind; units: number; inUse: number; enabled: boolean }[]
  sites: {
    _id: string
    name: string
    city: string
    venueType: string
    active: boolean
    stations: number
    kiosks: number
    units: number
    inUse: number
    staff: number
    live: number
    revenue30d: number
  }[]
}

export interface TenantPerson {
  _id: string
  fullName: string
  email: string
  role: Role
  phone: string
  active: boolean
  stationId: string
  stationName: string
  kioskId: string | null
  kioskName: string | null
  lastLoginAt: string | null
  onShift: boolean
  shiftStatus: string | null
  bookingsHandled: number
}

export interface TenantAuditRow {
  _id: string
  action: string
  entity: string
  entityId: string
  reason: string | null
  detail: string | null
  actorId: string
  actorName: string
  at: string
}

export interface IsolationReport {
  tenantId: string
  collections: { name: string; count: number }[]
}

export interface CompanyPatch {
  name?: string
  legalName?: string
  crNumber?: string
  vatNumber?: string
  currency?: string
  vatRate?: number
  enabledEngines?: EngineKind[]
  company?: Record<string, string>
  branding?: Record<string, string>
}

export const adminApi = {
  overview: () => unwrap<TenantOverview>(http.get('/admin/overview')),
  people: () => unwrap<TenantPerson[]>(http.get('/admin/people')),
  audit: () => unwrap<TenantAuditRow[]>(http.get('/admin/audit')),
  isolation: () => unwrap<IsolationReport>(http.get('/admin/isolation')),
  updateCompany: (patch: CompanyPatch) => unwrap<Record<string, unknown>>(http.patch('/admin/company', patch)),
}
