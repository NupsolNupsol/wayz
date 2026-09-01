import { Booking, Tenant } from '../models/index.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { computeOvertime } from '../domain/overtime.js'
import type { PublicTrackingView } from '../interfaces/index.js'

export async function getPublicTracking(trackingToken: string): Promise<PublicTrackingView> {
  const booking = await Booking.findOne({ trackingToken }).lean()
  if (!booking) throw ApiError.notFound('Tracking link not found.')

  if (booking.status === 'DRAFT') throw ApiError.notFound('Tracking link not found.')

  const tenant = await Tenant.findById(booking.tenantId).lean()
  const o = computeOvertime(booking.session)

  return {
    trackingToken: booking.trackingToken ?? trackingToken,
    ref: booking.ref,
    status: booking.status,
    productName: booking.productName,
    brandName: tenant?.name ?? env.MAIL_FROM_NAME,
    currency: tenant?.currency ?? 'SAR',
    bags: booking.bags.map((b) => ({ index: b.index, description: b.description, status: b.status })),
    bagCount: booking.bags.length,
    startedAt: booking.session.startedAt ? new Date(booking.session.startedAt).toISOString() : null,
    expectedEndAt: o.expectedEndAt,
    graceEndsAt: o.graceEndsAt,
    requestedDurationMin: booking.session.requestedDurationMin,
    overtime: {
      phase: o.phase,
      remainingMs: o.remainingMs,
      graceRemainingMs: o.graceRemainingMs,
      overdueMs: o.overdueMs,
      gracePeriodMin: o.gracePeriodMin,
      withinGrace: o.withinGrace,
      isOvertime: o.isOvertime,
      chargeableHours: o.chargeableHours,
      hourlyRate: o.hourlyRate,
      penaltyAmount: o.penaltyAmount,
    },
  }
}
