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

export interface TenantRules {
  rental: RentalRules
  penalties: PenaltyRule[]
  engineKinds: EngineKind[]
  defaults: { rental: RentalRules; penalties: PenaltyRule[] }
}

export interface RulesPatch {
  rental?: Partial<Omit<RentalRules, 'timers'>> & { timers?: Partial<Record<EngineKind, TimerRule>> }
  penalties?: PenaltyRule[]
}

export const rulesApi = {
  read: () => unwrap<TenantRules>(http.get('/admin/rules')),
  update: (patch: RulesPatch) => unwrap<TenantRules>(http.patch('/admin/rules', patch)),
}
