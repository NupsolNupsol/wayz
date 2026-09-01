import type { WorkflowContext } from '../shared/types.js'
import { RESERVATION_ACTIVE, UNIT_AVAILABLE, UNIT_RESERVED } from '../shared/status.js'

export function requireReason(ctx: WorkflowContext): string[] {
  const reason = typeof ctx.payload.reason === 'string' ? ctx.payload.reason.trim() : ''
  return reason ? [] : ['A reason is required for this action.']
}

export function requireFlag(ctx: WorkflowContext, flag: string, message: string): string[] {
  return ctx.payload[flag] ? [] : [message]
}

export function requireIdentityVerified(ctx: WorkflowContext, purpose = 'RETRIEVAL'): string[] {
  const fresh = ctx.booking.verifications.find(
    (v) => v.purpose === purpose && v.status === 'VERIFIED' && new Date(v.expiresAt).getTime() > ctx.now.getTime(),
  )
  if (fresh) return []
  const stale = ctx.booking.verifications.some((v) => v.purpose === purpose && v.status === 'VERIFIED')
  return [
    stale
      ? 'The identity check has expired — verify the customer again before releasing their property.'
      : 'Verify the customer’s identity first (WhatsApp code, email code, ID document, or supervisor override).',
  ]
}

export function requireTargetUnitAvailable(ctx: WorkflowContext): string[] {
  const id = typeof ctx.payload.unitId === 'string' ? ctx.payload.unitId : ''
  if (!id) return ['A target unit must be specified.']
  const unit = ctx.assets.byId[id]
  if (!unit) return ['Target unit not found.']
  if (unit.status !== UNIT_AVAILABLE) return [`Unit ${unit.identifier} is not available (${unit.status}).`]
  return []
}

export function requireHeldUnitUsable(ctx: WorkflowContext): string[] {
  const expected = ctx.booking.reservation?.assetUnitId ?? ctx.booking.assetUnitId
  if (!expected) return ['No unit is reserved for this booking.']

  const reservationStatus = ctx.booking.reservation?.status
  if (reservationStatus && reservationStatus !== RESERVATION_ACTIVE) {
    return [`The reservation is no longer active (${reservationStatus}) — reserve again.`]
  }

  const unit = ctx.assets.current ?? ctx.assets.byId[expected]
  if (!unit) return ['The reserved unit no longer exists.']
  if (unit.currentBookingId && unit.currentBookingId !== ctx.booking._id) {
    return [`Unit ${unit.identifier} is held by another booking — reassign before continuing.`]
  }
  if (![UNIT_RESERVED, UNIT_AVAILABLE].includes(unit.status)) {
    return [`Unit ${unit.identifier} cannot receive bags (${unit.status}).`]
  }
  return []
}

export function requireAvailableUnit(ctx: WorkflowContext): string[] {
  const assetTypeId = ctx.booking.metadata?.assetTypeId as string | undefined
  if (!assetTypeId) return []
  return ctx.assets.available.length > 0 ? [] : ['No available unit to assign.']
}

export function requirePositiveDuration(ctx: WorkflowContext): string[] {
  const requested = ctx.payload.durationMin ?? ctx.booking.session.requestedDurationMin
  const value = Number(requested)
  return Number.isFinite(value) && value > 0 ? [] : ['A positive duration is required to start the timer.']
}
