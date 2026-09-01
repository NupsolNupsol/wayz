import type { OvertimeState } from '../domain/overtime.js'

export interface PublicBagView {
  index: number
  description: string
  status: string
}

export type PublicOvertimeView = Pick<
  OvertimeState,
  | 'phase'
  | 'remainingMs'
  | 'graceRemainingMs'
  | 'overdueMs'
  | 'gracePeriodMin'
  | 'withinGrace'
  | 'isOvertime'
  | 'chargeableHours'
  | 'hourlyRate'
  | 'penaltyAmount'
>

export interface PublicTrackingView {
  trackingToken: string
  ref: string
  status: string
  productName: string
  brandName: string
  currency: string
  bags: PublicBagView[]
  bagCount: number
  startedAt: string | null
  expectedEndAt: string | null
  graceEndsAt: string | null
  requestedDurationMin: number
  overtime: PublicOvertimeView
}
