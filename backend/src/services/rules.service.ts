import { Tenant } from '../models/index.js'
import {
  DEFAULT_PENALTY_SCHEDULE,
  DEFAULT_RENTAL_RULES,
  DEFAULT_DISCOUNT_REASONS,
  DEFAULT_SHIFT_WINDOW,
  resolveDiscountReasons,
  resolvePenaltySchedule,
  resolveRentalRules,
  resolveShiftWindow,
  type DiscountReason,
  type PenaltyRule,
  type RentalRules,
  type ShiftWindow,
  DEFAULT_TRANSFER_RULES,
  DEFAULT_PROCUREMENT_RULES,
  resolveTransferRules,
  resolveProcurementRules,
  type TransferRules,
  type ProcurementRules,
} from '../domain/rules.js'

export interface TenantRules {
  rental: RentalRules
  penalties: PenaltyRule[]
  shiftWindow: ShiftWindow
  discountReasons: DiscountReason[]

  /** Who raises and who approves an animal transfer — §7.4 and §11.2 disagree, so it is set. */
  transfers: TransferRules
  /** Who approves a purchase order, and above what value — §8.2 never states the boundary. */
  procurement: ProcurementRules
}

export async function tenantRules(tenantId: string): Promise<TenantRules> {
  const tenant = await Tenant.findById(tenantId, {
    rentalRules: 1,
    penaltySchedule: 1,
    shiftWindow: 1,
    discountReasons: 1,
    transferRules: 1,
    procurementRules: 1,
  }).lean()
  return {
    rental: resolveRentalRules(tenant?.rentalRules),
    penalties: resolvePenaltySchedule(tenant?.penaltySchedule),
    shiftWindow: resolveShiftWindow(tenant?.shiftWindow),
    discountReasons: resolveDiscountReasons(tenant?.discountReasons),
    transfers: resolveTransferRules(tenant?.transferRules),
    procurement: resolveProcurementRules(tenant?.procurementRules),
  }
}

export const DEFAULT_TENANT_RULES: TenantRules = {
  rental: DEFAULT_RENTAL_RULES,
  penalties: DEFAULT_PENALTY_SCHEDULE,
  shiftWindow: DEFAULT_SHIFT_WINDOW,
  discountReasons: DEFAULT_DISCOUNT_REASONS,
  transfers: DEFAULT_TRANSFER_RULES,
  procurement: DEFAULT_PROCUREMENT_RULES,
}
