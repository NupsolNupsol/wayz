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
    ANAAM: FROM_PAYMENT,
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
