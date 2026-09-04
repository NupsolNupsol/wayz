import type { EngineKind, Role } from '../domain/types.js'

export interface Scope {
  tenantId: string
  stationId: string
  agentId: string
  role: Role
  kioskId?: string | null
  engineKinds?: EngineKind[]
}

export interface KioskScope extends Scope {
  kioskId: string
}

export interface ManagerScope {
  tenantId: string
  userId: string
  role: Role
  engineKinds?: EngineKind[]
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
