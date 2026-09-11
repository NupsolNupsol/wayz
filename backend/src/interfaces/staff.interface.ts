import type { EngineKind, Role } from '../domain/types.js'

export interface StaffInput {
  fullName: string
  email: string
  role: Role
  stationId: string
  kioskId?: string | null
  /** The locker hall they answer for. Required of a mobility agent, and of nobody else. */
  gateId?: string | null
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
  /** Marks this desk as an exit gate customers collect their bags from. */
  isExitGate?: boolean
}

/** A gate: a place at a station that holds lockers. It runs no activity, so it names none. */
export interface GateInput {
  stationId: string
  name: string
  code?: string
  location?: string
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
