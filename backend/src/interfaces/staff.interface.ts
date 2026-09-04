import type { EngineKind, Role } from '../domain/types.js'

export interface StaffInput {
  fullName: string
  email: string
  role: Role
  stationId: string
  kioskId?: string | null
  engineKinds?: EngineKind[]
  reportsTo?: string | null
  phone?: string
}

export interface InviteResult {
  emailed: boolean
  deliveredTo: string
  expiresAt: Date
  reason?: string
  link?: string
}

export interface SiteInput {
  name: string
  city: string
  venueType?: string
  address?: string
  contactPhone?: string
}

export interface StationInput {
  siteId: string
  name: string
  code?: string
  engineKinds?: EngineKind[]
  openingTime?: string
  closingTime?: string
  contactPhone?: string
}

export interface KioskInput {
  stationId: string
  name: string
  code?: string
  location?: string
  engineKind: EngineKind
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
