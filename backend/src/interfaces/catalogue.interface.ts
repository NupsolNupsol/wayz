import type { BillingModel, DurationUnit, EngineKind, IncidentType } from '../domain/types.js'

export interface ProductInput {
  name: string
  engineKind: EngineKind
  category?: string
  basePrice: number
  overtimeHourlyRate?: number | null
  depositRequired?: number
  assetTypeId?: string | null
  billingModel: BillingModel
  durationUnit?: DurationUnit
  emoji?: string
  active?: boolean
}

export interface SettingsPatch {
  name?: string
  legalName?: string
  crNumber?: string
  vatNumber?: string
  vatRate?: number
  currency?: string
  company?: Record<string, string>
  settings?: Record<string, unknown>
}

export interface CreateIncidentInput {
  type: IncidentType
  description: string
  bookingId?: string
  engineKind?: EngineKind
}
