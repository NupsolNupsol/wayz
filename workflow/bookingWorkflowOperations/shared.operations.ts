import type { AssetUnitSnapshot, BookingSnapshot, OperationResult, WorkflowContext } from '../shared/types.js'
import {
  ACTIVE,
  AGENT_HOLDER,
  BAG_DELIVERED,
  BAG_STORED,
  CUSTOMER,
  LOCKER,
  RESERVATION_ACTIVE,
  RESERVATION_CONSUMED,
  RESERVATION_RELEASED,
  UNIT_AVAILABLE,
  UNIT_MAINTENANCE,
  UNIT_OCCUPIED,
  UNIT_RESERVED,
  type CustodyHolder,
} from '../shared/status.js'

const RESERVATION_MINUTES = 15

export function addCustody(
  result: OperationResult,
  ctx: WorkflowContext,
  move: { from: CustodyHolder; to: CustodyHolder; note?: string; bagIndex?: number },
): void {
  result.booking.custody.push({
    from: move.from,
    to: move.to,
    at: ctx.now.toISOString(),
    note: move.note,
    bagIndex: move.bagIndex,
  })
}

export function chooseUnit(ctx: WorkflowContext): AssetUnitSnapshot | null {
  const requested = typeof ctx.payload.unitId === 'string' ? ctx.payload.unitId : ''
  if (requested) return ctx.assets.byId[requested] ?? null
  return ctx.assets.available[0] ?? null
}

export function reserveUnit(result: OperationResult, ctx: WorkflowContext): void {
  const unit = chooseUnit(ctx)
  if (!unit) {
    result.errors.push('No available unit to reserve.')
    return
  }
  result.booking.reservation = {
    assetUnitId: unit._id,
    expiresAt: new Date(ctx.now.getTime() + RESERVATION_MINUTES * 60_000).toISOString(),
    status: RESERVATION_ACTIVE,
  }
  result.booking.assetUnitId = unit._id
  result.booking.session.assetUnitId = unit._id
  result.assetIntents.push({
    op: 'SET_STATUS',
    unitId: unit._id,
    status: UNIT_RESERVED,
    currentBookingId: result.booking._id,
  })
  result.audits.push({ action: 'RESERVE_UNIT', detail: unit._id })
}

export function reassignUnit(result: OperationResult, ctx: WorkflowContext): void {
  const previous = ctx.booking.reservation?.assetUnitId ?? ctx.booking.assetUnitId
  const next = chooseUnit(ctx)
  if (!next) {
    result.errors.push('No replacement unit available.')
    return
  }
  const reason = String(ctx.payload.reason ?? '')

  if (previous) {
    result.assetIntents.push({
      op: 'SET_STATUS',
      unitId: previous,
      status: UNIT_MAINTENANCE,
      currentBookingId: null,
      note: `Reassigned away: ${reason}`,
    })
  }
  result.assetIntents.push({
    op: 'SET_STATUS',
    unitId: next._id,
    status: UNIT_RESERVED,
    currentBookingId: result.booking._id,
  })

  result.booking.reservation = {
    assetUnitId: next._id,
    expiresAt: new Date(ctx.now.getTime() + RESERVATION_MINUTES * 60_000).toISOString(),
    status: RESERVATION_ACTIVE,
  }
  result.booking.assetUnitId = next._id
  result.booking.session.assetUnitId = next._id
  result.audits.push({ action: 'REASSIGN_UNIT', reason, detail: `${previous ?? '—'} → ${next._id}` })
}

export function startTimer(result: OperationResult, ctx: WorkflowContext): void {
  const requested = ctx.payload.durationMin ?? ctx.booking.session.requestedDurationMin
  const durationMin = Number(requested)
  if (!Number.isFinite(durationMin) || durationMin <= 0) {
    result.errors.push('A positive duration is required to start the timer.')
    return
  }
  const expectedEnd = new Date(ctx.now.getTime() + durationMin * 60_000)
  result.booking.session.requestedDurationMin = durationMin
  result.booking.session.startedAt = ctx.now.toISOString()
  result.booking.session.expectedEndAt = expectedEnd.toISOString()
  result.audits.push({ action: 'START_TIMER', detail: `${durationMin} min → ${expectedEnd.toISOString()}` })
}

export function storeBagsAndOccupy(result: OperationResult, ctx: WorkflowContext): void {
  const unitId = ctx.booking.reservation?.assetUnitId ?? ctx.booking.assetUnitId
  if (!unitId) {
    result.errors.push('No unit to store into.')
    return
  }
  result.booking.bags = result.booking.bags.map((b) => ({ ...b, status: BAG_STORED, assignedUnitId: unitId }))
  if (result.booking.reservation) result.booking.reservation.status = RESERVATION_CONSUMED
  result.booking.assetUnitId = unitId
  result.booking.session.assetUnitId = unitId
  result.assetIntents.push({
    op: 'SET_STATUS',
    unitId,
    status: UNIT_OCCUPIED,
    currentBookingId: result.booking._id,
  })
  result.audits.push({ action: 'STORE_BAGS', detail: `${result.booking.bags.length} bag(s) → ${unitId}` })
}

export function assignAndOccupy(result: OperationResult, ctx: WorkflowContext): void {
  const assetTypeId = ctx.booking.metadata?.assetTypeId as string | undefined
  if (!assetTypeId) return

  const unit = ctx.assets.current ?? chooseUnit(ctx)
  if (!unit) {
    result.errors.push('No available unit to assign.')
    return
  }
  result.booking.assetUnitId = unit._id
  result.booking.session.assetUnitId = unit._id
  result.assetIntents.push({
    op: 'SET_STATUS',
    unitId: unit._id,
    status: UNIT_OCCUPIED,
    currentBookingId: result.booking._id,
  })
}

export function markUnit(result: OperationResult, status: typeof UNIT_OCCUPIED | 'RETRIEVAL_PENDING'): void {
  if (!result.booking.assetUnitId) return
  result.assetIntents.push({ op: 'SET_STATUS', unitId: result.booking.assetUnitId, status })
}

export function completeAndRelease(result: OperationResult, ctx: WorkflowContext): void {
  result.booking.session.chargeableEndedAt = ctx.now.toISOString()
  result.booking.bags = result.booking.bags.map((b) => ({ ...b, status: BAG_DELIVERED, assignedUnitId: null }))
  if (result.booking.assetUnitId) {
    result.assetIntents.push({
      op: 'SET_STATUS',
      unitId: result.booking.assetUnitId,
      status: UNIT_AVAILABLE,
      currentBookingId: null,
    })
  }
}

export function cancelRelease(result: OperationResult): void {
  if (result.booking.assetUnitId) {
    result.assetIntents.push({
      op: 'SET_STATUS',
      unitId: result.booking.assetUnitId,
      status: UNIT_AVAILABLE,
      currentBookingId: null,
    })
  }
  if (result.booking.reservation) result.booking.reservation.status = RESERVATION_RELEASED
}

export function consumeVerification(result: OperationResult, ctx: WorkflowContext, purpose = 'RETRIEVAL'): void {
  const fresh = result.booking.verifications.find(
    (v) => v.purpose === purpose && v.status === 'VERIFIED' && new Date(v.expiresAt).getTime() > ctx.now.getTime(),
  )
  if (!fresh) return
  fresh.status = 'CONSUMED'
  fresh.consumedAt = ctx.now.toISOString()
  result.audits.push({ action: 'CONSUME_VERIFICATION', detail: `${purpose} · ${fresh.method}`, reason: fresh.reason ?? undefined })
}

export function setStatus(result: OperationResult, status: BookingSnapshot['status']): void {
  result.booking.status = status
  result.booking.session.status = status
}

export function handOverToCustomer(result: OperationResult, ctx: WorkflowContext, note: string): void {
  assignAndOccupy(result, ctx)
  startTimer(result, ctx)
  addCustody(result, ctx, { from: AGENT_HOLDER, to: CUSTOMER, note })
  setStatus(result, ACTIVE)
}

export { LOCKER, AGENT_HOLDER, CUSTOMER }
