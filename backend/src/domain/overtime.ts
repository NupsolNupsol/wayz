import { round2 } from '../utils/helpers.js'

export const DEFAULT_GRACE_MINUTES = 5

export const OVERTIME_BLOCK_MINUTES = 60

const MS_PER_MIN = 60_000

export type SessionPhase =
  | 'NOT_STARTED'
  | 'RUNNING'
  | 'GRACE'
  | 'OVERTIME'
  | 'ENDED'

export interface OvertimeSessionInput {
  startedAt?: Date | string | null
  expectedEndAt?: Date | string | null
  chargeableEndedAt?: Date | string | null
  gracePeriodMin?: number | null
  overtimeHourlyRate?: number | null
  overtimeBlockMin?: number | null
}

export interface OvertimeState {
  phase: SessionPhase
  evaluatedAt: string
  expectedEndAt: string | null
  graceEndsAt: string | null
  remainingMs: number | null
  graceRemainingMs: number | null
  overdueMs: number
  gracePeriodMin: number
  withinGrace: boolean
  isOvertime: boolean
  chargeableHours: number
  hourlyRate: number
  penaltyAmount: number
}

function toDate(value?: Date | string | null): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function computeOvertime(session: OvertimeSessionInput, now: Date = new Date()): OvertimeState {
  const startedAt = toDate(session.startedAt)
  const expectedEndAt = toDate(session.expectedEndAt)
  const chargeableEndedAt = toDate(session.chargeableEndedAt)
  const gracePeriodMin = session.gracePeriodMin ?? DEFAULT_GRACE_MINUTES
  const hourlyRate = session.overtimeHourlyRate ?? 0
  const blockMin = Math.max(1, session.overtimeBlockMin ?? OVERTIME_BLOCK_MINUTES)
  const blockMs = blockMin * MS_PER_MIN

  const evaluatedAt = chargeableEndedAt ?? now

  if (!startedAt || !expectedEndAt) {
    return {
      phase: 'NOT_STARTED',
      evaluatedAt: evaluatedAt.toISOString(),
      expectedEndAt: expectedEndAt?.toISOString() ?? null,
      graceEndsAt: null,
      remainingMs: null,
      graceRemainingMs: null,
      overdueMs: 0,
      gracePeriodMin,
      withinGrace: false,
      isOvertime: false,
      chargeableHours: 0,
      hourlyRate,
      penaltyAmount: 0,
    }
  }

  const graceEndsAt = new Date(expectedEndAt.getTime() + gracePeriodMin * MS_PER_MIN)
  const remainingMs = expectedEndAt.getTime() - evaluatedAt.getTime()
  const graceRemainingMs = graceEndsAt.getTime() - evaluatedAt.getTime()
  const overdueMs = Math.max(0, -remainingMs)

  const pastGrace = graceRemainingMs < 0
  const withinGrace = overdueMs > 0 && !pastGrace

  const chargeableHours = pastGrace ? Math.max(1, Math.ceil(overdueMs / blockMs)) : 0
  const penaltyAmount = round2(chargeableHours * hourlyRate)

  const phase: SessionPhase = chargeableEndedAt
    ? 'ENDED'
    : pastGrace
      ? 'OVERTIME'
      : withinGrace
        ? 'GRACE'
        : 'RUNNING'

  return {
    phase,
    evaluatedAt: evaluatedAt.toISOString(),
    expectedEndAt: expectedEndAt.toISOString(),
    graceEndsAt: graceEndsAt.toISOString(),
    remainingMs,
    graceRemainingMs,
    overdueMs,
    gracePeriodMin,
    withinGrace,
    isOvertime: pastGrace,
    chargeableHours,
    hourlyRate,
    penaltyAmount,
  }
}

export const OVERTIME_LINE_PRODUCT_ID = 'OVERTIME_PENALTY'

export function pendingOvertime(
  state: OvertimeState,
  lines: { productId: string; unitPrice: number; quantity?: number }[] = [],
): number {
  const already = lines
    .filter((l) => l.productId === OVERTIME_LINE_PRODUCT_ID)
    .reduce((sum, l) => sum + l.unitPrice * (l.quantity ?? 1), 0)
  return round2(Math.max(0, state.penaltyAmount - already))
}

export function describeOvertime(state: OvertimeState, currency = 'SAR'): string {
  if (!state.isOvertime) return 'No overtime penalty.'
  const blocks = state.chargeableHours
  return `${blocks} × 1h overtime block${blocks > 1 ? 's' : ''} @ ${state.hourlyRate} ${currency} = ${state.penaltyAmount} ${currency}`
}
