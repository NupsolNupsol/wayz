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
  unitId?: string
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
  /** Free at the agent's own desk — the only ones it can reserve. */
  availableUnits: number
  /** Free at other desks in the station: cannot be reserved here, but worth telling the agent. */
  availableElsewhere: number
  fits: boolean
}

export interface PaymentSplit {
  method: PaymentMethod
  cardScheme?: CardScheme | null
  amount: number
  kind?: string
  /**
   * Who is paying this half. Left out, it is the customer on the booking; naming somebody else
   * records the sale as split between two people, and that person is confirmed like any other
   * before their money is taken.
   */
  payerId?: string
}
