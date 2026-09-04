import { Tenant } from '../models/index.js'
import {
  DEFAULT_PENALTY_SCHEDULE,
  DEFAULT_RENTAL_RULES,
  DEFAULT_SHIFT_WINDOW,
  resolvePenaltySchedule,
  resolveRentalRules,
  resolveShiftWindow,
  type PenaltyRule,
  type RentalRules,
  type ShiftWindow,
} from '../domain/rules.js'

export interface TenantRules {
  rental: RentalRules
  penalties: PenaltyRule[]
  shiftWindow: ShiftWindow
}

export async function tenantRules(tenantId: string): Promise<TenantRules> {
  const tenant = await Tenant.findById(tenantId, { rentalRules: 1, penaltySchedule: 1, shiftWindow: 1 }).lean()
  return {
    rental: resolveRentalRules(tenant?.rentalRules),
    penalties: resolvePenaltySchedule(tenant?.penaltySchedule),
    shiftWindow: resolveShiftWindow(tenant?.shiftWindow),
  }
}

export const DEFAULT_TENANT_RULES: TenantRules = {
  rental: DEFAULT_RENTAL_RULES,
  penalties: DEFAULT_PENALTY_SCHEDULE,
  shiftWindow: DEFAULT_SHIFT_WINDOW,
}
