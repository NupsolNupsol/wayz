import { Booking } from '../models/index.js'
import { recordAudit } from './audit.service.js'
import { ApiError } from '../utils/ApiError.js'
import { env } from '../config/env.js'
import { canWorkEngine, kioskFilter } from '../domain/access.js'
import type { Scope } from '../interfaces/index.js'

export function isTimeTravelEnabled(): boolean {
  return env.DEMO_TIME_TRAVEL
}

function shift(value: Date | null | undefined, minutes: number): Date | null {
  if (!value) return null
  return new Date(new Date(value).getTime() - minutes * 60_000)
}

export async function ageBooking(scope: Scope, bookingId: string, minutes: number) {
  if (!isTimeTravelEnabled()) throw ApiError.notFound('Route not found.')

  const forward = Math.round(Number(minutes))
  if (!Number.isFinite(forward) || forward === 0) throw ApiError.badRequest('Say how many minutes to move.')
  if (Math.abs(forward) > 60 * 24 * 7) throw ApiError.badRequest('A week either way is as far as this goes.')

  const booking = await Booking.findOne({ _id: bookingId, tenantId: scope.tenantId })
  if (!booking) throw ApiError.notFound('Booking not found.')
  if (!canWorkEngine(scope, booking.engineKind)) throw ApiError.notFound('Booking not found.')
  const kiosk = kioskFilter(scope)
  if (kiosk !== undefined && booking.kioskId !== kiosk) throw ApiError.notFound('Booking not found.')

  if (!booking.session.startedAt) throw ApiError.unprocessable('That session has not started, so it has no clock to move.')

  booking.session.startedAt = shift(booking.session.startedAt, forward)
  booking.session.expectedEndAt = shift(booking.session.expectedEndAt, forward)
  booking.session.paidAt = shift(booking.session.paidAt, forward)
  booking.session.expiryWarningSentAt = null
  booking.markModified('session')
  await booking.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'DEV_CLOCK_MOVED',
    entity: 'Booking',
    entityId: booking._id,
    detail: `session aged by ${forward} min`,
    reason: 'Testing tool',
  })

  return {
    id: booking._id,
    ref: booking.ref,
    agedByMin: forward,
    startedAt: booking.session.startedAt,
    expectedEndAt: booking.session.expectedEndAt,
  }
}
