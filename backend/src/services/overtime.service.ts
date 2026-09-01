import { Booking, Notification } from '../models/index.js'
import type { BookingHydrated } from '../models/booking.model.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { computeOvertime, describeOvertime, OVERTIME_BLOCK_MINUTES } from '../domain/overtime.js'
import { sendWhatsAppText } from './whatsapp.service.js'

export function trackingUrl(trackingToken: string): string {
  return `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/track/${trackingToken}`
}

function warningMessage(booking: BookingHydrated, minutesLeft: number): string {
  const rate = booking.session.overtimeHourlyRate
  return [
    `LockerFlow: your storage for ${booking.ref} ends in about ${minutesLeft} minute(s).`,
    `You have a ${booking.session.gracePeriodMin}-minute grace period after that — collect within it and you pay nothing extra.`,
    rate > 0
      ? `After the grace period a full ${OVERTIME_BLOCK_MINUTES}-minute block is charged (${rate} per hour), even if you are only a few minutes late.`
      : `After the grace period a full ${OVERTIME_BLOCK_MINUTES}-minute block is charged, even if you are only a few minutes late.`,
    `Track your session: ${trackingUrl(booking.trackingToken)}`,
  ].join('\n')
}

export async function sweepExpiryWarnings(now: Date = new Date()): Promise<number> {
  const windowEnd = new Date(now.getTime() + env.EXPIRY_WARNING_MINUTES * 60_000)
  const due = await Booking.find({
    status: 'ACTIVE',
    'session.expiryWarningSentAt': null,
    'session.expectedEndAt': { $gt: now, $lte: windowEnd },
  }).limit(200)

  let sent = 0
  for (const booking of due) {
    const minutesLeft = Math.max(1, Math.round((new Date(booking.session.expectedEndAt!).getTime() - now.getTime()) / 60_000))

    booking.session.expiryWarningSentAt = now
    await booking.save()

    const result = booking.customerPhone
      ? await sendWhatsAppText(booking.customerPhone, warningMessage(booking, minutesLeft))
      : { ok: false, error: 'Booking has no customer phone.' }

    await Notification.create({
      tenantId: booking.tenantId,
      stationId: booking.stationId,
      title: result.ok ? 'Expiry warning sent' : 'Expiry warning NOT delivered',
      body: result.ok
        ? `${booking.ref}: customer warned that storage ends in ~${minutesLeft} min.`
        : `${booking.ref}: could not WhatsApp the customer (${result.error}). Call them before overtime starts.`,
      level: result.ok ? 'info' : 'warning',
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

    await Notification.create({
      tenantId: booking.tenantId,
      stationId: booking.stationId,
      title: 'Overtime accruing',
      body: `${booking.ref} passed its ${state.gracePeriodMin}-minute grace period. ${describeOvertime(state)}`,
      level: 'danger',
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
