import type { EngineKind, Role } from '../domain/types.js'

export interface Scope {
  tenantId: string
  stationId: string
  agentId: string
  role: Role
  kioskId?: string | null
  /** Empty means "every activity". An agent is narrowed to the ones they were assigned. */
  engineKinds?: EngineKind[]
}

export interface KioskScope extends Scope {
  kioskId: string
}

export interface ManagerScope {
  tenantId: string
  userId: string
  role: Role
}

export interface AccountingScope {
  tenantId: string
  userId: string
}

export interface HrScope {
  tenantId: string
  userId: string
}

export interface CourierScope {
  tenantId: string
  stationId: string
  siteId: string
  userId: string
  role: Role
}
