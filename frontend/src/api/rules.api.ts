import { http, unwrap } from './client'
import type { EngineKind } from './types'

export type TimerStart = 'FULFILMENT' | 'PAYMENT'

export interface TimerRule {
  startsOn: TimerStart
  startDelayMin: number
}

export interface RentalRules {
  graceMin: number
  statedGraceMin: number
  overtimeBlockMin: number
  replacementBonusMin: number
  wrongStationPenalty: number
  timers: Record<EngineKind, TimerRule>
}

export interface PenaltyRule {
  code: string
  label: string
  amount: number | null
  engineKind: EngineKind | null
}

/** Why a desk may take money off a sale, and how far it may go. */
export interface DiscountReason {
  code: string
  label: string
  maxPercent: number
  needsApproval?: boolean
}

export interface TenantRules {
  rental: RentalRules
  penalties: PenaltyRule[]
  discountReasons: DiscountReason[]
  engineKinds: EngineKind[]
  defaults: { rental: RentalRules; penalties: PenaltyRule[]; discountReasons: DiscountReason[] }
}

export interface RulesPatch {
  discountReasons?: DiscountReason[]
  rental?: Partial<Omit<RentalRules, 'timers'>> & { timers?: Partial<Record<EngineKind, TimerRule>> }
  penalties?: PenaltyRule[]
}

export const rulesApi = {
  read: () => unwrap<TenantRules>(http.get('/admin/rules')),
  update: (patch: RulesPatch) => unwrap<TenantRules>(http.patch('/admin/rules', patch)),
}
