import type { BookingHydrated } from '../models/booking.model.js'
import type { BagCategory, EngineKind, PaymentMethod, Role } from '../domain/types.js'
import type { CardScheme } from '../domain/commission.js'
import type { OperationResult, Transition, TransitionPayload } from '../domain/workflow.js'

export interface BagInput {
  category?: BagCategory
  description?: string
  dimensions?: { w: number; h: number; d: number }
  weight?: number
}

export type RateMode = 'HOURS' | 'TOURS'

export interface CreateBookingInput {
  customerId: string
  engineKind: EngineKind
  productId: string
  quantity?: number
  durationMin?: number
  rateMode?: RateMode
  tours?: number
  bags?: BagInput[]
  metadata?: Record<string, unknown>
}

export interface AvailableTransition {
  code: string
  label: string
  from: string
  target: string
  style?: { backgroundColor: string }
}

export interface ApplyTransitionParams {
  booking: BookingHydrated
  code: string
  payload?: TransitionPayload
  actor: { id: string; role: Role }
  tenantId: string
  stationId: string
  kioskId?: string | null
  now?: Date
}

export interface ApplyTransitionResult {
  booking: BookingHydrated
  audits: OperationResult['audits']
  transition: Transition
}

export interface SuggestBagInput {
  category?: BagCategory
  dimensions?: { w: number; h: number; d: number }
  weight?: number
}

export interface PackingSuggestion {
  productId: string
  productName: string
  assetTypeId: string
  assetTypeName: string
  capacityScore: number
  maxBagsPerCompartment: number | null
  numberOfCompartments: number
  availableUnits: number
  fits: boolean
}

export interface PaymentSplit {
  method: PaymentMethod
  cardScheme?: CardScheme | null
  amount: number
  kind?: string
}
