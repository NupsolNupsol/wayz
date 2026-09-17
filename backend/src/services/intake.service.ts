import type { IntakeField } from '@wayz/workflow'

import { Booking, User } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { getWorkflow } from '../domain/workflow.js'
import { placesAround } from './reach.service.js'
import type { Scope } from '../interfaces/index.js'
import type { EngineKind } from '../domain/types.js'

/**
 * The details an activity needs before its booking can be confirmed.
 *
 * Each activity module declares them (`EngineWorkflow.intake`) beside the validator that
 * enforces them. This is the one place they are *recorded*, so what the counter sends is
 * checked the same way however it arrives:
 *
 *  - **Consent** is stamped here, with the server's clock and the agent who took it. The counter
 *    says "the visitor accepted"; it does not get to say when. §6.3 and §10.1 require the
 *    acknowledgement to be logged, and a timestamp from the browser is not a log.
 *  - **The trainer** must be a real, active member of staff at this location who works this
 *    activity. A free-text name would satisfy "named" and mean nothing.
 *  - **Level, party size, feed** are checked against the numbers the module itself declares.
 *
 * Only fields the activity declares are accepted. Anything else is ignored, so a WAYZ booking
 * cannot acquire a trainer and a photo session cannot acquire a level.
 */

/** Keys only this service writes. Stripped from a new booking's free-form metadata. */
export const INTAKE_KEYS = ['consentAt', 'consentBy', 'trainerId', 'trainerName', 'level', 'partySize', 'feedPortions'] as const

export function withoutIntakeKeys(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  const copy = { ...(metadata ?? {}) }
  for (const key of INTAKE_KEYS) delete copy[key]
  return copy
}

export interface IntakeInput {
  consent?: boolean
  trainerId?: string | null
  level?: string | null
  partySize?: number | null
  feedPortions?: number | null
}

export function intakeFor(engineKind: EngineKind | null): IntakeField[] {
  if (!engineKind) return []
  return getWorkflow(engineKind)?.intake ?? []
}

/**
 * Who may be named to run a session of this activity at the caller's location.
 *
 * Staff whose activities include it, posted anywhere on the same site — a horse trainer works the
 * stable, not the reception that sells the ride. Names only; nothing else about them is exposed
 * to the counter.
 */
export async function trainersFor(scope: Scope, engineKind: EngineKind) {
  const { siteStationIds } = await placesAround(scope.stationId)
  const people = await User.find(
    { active: true, engineKinds: engineKind, stationId: { $in: siteStationIds } },
    { fullName: 1, roleLabel: 1 },
  )
    .sort({ fullName: 1 })
    .lean<{ _id: string; fullName: string; roleLabel?: string }[]>()

  /*
   * Everyone assigned the activity is offered, with their job title, and anyone whose title
   * says they train comes first.
   *
   * Roles are the platform's and "trainer" is not one of them — a WIQAR trainer is a counter-level
   * member of staff whose job title says so. Filtering on the title would make a small location
   * with no titled trainer unable to sell at all, so the list stays complete and the title does
   * the telling. Who may be named is an open question for the client — see the WIQAR assumptions
   * document, A-7.
   */
  const trains = (title: string) => /trainer|coach|instructor|مدرب/i.test(title)
  return people
    .map((p) => ({ id: p._id, name: p.fullName, title: p.roleLabel ?? '' }))
    .sort((a, b) => Number(trains(b.title)) - Number(trains(a.title)))
}

export async function recordIntake(scope: Scope, bookingId: string, input: IntakeInput) {
  const booking = await Booking.findOne({ _id: bookingId, stationId: scope.stationId })
  if (!booking) throw ApiError.notFound('Booking not found.')
  if (booking.status !== 'DRAFT') {
    throw ApiError.unprocessable('These details are taken before the booking is confirmed, and this one already is.')
  }

  const declared = intakeFor(booking.engineKind as EngineKind | null)
  if (declared.length === 0) return booking

  const metadata: Record<string, unknown> = { ...(booking.metadata ?? {}) }
  const problems: string[] = []

  for (const field of declared) {
    switch (field.key) {
      case 'consent': {
        // Recorded once. A later call that does not repeat it does not withdraw it.
        if (input.consent === true && !metadata.consentAt) {
          metadata.consentAt = new Date().toISOString()
          metadata.consentBy = scope.agentId
        }
        break
      }

      case 'trainer': {
        if (input.trainerId === undefined) break
        if (!input.trainerId) {
          delete metadata.trainerId
          delete metadata.trainerName
          break
        }
        const allowed = await trainersFor(scope, booking.engineKind as EngineKind)
        const trainer = allowed.find((t) => t.id === input.trainerId)
        if (!trainer) {
          problems.push('That person does not run this activity at this location.')
          break
        }
        metadata.trainerId = trainer.id
        metadata.trainerName = trainer.name
        break
      }

      case 'level': {
        if (input.level === undefined || input.level === null) break
        const level = String(input.level).trim().toUpperCase()
        if (!field.options.includes(level)) {
          problems.push(`"${input.level}" is not a level this is taught at — choose ${field.options.join(' or ')}.`)
          break
        }
        metadata.level = level
        break
      }

      case 'partySize': {
        if (input.partySize === undefined || input.partySize === null) break
        const size = Math.floor(Number(input.partySize))
        if (!Number.isFinite(size) || size < field.min) {
          problems.push(`This takes a party of at least ${field.min}.`)
          break
        }
        metadata.partySize = size
        break
      }

      case 'feedPortions': {
        if (input.feedPortions === undefined || input.feedPortions === null) break
        const portions = Math.floor(Number(input.feedPortions))
        if (!Number.isFinite(portions) || portions < field.min) {
          problems.push(`At least ${field.min} portion of feed goes with this session.`)
          break
        }
        metadata.feedPortions = portions
        break
      }
    }
  }

  if (problems.length) throw ApiError.badRequest(problems[0], problems.slice(1))

  booking.metadata = metadata
  booking.markModified('metadata')
  await booking.save()
  return booking
}
