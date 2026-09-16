import { ENGINE_KINDS, type EngineKind } from './types.js'

export interface TimerRule {
  startsOn: 'FULFILMENT' | 'PAYMENT'
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

export type RentalRulesPatch = Partial<Omit<RentalRules, 'timers'>> & {
  timers?: Partial<Record<EngineKind, TimerRule>>
}

export interface ShiftWindow {
  startsAt: string
  endsAt: string
}

export const DEFAULT_SHIFT_WINDOW: ShiftWindow = { startsAt: '15:00', endsAt: '01:00' }

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export function resolveShiftWindow(stored?: Partial<ShiftWindow> | null): ShiftWindow {
  return {
    startsAt: HHMM.test(stored?.startsAt ?? '') ? (stored!.startsAt as string) : DEFAULT_SHIFT_WINDOW.startsAt,
    endsAt: HHMM.test(stored?.endsAt ?? '') ? (stored!.endsAt as string) : DEFAULT_SHIFT_WINDOW.endsAt,
  }
}

export function isValidClock(value: string): boolean {
  return HHMM.test(value)
}

export function shiftWindowMinutes(window: ShiftWindow): number {
  const [sh, sm] = window.startsAt.split(':').map(Number)
  const [eh, em] = window.endsAt.split(':').map(Number)
  const start = sh * 60 + sm
  const end = eh * 60 + em
  return end > start ? end - start : 24 * 60 - start + end
}

export interface PenaltyRule {
  code: string
  label: string
  amount: number | null
  engineKind: EngineKind | null
}

const FULFILMENT: TimerRule = { startsOn: 'FULFILMENT', startDelayMin: 0 }
const FROM_PAYMENT: TimerRule = { startsOn: 'PAYMENT', startDelayMin: 5 }

export const DEFAULT_RENTAL_RULES: RentalRules = {
  graceMin: 15,
  statedGraceMin: 10,
  overtimeBlockMin: 60,
  replacementBonusMin: 10,
  wrongStationPenalty: 25,
  timers: {
    SHOP_AND_DROP: FULFILMENT,
    MOBILITY: FROM_PAYMENT,
    LAGOON: FROM_PAYMENT,
    COTE_RESTAURANT: FULFILMENT,
    // Every animal experience is timed from the moment it is paid for, as the lagoon is: the
    // visitor is with the animal from then, whatever the package.
    HORSE_RIDING: FROM_PAYMENT,
    EQUESTRIAN_LESSON: FROM_PAYMENT,
    CAMEL_TOUR: FROM_PAYMENT,
    ANIMAL_CARE: FROM_PAYMENT,
    ANIMAL_FEEDING: FROM_PAYMENT,
    PHOTOGRAPHY: FROM_PAYMENT,
    GROUP_PACKAGE: FROM_PAYMENT,
  },
}

export const DEFAULT_PENALTY_SCHEDULE: PenaltyRule[] = [
  { code: 'STROLLER_DAMAGE', label: "Children's stroller damage", amount: 150, engineKind: 'MOBILITY' },
  { code: 'WHEELCHAIR_DAMAGE', label: 'Wheelchair / special needs cart damage', amount: 200, engineKind: 'MOBILITY' },
  { code: 'SCOOTER_DAMAGE', label: 'Electric scooter damage', amount: 500, engineKind: 'MOBILITY' },
  { code: 'CHILD_OPERATING', label: 'Child operating an electric scooter', amount: 500, engineKind: 'MOBILITY' },
  { code: 'NON_RENTER_OPERATING', label: 'Non-renter operating an electric scooter', amount: 200, engineKind: 'MOBILITY' },
  { code: 'LATE_RETURN_0100', label: 'Returning a vehicle after 01:00', amount: 200, engineKind: 'MOBILITY' },
  { code: 'TWO_ON_ONE_SEAT', label: 'Two people on a single-seat scooter', amount: 200, engineKind: 'MOBILITY' },
  { code: 'LOST_VEHICLE', label: 'Lost vehicle', amount: null, engineKind: 'MOBILITY' },
  { code: 'WRONG_STATION_RETURN', label: 'Returning a vehicle to a different station', amount: 25, engineKind: null },
]

const clampMin = (value: unknown, fallback: number): number => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function resolveRentalRules(stored?: RentalRulesPatch | null): RentalRules {
  const base = DEFAULT_RENTAL_RULES
  const timers = {} as Record<EngineKind, TimerRule>
  for (const engine of ENGINE_KINDS) {
    const kept = stored?.timers?.[engine]
    timers[engine] = {
      startsOn: kept?.startsOn === 'PAYMENT' ? 'PAYMENT' : kept?.startsOn === 'FULFILMENT' ? 'FULFILMENT' : base.timers[engine].startsOn,
      startDelayMin: clampMin(kept?.startDelayMin, base.timers[engine].startDelayMin),
    }
  }
  return {
    graceMin: clampMin(stored?.graceMin, base.graceMin),
    statedGraceMin: clampMin(stored?.statedGraceMin, base.statedGraceMin),
    overtimeBlockMin: Math.max(1, clampMin(stored?.overtimeBlockMin, base.overtimeBlockMin)),
    replacementBonusMin: clampMin(stored?.replacementBonusMin, base.replacementBonusMin),
    wrongStationPenalty: clampMin(stored?.wrongStationPenalty, base.wrongStationPenalty),
    timers,
  }
}

export function resolvePenaltySchedule(stored?: PenaltyRule[] | null): PenaltyRule[] {
  return stored?.length ? stored : DEFAULT_PENALTY_SCHEDULE
}

export function penaltyAmount(schedule: PenaltyRule[], code: string): number | null | undefined {
  return schedule.find((rule) => rule.code === code)?.amount
}

export interface DiscountReason {
  code: string
  label: string
  /** Optional: what the customer reads on the printed slip. Falls back to `label`. */
  labelAr?: string
  maxPercent: number
  needsApproval?: boolean
}

export const DEFAULT_DISCOUNT_REASONS: DiscountReason[] = [
  { code: 'EMPLOYEE', label: 'Employee', labelAr: 'موظف', maxPercent: 100 },
  { code: 'MANAGER', label: 'Manager decision', labelAr: 'قرار المدير', maxPercent: 100 },
  { code: 'VIP_SELA', label: 'VIP / SELA member', labelAr: 'عضو مميز / سلا', maxPercent: 100 },
  { code: 'SERVICE_RECOVERY', label: 'Something went wrong', labelAr: 'تعويض عن خلل في الخدمة', maxPercent: 50 },
  { code: 'PROMOTION', label: 'Promotion', labelAr: 'عرض ترويجي', maxPercent: 30 },
]

export function resolveDiscountReasons(stored?: Partial<DiscountReason>[] | null): DiscountReason[] {
  if (!Array.isArray(stored) || stored.length === 0) return DEFAULT_DISCOUNT_REASONS
  const clean = stored
    .filter((r) => typeof r?.code === 'string' && r.code.trim() && typeof r?.label === 'string' && r.label.trim())
    .map((r) => ({
      code: r.code!.trim().toUpperCase().slice(0, 40),
      label: r.label!.trim().slice(0, 80),
      labelAr: (r.labelAr ?? '').trim().slice(0, 80) || undefined,
      maxPercent: Math.min(100, Math.max(0, Number(r.maxPercent ?? 100))),
      needsApproval: !!r.needsApproval,
    }))
  return clean.length ? clean : DEFAULT_DISCOUNT_REASONS
}

/* ------------------------------------------------------------------------------------- */
/* Animal transfers — an unresolved requirement, kept in configuration                      */
/* ------------------------------------------------------------------------------------- */

/**
 * Who may approve an inter-location animal transfer.
 *
 * **The requirements contradict themselves here, and this is not a judgement call we should
 * make on the client's behalf.** Two sections of the WIQAR specification name four different
 * roles with no overlap:
 *
 * | Section | Says |
 * |---|---|
 * | §7.4 | *"Transfer must be approved by **Chief Accountant or Administrative Manager** before execution (for liability tracking)"* |
 * | §11.2 | *"Animal inter-location transfers require **Project Manager or CEO** approval; transport driver executes only after approval confirmed"* |
 *
 * So the approver list is configuration, not code. An organisation sets it; the workflow reads
 * it. Whichever way the client resolves it — either list, both, or something else — is a
 * settings change rather than a release.
 *
 * The default below follows **§7.4**, for two reasons worth stating so the choice can be
 * argued with: §7.4 is the section *about* transfers rather than a summary table, and it gives
 * a rationale ("for liability tracking") that §11.2 does not. That is a tie-break, not an
 * answer. See `docs/platform/11-WIQAR-ASSUMPTIONS.md`.
 */
export interface TransferRules {
  /** Roles that may raise a transfer order. §7.4: Project Manager or Supervisor. */
  requesters: string[]
  /** Roles that may approve one. See the note above — the specification contradicts itself. */
  approvers: string[]
  /**
   * Whether the person who raised a transfer may also approve it.
   *
   * Off by default. §7.4 approves transfers *"for liability tracking"*, which is defeated if
   * one person can do both — and under the §11.2 reading the Project Manager both raises and
   * approves, so without this the separation disappears the moment that list is chosen.
   *
   * Not stated either way in the specification: **ASSUMPTION**, and one switch to change.
   */
  selfApproval: boolean
}

export const DEFAULT_TRANSFER_RULES: TransferRules = {
  requesters: ['PROJECT_MANAGER', 'SUPERVISOR'],
  // §7.4. The §11.2 reading is ['PROJECT_MANAGER', 'TENANT_ADMIN'].
  approvers: ['ACCOUNTANT', 'HR'],
  selfApproval: false,
}

/** The transfer policy in force, falling back to the documented default. */
export function resolveTransferRules(stored?: Partial<TransferRules> | null): TransferRules {
  return {
    requesters: stored?.requesters?.length ? stored.requesters : DEFAULT_TRANSFER_RULES.requesters,
    approvers: stored?.approvers?.length ? stored.approvers : DEFAULT_TRANSFER_RULES.approvers,
    selfApproval: stored?.selfApproval ?? DEFAULT_TRANSFER_RULES.selfApproval,
  }
}

/* ------------------------------------------------------------------------------------- */
/* Procurement — §8.2                                                                       */
/* ------------------------------------------------------------------------------------- */

/**
 * Who approves a purchase order, and at what point it stops being routine.
 *
 * §8.2: *"PO requires approval by **Administrative Manager** for standard items; **CEO or
 * Project Manager** for high-value purchases."*
 *
 * That much is clear. What is **not** stated anywhere in the specification is what makes a
 * purchase "high-value" — no figure is given, and §4.1's prices are themselves TBD. Rather
 * than invent a number and bury it, the threshold is configuration with a documented default,
 * exactly as the transfer approvers are.
 *
 * `highValueThreshold` below is an **ASSUMPTION**: 5,000 SAR is a plausible line for a
 * seasonal operation of this size and has no authority beyond that. One setting to change.
 */
export interface ProcurementRules {
  /** §8.2 — Administrative Manager, which is the `HR` base role on this platform. */
  standardApprovers: string[]
  /** §8.2 — CEO or Project Manager. */
  highValueApprovers: string[]
  /** ASSUMPTION: the specification says "high-value" and never says what that is. */
  highValueThreshold: number
  /**
   * §8.2: *"Alert generated when any item falls below a configurable reorder point."*
   *
   * The specification says configurable and gives no default; §6.5 mentions 20% of par level
   * for visitor feed, which is the only figure offered anywhere and is used here.
   */
  reorderPointPct: number
  /**
   * Whether the person who raised a purchase order may also approve it.
   *
   * Off by default, and not stated in the specification — **ASSUMPTION**. §8.2 separates the
   * raiser (Purchasing Agent) from the approvers (Administrative Manager, CEO, Project
   * Manager) in every reading, so self-approval would only arise if somebody held both roles.
   */
  selfApproval: boolean
}

export const DEFAULT_PROCUREMENT_RULES: ProcurementRules = {
  standardApprovers: ['HR'],
  highValueApprovers: ['TENANT_ADMIN', 'PROJECT_MANAGER'],
  highValueThreshold: 5000,
  reorderPointPct: 20,
  selfApproval: false,
}

export function resolveProcurementRules(stored?: Partial<ProcurementRules> | null): ProcurementRules {
  return {
    standardApprovers: stored?.standardApprovers?.length
      ? stored.standardApprovers
      : DEFAULT_PROCUREMENT_RULES.standardApprovers,
    highValueApprovers: stored?.highValueApprovers?.length
      ? stored.highValueApprovers
      : DEFAULT_PROCUREMENT_RULES.highValueApprovers,
    highValueThreshold: stored?.highValueThreshold ?? DEFAULT_PROCUREMENT_RULES.highValueThreshold,
    reorderPointPct: stored?.reorderPointPct ?? DEFAULT_PROCUREMENT_RULES.reorderPointPct,
    selfApproval: stored?.selfApproval ?? DEFAULT_PROCUREMENT_RULES.selfApproval,
  }
}

/**
 * The categories §8.1 tracks stock in.
 *
 * Kept as a list rather than a free string so a purchase order can be reported on by category,
 * and so the veterinary rule in §8.2 has something reliable to key off.
 */
export const INVENTORY_CATEGORIES = [
  'ANIMAL_FEED',
  'VETERINARY_SUPPLIES',
  'RIDING_EQUIPMENT',
  'RETAIL_MERCHANDISE',
  'PHOTOGRAPHY_CONSUMABLES',
  'OPERATIONAL_SUPPLIES',
] as const
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number]
