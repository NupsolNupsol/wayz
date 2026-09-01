import type { Role } from '../domain/types.js'
import type { DeliveryOrigin, TransitionPayload } from '../domain/workflow.js'

export interface CreateDeliveryInput {
  bookingId: string
  address: string
  notes?: string
  contactPhone?: string
  origin: DeliveryOrigin
  fee?: number
}

export interface DeliveryActor {
  tenantId: string
  userId: string
  role: Role
  siteId?: string
  stationId?: string
}

export interface ApplyDeliveryParams {
  actor: DeliveryActor
  id: string
  code: string
  payload?: TransitionPayload
  now?: Date
}
