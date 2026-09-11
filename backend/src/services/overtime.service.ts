import { Booking, Tenant } from '../models/index.js'
import type { BookingHydrated } from '../models/booking.model.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { expiryWarningWhatsApp } from '../constants/messages.constants.js'
import { computeOvertime, describeOvertime, OVERTIME_BLOCK_MINUTES } from '../domain/overtime.js'
import { sendTextVia } from './vonage.service.js'
import { raise } from './notification.service.js'

export function trackingUrl(trackingToken: string): string {
  return `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/track/${trackingToken}`
}

function warningMessage(booking: BookingHydrated, minutesLeft: number, currency: string): string {
  return expiryWarningWhatsApp({
    brand: env.MAIL_FROM_NAME,
    ref: booking.ref,
    minutesLeft,
    graceMin: booking.session.gracePeriodMin,
    blockMin: OVERTIME_BLOCK_MINUTES,
    rate: booking.session.overtimeHourlyRate,
    currency,
    tracking: trackingUrl(booking.trackingToken),
  })
}

/** One sweep touches a handful of tenants at most, so look each one up once. */
function currencyLookup() {
  const seen = new Map<string, string>()
  return async (tenantId: string): Promise<string> => {
    const known = seen.get(tenantId)
    if (known) return known
    const tenant = await Tenant.findById(tenantId).select('currency').lean()
    const currency = tenant?.currency ?? 'SAR'
    seen.set(tenantId, currency)
    return currency
  }
}

export async function sweepExpiryWarnings(now: Date = new Date()): Promise<number> {
  const windowEnd = new Date(now.getTime() + env.EXPIRY_WARNING_MINUTES * 60_000)
  const due = await Booking.find({
    status: 'ACTIVE',
    'session.expiryWarningSentAt': null,
    'session.expectedEndAt': { $gt: now, $lte: windowEnd },
  }).limit(200)

  let sent = 0
  const currencyFor = currencyLookup()
  for (const booking of due) {
    const minutesLeft = Math.max(1, Math.round((new Date(booking.session.expectedEndAt!).getTime() - now.getTime()) / 60_000))

    booking.session.expiryWarningSentAt = now
    await booking.save()

    /*
     * Nobody chose a channel for a reminder, so both are tried.
     *
     * The specification notes that a customer's WhatsApp number is often not the number
     * they answer — and a warning that their time is nearly up is precisely the message
     * that must not quietly fail to arrive.
     */
    const result = booking.customerPhone
      ? await sendTextVia(
          ['whatsapp', 'sms'],
          booking.customerPhone,
          warningMessage(booking, minutesLeft, await currencyFor(booking.tenantId)),
        )
      : { ok: false, error: 'Booking has no customer phone.' }

    await raise({
      tenantId: booking.tenantId,
      stationId: booking.stationId,
      kioskId: booking.kioskId,
      engineKind: booking.engineKind,
      title: result.ok ? 'Expiry warning sent' : 'Expiry warning NOT delivered',
      body: result.ok
        ? `${booking.ref}: customer warned that storage ends in ~${minutesLeft} min.`
        : `${booking.ref}: could not WhatsApp the customer (${result.error}). Call them before overtime starts.`,
      level: result.ok ? 'info' : 'warning',
      link: `/bookings/${booking._id}`,
    })
    if (result.ok) sent += 1
  }

  if (due.length) logger.info('Expiry warning sweep', { considered: due.length, sent })
  return sent
}

export async function sweepOvertime(now: Date = new Date()): Promise<number> {
  const candidates = await Booking.find({
    status: 'ACTIVE',
    'session.expectedEndAt': { $lt: now },
  }).limit(200)

  let flipped = 0
  for (const booking of candidates) {
    const state = computeOvertime(booking.session, now)
    if (!state.isOvertime) continue

    booking.status = 'OVERTIME'
    booking.session.status = 'OVERTIME'
    await booking.save()
    flipped += 1

    await raise({
      tenantId: booking.tenantId,
      stationId: booking.stationId,
      kioskId: booking.kioskId,
      engineKind: booking.engineKind,
      title: 'Overtime accruing',
      body: `${booking.ref} passed its ${state.gracePeriodMin}-minute grace period. ${describeOvertime(state)}`,
      level: 'danger',
      link: `/bookings/${booking._id}`,
    })
  }

  if (flipped) logger.info('Overtime sweep', { flipped, candidates: candidates.length })
  return flipped
}

export async function runSessionSweeps(now: Date = new Date()): Promise<{ warned: number; flipped: number }> {
  const warned = await sweepExpiryWarnings(now)
  const flipped = await sweepOvertime(now)
  return { warned, flipped }
}
