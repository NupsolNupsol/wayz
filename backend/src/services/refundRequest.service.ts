import { Booking, RefundRequest, User, type RefundRequestStatus } from '../models/index.js'
import { recordAudit } from './audit.service.js'
import { raise } from './notification.service.js'
import { bookingRefundPosition, refundBooking } from './till.service.js'
import { ApiError } from '../utils/ApiError.js'
import { round2 } from '../utils/helpers.js'
import { formatId, nextSequence, pad } from './counter.service.js'
import { canWorkEngine, kioskFilter } from '../domain/access.js'
import type { Role } from '../domain/types.js'
import type { Scope } from '../interfaces/index.js'

export const REFUND_APPROVERS: Role[] = ['MANAGER', 'PROJECT_MANAGER', 'TENANT_ADMIN']

export const canApproveRefund = (role: Role): boolean => REFUND_APPROVERS.includes(role)

async function nameOf(userId: string): Promise<string> {
  const user = await User.findById(userId, { fullName: 1 }).lean()
  return user?.fullName ?? userId
}

export async function requestRefund(scope: Scope, bookingId: string, input: { amount?: number; reason: string }) {
  const reason = input.reason?.trim() ?? ''
  if (reason.length < 3) throw ApiError.badRequest('A refund needs a reason.')

  const booking = await Booking.findOne({ _id: bookingId, tenantId: scope.tenantId, stationId: scope.stationId })
  if (!booking) throw ApiError.notFound('Booking not found.')
  if (!canWorkEngine(scope, booking.engineKind)) throw ApiError.notFound('Booking not found.')
  const kiosk = kioskFilter(scope)
  if (kiosk !== undefined && booking.kioskId !== kiosk) throw ApiError.notFound('Booking not found.')

  const position = await bookingRefundPosition(scope.tenantId, scope.stationId, booking)
  if (position.paid <= 0) throw ApiError.unprocessable('Nothing has been paid on this booking yet.')
  if (position.refundable <= 0) throw ApiError.unprocessable('This booking has already been refunded in full.')

  const amount = round2(input.amount ?? position.refundable)
  if (!(amount > 0)) throw ApiError.badRequest('Enter an amount greater than zero.')
  if (amount > position.refundable) {
    throw ApiError.unprocessable(`Only ${position.refundable.toFixed(2)} is left to refund on this booking.`)
  }

  const pending = await RefundRequest.findOne({ tenantId: scope.tenantId, bookingId, status: 'PENDING' }).lean()
  if (pending) throw ApiError.unprocessable(`${pending.ref} is already waiting for approval on this booking.`)

  const actorName = await nameOf(scope.agentId)

  if (canApproveRefund(scope.role)) {
    const result = await refundBooking(scope, booking, { amount, reason }, actorName)
    return { approved: true as const, request: null, ...result }
  }

  const seq = await nextSequence('refundRequest')
  const request = await RefundRequest.create({
    _id: formatId('refundRequest', seq),
    ref: `RFR-${pad(seq)}`,
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    kioskId: booking.kioskId,
    bookingId: booking._id,
    bookingRef: booking.ref,
    engineKind: booking.engineKind,
    customerName: booking.customerName,
    amount,
    reason,
    status: 'PENDING',
    requestedBy: scope.agentId,
    requestedByName: actorName,
  })

  await raise({
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    kioskId: booking.kioskId,
    engineKind: booking.engineKind,
    title: 'Refund waiting for approval',
    body: `${request.ref}: ${actorName} asks to return ${amount} on ${booking.ref} — ${reason}`,
    level: 'warning',
    audience: REFUND_APPROVERS,
    link: '/refund-requests',
  })

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'REFUND_REQUESTED',
    entity: 'Booking',
    entityId: booking._id,
    detail: `${request.ref} · ${amount}`,
    reason,
  })

  return { approved: false as const, request: request.toObject(), refunded: 0, refundable: position.refundable }
}

export async function pendingRefundRequest(tenantId: string, bookingId: string) {
  const row = await RefundRequest.findOne(
    { tenantId, bookingId, status: 'PENDING' },
    { ref: 1, amount: 1, reason: 1, requestedByName: 1, createdAt: 1 },
  ).lean()
  if (!row) return null
  return {
    ref: row.ref,
    amount: row.amount,
    reason: row.reason,
    requestedByName: row.requestedByName,
    at: row.createdAt,
  }
}

export interface RefundRequestFilter {
  status?: RefundRequestStatus
}

export async function listRefundRequests(scope: Scope, filter: RefundRequestFilter = {}) {
  const q: Record<string, unknown> = { tenantId: scope.tenantId }
  if (filter.status) q.status = filter.status

  if (!canApproveRefund(scope.role)) q.requestedBy = scope.agentId

  const rows = await RefundRequest.find(q).sort({ createdAt: -1 }).limit(300).lean()
  return {
    canApprove: canApproveRefund(scope.role),
    rows: rows.filter((r) => canWorkEngine(scope, r.engineKind)),
    pendingTotal: round2(rows.filter((r) => r.status === 'PENDING').reduce((sum, r) => sum + r.amount, 0)),
  }
}

export async function reviewRefundRequest(
  scope: Scope,
  id: string,
  decision: { approve: boolean; note?: string },
) {
  if (!canApproveRefund(scope.role)) throw ApiError.forbidden('Only a manager, the project manager or the CEO may release a refund.')

  const request = await RefundRequest.findOne({ _id: id, tenantId: scope.tenantId })
  if (!request) throw ApiError.notFound('Refund request not found.')
  if (request.status !== 'PENDING') throw ApiError.badRequest(`${request.ref} has already been ${request.status.toLowerCase()}.`)
  if (!canWorkEngine(scope, request.engineKind)) throw ApiError.notFound('Refund request not found.')
  if (request.requestedBy === scope.agentId) throw ApiError.forbidden('Someone else has to release a refund you asked for.')
  if (!decision.approve && !decision.note?.trim()) throw ApiError.badRequest('Say why it is being refused.')

  const reviewerName = await nameOf(scope.agentId)

  if (decision.approve) {
    const booking = await Booking.findOne({ _id: request.bookingId, tenantId: scope.tenantId })
    if (!booking) throw ApiError.notFound('Booking not found.')

    const deskScope: Scope = { ...scope, stationId: request.stationId, kioskId: request.kioskId }
    const result = await refundBooking(
      deskScope,
      booking,
      { amount: request.amount, reason: request.reason },
      `${request.requestedByName} (released by ${reviewerName})`,
    )
    request.paymentIds = result.paymentIds ?? []
  }

  request.status = decision.approve ? 'APPROVED' : 'REJECTED'
  request.reviewedBy = scope.agentId
  request.reviewedByName = reviewerName
  request.reviewedAt = new Date()
  request.reviewNote = decision.note?.trim() ?? ''
  await request.save()

  await raise({
    tenantId: scope.tenantId,
    stationId: request.stationId,
    kioskId: request.kioskId,
    engineKind: request.engineKind,
    title: decision.approve ? 'Refund released' : 'Refund refused',
    body: `${request.ref} on ${request.bookingRef}: ${reviewerName} ${decision.approve ? 'released' : 'refused'} ${request.amount}.${request.reviewNote ? ` ${request.reviewNote}` : ''}`,
    level: decision.approve ? 'success' : 'warning',
    link: `/bookings/${request.bookingId}`,
  })

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: decision.approve ? 'REFUND_APPROVED' : 'REFUND_REJECTED',
    entity: 'Booking',
    entityId: request.bookingId,
    detail: `${request.ref} · ${request.amount}`,
    reason: request.reviewNote || request.reason,
  })

  return request.toObject()
}
