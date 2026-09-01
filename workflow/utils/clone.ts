import type { BookingSnapshot, OperationResult, WorkflowContext } from '../shared/types.js'

export function cloneBooking(booking: BookingSnapshot): BookingSnapshot {
  return {
    ...booking,
    bags: booking.bags.map((b) => ({ ...b })),
    session: { ...booking.session },
    reservation: booking.reservation ? { ...booking.reservation } : null,
    custody: booking.custody.map((c) => ({ ...c })),
    verifications: booking.verifications.map((v) => ({ ...v })),
    metadata: { ...booking.metadata },
  }
}

export function beginOperation(ctx: WorkflowContext): OperationResult {
  return { errors: [], booking: cloneBooking(ctx.booking), assetIntents: [], audits: [] }
}

export function unknownTransition(ctx: WorkflowContext, transitionCode: string): OperationResult {
  return {
    errors: [`Unknown transition code: ${transitionCode}`],
    booking: cloneBooking(ctx.booking),
    assetIntents: [],
    audits: [],
  }
}
