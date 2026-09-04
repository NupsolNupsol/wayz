import { http, unwrap } from './client'
import type { BillingModel, EngineKind, Incident, Role, Shift } from './types'

export interface ManagerOverview {
  revenue: { today: number; last7Days: number; last30Days: number }
  transactionsToday: number
  activeSessions: number
  overdueSessions: number
  openIncidents: number
  pendingVariances: number
  staffCount: number
  estate: {
    totalUnits: number
    inUse: number
    available: number
    outOfService: number
    utilisationPct: number
    byStatus: Record<string, number>
  }
  byEngine: { engineKind: EngineKind; revenue: number; payments: number }[]
  byStation: { stationId: string; name: string; bookings: number; active: number }[]
  revenueTrend: { date: string; total: number; count: number }[]
}

export interface ManagerLiveSession {
  _id: string
  ref: string
  engineKind: EngineKind
  status: string
  productName: string
  customerName: string
  stationName: string
  expectedEndAt: string | null
  remainingMs: number | null
  isOvertime: boolean
  penaltyAmount: number
}

export interface ManagerRental extends ManagerLiveSession {
  customerId: string
  customerPhone: string
  agentName: string
  bagCount: number
  startedAt: string | null
  createdAt: string
}

export interface ManagerRentalDetail {
  booking: Record<string, unknown> & { ref: string; overtime: { penaltyAmount: number; phase: string } }
  order: { ref: string; lines: { name: string; quantity: number; unitPrice: number }[]; total: number; subtotal: number; vat: number; status: string } | null
  payments: { _id: string; amount: number; method: string; kind: string; status: string; createdAt: string }[]
  stationName: string
  agentName: string
}

export interface ManagerCustomer {
  _id: string
  name: string
  phone: string
  email: string
  createdAt: string
  bookings: number
  completed: number
  lastBookingAt: string | null
}

export interface ManagerCustomerDetail {
  customer: ManagerCustomer
  lifetimeValue: number
  bookings: { _id: string; ref: string; engineKind: EngineKind; status: string; productName: string; createdAt: string; penaltyAmount: number }[]
}

export interface OrgKiosk {
  _id: string
  name: string
  code?: string
  location?: string
  stationId: string
  engineKind: EngineKind
  active: boolean
  total: number
  available: number
  inUse: number
}
export interface OrgStation {
  _id: string
  name: string
  code?: string
  siteId: string
  engineKinds: EngineKind[]
  openingTime?: string
  closingTime?: string
  contactPhone?: string
  active: boolean
  total: number
  available: number
  inUse: number
  activeSessions: number
  kiosks: OrgKiosk[]
}
export interface OrgSite {
  _id: string
  name: string
  city: string
  venueType?: string
  address?: string
  contactPhone?: string
  active: boolean
  stations: OrgStation[]
}
export interface OrgTree {
  venueTypes: string[]
  sites: OrgSite[]
}

export interface StaffInvitation {
  emailed: boolean
  deliveredTo: string
  expiresAt: string
  reason?: string
  link?: string
}

export interface ManagerStaff {
  _id: string
  fullName: string
  email: string
  role: Role
  phone: string
  active: boolean
  setUp: boolean
  invitePending: boolean
  inviteExpiresAt: string | null
  invitation?: StaffInvitation
  stationId: string
  stationName: string
  kioskId: string | null
  kioskName: string | null
  engineKinds: EngineKind[]
  reportsTo: string | null
  reportsToName: string | null
  lastLoginAt: string | null
  hasOpenShift: boolean
  shiftStatus: string | null
  bookingsHandled: number
}

export interface PricingProduct {
  _id: string
  name: string
  engineKind: EngineKind
  category: string
  basePrice: number
  hourlyPrice: number | null
  tourPrice: number | null
  tourMinutes: number | null
  overtimeHourlyRate: number | null
  effectiveOvertimeRate: number
  depositRequired: number
  assetTypeId: string | null
  assetTypeName: string | null
  billingModel: BillingModel
  durationUnit: string | null
  emoji: string
  active: boolean
  bookingsAllTime: number
}
export interface PricingCatalogue {
  currency: string
  vatRate: number
  billingModels: BillingModel[]
  durationUnits: string[]
  assetTypes: { _id: string; name: string; kind: string; engineKind: EngineKind }[]
  products: PricingProduct[]
}

export interface TenantSettings {
  _id: string
  name: string
  legalName: string
  crNumber: string
  vatNumber: string
  vatRate: number
  currency: string
  enabledEngines: EngineKind[]
  company: { address?: string; city?: string; country?: string; phone?: string; email?: string; website?: string }
  settings: {
    timezone?: string
    locale?: string
    gracePeriodMin?: number
    overtimeBlockMinutes?: number
    expiryWarningMinutes?: number
    paymentMethods?: string[]
    verificationChannels?: string[]
  }
}

export interface ManagerPayment {
  _id: string
  amount: number
  method: string
  kind: string
  status: string
  createdAt: string
  bookingId: string | null
  bookingRef: string | null
  customerName: string | null
  engineKind: EngineKind | null
  stationName: string
}

export interface RevenueReport {
  from: string
  to: string
  gross: number
  overtimeRevenue: number
  transactions: number
  daily: { date: string; total: number; count: number }[]
  byMethod: { method: string; total: number; count: number }[]
  byKind: { kind: string; total: number; count: number }[]
  byEngine: { engineKind: EngineKind; total: number }[]
  byStation: { stationId: string; name: string; total: number }[]
}
export interface OccupancyReport {
  byAssetType: { assetTypeId: string; name: string; kind: string; total: number; inUse: number; outOfService: number; utilisationPct: number }[]
  byStation: { stationId: string; name: string; total: number; inUse: number; utilisationPct: number }[]
}
export interface RentalsReport {
  from: string
  to: string
  total: number
  completed: number
  cancelled: number
  live: number
  overdueNow: number
  penaltyAccruing: number
  averageDurationMin: number
  byStatus: { status: string; count: number }[]
  byEngine: { engineKind: EngineKind; count: number }[]
}

export interface ActivityEntry {
  _id: string
  action: string
  entity: string
  entityId: string
  actorId: string
  reason: string | null
  detail: string | null
  at: string
}

export interface ManagerIncident extends Incident {
  stationName: string
}
export interface ManagerShift extends Shift {
  stationName: string
  kioskName: string | null
  agentName: string
}

const qs = (r?: { from?: string; to?: string }) =>
  r?.from || r?.to ? `?${new URLSearchParams(Object.entries(r).filter(([, v]) => v) as [string, string][])}` : ''

export const managerApi = {
  overview: () => unwrap<ManagerOverview>(http.get('/manager/overview')),
  liveSessions: () => unwrap<ManagerLiveSession[]>(http.get('/manager/live-sessions')),

  rentals: (scope: 'active' | 'completed' | 'expired' | 'all' = 'all') =>
    unwrap<ManagerRental[]>(http.get(`/manager/rentals?scope=${scope}`)),
  rentalDetail: (id: string) => unwrap<ManagerRentalDetail>(http.get(`/manager/rentals/${id}`)),

  customers: () => unwrap<ManagerCustomer[]>(http.get('/manager/customers')),
  customerDetail: (id: string) => unwrap<ManagerCustomerDetail>(http.get(`/manager/customers/${id}`)),

  org: () => unwrap<OrgTree>(http.get('/manager/org')),
  createSite: (d: Record<string, unknown>) => unwrap<OrgSite>(http.post('/manager/org/sites', d)),
  updateSite: (id: string, d: Record<string, unknown>) => unwrap<OrgSite>(http.patch(`/manager/org/sites/${id}`, d)),
  createStation: (d: Record<string, unknown>) => unwrap<OrgStation>(http.post('/manager/org/stations', d)),
  updateStation: (id: string, d: Record<string, unknown>) => unwrap<OrgStation>(http.patch(`/manager/org/stations/${id}`, d)),
  createKiosk: (d: Record<string, unknown>) => unwrap<OrgKiosk>(http.post('/manager/org/kiosks', d)),
  updateKiosk: (id: string, d: Record<string, unknown>) => unwrap<OrgKiosk>(http.patch(`/manager/org/kiosks/${id}`, d)),
  removeKiosk: (id: string) => unwrap<{ removed: string; name: string }>(http.delete(`/manager/org/kiosks/${id}`)),

  provision: (d: { assetTypeId: string; stationId: string; kioskId?: string; count: number }) =>
    unwrap<{ created: number }>(http.post('/manager/estate/provision', d)),

  payments: () => unwrap<ManagerPayment[]>(http.get('/manager/payments')),
  incidents: () => unwrap<ManagerIncident[]>(http.get('/manager/incidents')),
  updateIncident: (id: string, status: string) => unwrap<Incident>(http.patch(`/manager/incidents/${id}`, { status })),
  shifts: () => unwrap<ManagerShift[]>(http.get('/manager/shifts')),
  shift: (id: string) => unwrap<ManagerShift>(http.get(`/manager/shifts/${id}`)),

  staff: () => unwrap<ManagerStaff[]>(http.get('/manager/staff')),
  createStaff: (d: Record<string, unknown>) => unwrap<ManagerStaff>(http.post('/manager/staff', d)),
  reinvite: (id: string) => unwrap<ManagerStaff>(http.post(`/manager/staff/${id}/invite`)),
  updateStaff: (id: string, d: Record<string, unknown>) => unwrap<ManagerStaff>(http.patch(`/manager/staff/${id}`, d)),
  resetPassword: (id: string, password: string) => unwrap<{ ok: boolean }>(http.post(`/manager/staff/${id}/password`, { password })),

  pricing: () => unwrap<PricingCatalogue>(http.get('/pricing')),
  createProduct: (d: Record<string, unknown>) => unwrap<PricingProduct>(http.post('/pricing/products', d)),
  updateProduct: (id: string, d: Record<string, unknown>) => unwrap<PricingProduct>(http.patch(`/pricing/products/${id}`, d)),

  settings: () => unwrap<TenantSettings>(http.get('/manager/settings')),
  updateSettings: (d: Record<string, unknown>) => unwrap<TenantSettings>(http.patch('/manager/settings', d)),

  reportRevenue: (r?: { from?: string; to?: string }) => unwrap<RevenueReport>(http.get(`/manager/reports/revenue${qs(r)}`)),
  reportOccupancy: () => unwrap<OccupancyReport>(http.get('/manager/reports/occupancy')),
  reportRentals: (r?: { from?: string; to?: string }) => unwrap<RentalsReport>(http.get(`/manager/reports/rentals${qs(r)}`)),

  activity: () => unwrap<ActivityEntry[]>(http.get('/manager/activity')),

  exportUrl: (kind: string, r?: { from?: string; to?: string }) => `/api/manager/reports/export/${kind}${qs(r)}`,
}
