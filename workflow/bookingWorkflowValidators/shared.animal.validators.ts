import type { WorkflowContext } from '../shared/types.js'
import { UNIT_BLOCKED, UNIT_MAINTENANCE, UNIT_OUT_OF_SERVICE, UNIT_RESTING } from '../shared/status.js'

/**
 * Checks shared by every WIQAR activity that puts a live animal to work.
 *
 * WIQAR runs seven experiences and each is its own coded module with its own workflow. The
 * *welfare* rules underneath them are one set of rules, written once here and composed by each
 * module as it needs them — seven modules that each decided for themselves when a horse is fit
 * to work would be seven answers to a question with one answer.
 *
 * ## Every rule here is traceable to the specification
 *
 * | Rule | Source |
 * |---|---|
 * | An animal may not be in two overlapping sessions | §11.1 double-booking prevention, §6.4 |
 * | Minimum rest between sessions, enforced by the system | §11.1 mandatory rest periods |
 * | A health-flagged animal may not be booked | §11.1 health override |
 * | A named trainer on every riding or care session | §11.1 trainer assignment |
 * | Fifteen minutes' grace on a booked slot | §11.1 session start grace |
 * | Consent to terms logged against the visitor | §6.3 step 1, §10.1 |
 * | A group package takes at least five people | §4.1 EXP-07 |
 * | Feed is bought as part of a feeding session | §6.5 |
 *
 * ## Assumptions — NOT in the specification, to confirm before go-live
 *
 * Marked `ASSUMPTION` at the point of use so nobody mistakes one for a requirement:
 *
 *  - **A-1.** §11.1 names a trainer for *"riding or care"* sessions. Whether a **camel tour**,
 *    a **feeding session** and the **group package** also require one is not stated. §5.1 lists
 *    *"Camel Trainers / Workers — Camel tours, feeding management"*, which implies somebody is
 *    always assigned, so those three ask for a named trainer too. If the client says a camel
 *    tour may run unattended, delete the check from those three modules.
 *  - **A-2.** §4.1 EXP-02 offers *"beginner and intermediate levels"*. Whether a booking must
 *    name the level up front is not stated; it is required here because the level decides which
 *    horse suits it.
 *
 * ## Deliberately absent
 *
 * There is **no safety-brief or waiver check**. An earlier draft had one on the riding
 * activities; the specification does not mention safety briefs, waivers or acknowledgements
 * anywhere, and helmets appear only as retail stock (§4.2) and loanable equipment (§8.1). What
 * §6.3 and §10.1 *do* require is consent to terms at registration, which is `requireConsent`
 * below and applies to every experience rather than to riding alone.
 */

/** The levels §4.1 EXP-02 teaches at. The lesson's intake offers exactly these. */
export const LESSON_LEVELS = ['BEGINNER', 'INTERMEDIATE'] as const

/** §4.1 EXP-07: the group package is sold to parties of five or more. */
export const GROUP_MINIMUM_PARTY = 5

/** A feeding session is at least one portion of feed — §6.5. */
export const MINIMUM_FEED_PORTIONS = 1

/** Why an animal is not workable right now, said the way the person at the counter would say it. */
const UNAVAILABLE_REASON: Record<string, string> = {
  [UNIT_RESTING]: 'is still in its rest period after the last session',
  [UNIT_MAINTENANCE]: 'is under veterinary care',
  [UNIT_BLOCKED]: 'has been stood down by a supervisor',
  [UNIT_OUT_OF_SERVICE]: 'is retired from the experience',
}

/** The animal this booking is about, whether it was just named or assigned earlier. */
function animalFor(ctx: WorkflowContext) {
  const requested = typeof ctx.payload.unitId === 'string' ? ctx.payload.unitId.trim() : ''
  const id = requested || ctx.booking.assetUnitId || ctx.booking.reservation?.assetUnitId || ''
  return id ? (ctx.assets.byId[id] ?? null) : null
}

/**
 * Refuses an animal that is resting, under veterinary care, stood down or retired.
 *
 * §11.1: *"An animal flagged with a health concern may not be booked; block can only be lifted
 * by supervisor after vet clearance confirmation."* The lifting is a supervisor action on the
 * animal record — deliberately not something this validator can be talked out of.
 *
 * §7.5 adds that an animal is removed from bookable inventory *automatically* when a health
 * request is submitted, which is why the statuses rather than a separate flag decide it.
 */
export function requireWorkableAnimal(ctx: WorkflowContext): string[] {
  const animal = animalFor(ctx)
  if (!animal) return []

  const reason = UNAVAILABLE_REASON[animal.status]
  if (reason) return [`${animal.identifier} ${reason}.`]

  /*
   * Already out with somebody else — §11.1 double-booking, §6.4 overbooking.
   *
   * Checked against the booking rather than the status alone, because an animal held for
   * *this* booking is legitimately not "available" and refusing it here would make it
   * impossible to start the session it is being held for.
   */
  const heldElsewhere = animal.currentBookingId && animal.currentBookingId !== ctx.booking._id
  if (heldElsewhere) return [`${animal.identifier} is already out with another visitor.`]

  return []
}

/**
 * Refuses a session with nobody named to run it.
 *
 * §11.1: *"Each riding or care session must have a named trainer assigned; unassigned sessions
 * cannot be confirmed."* Composed by the riding, lesson and care modules on that authority,
 * and by the camel tour, feeding and group modules under **assumption A-1**.
 */
export function requireNamedTrainer(ctx: WorkflowContext): string[] {
  const named =
    (typeof ctx.payload.trainerId === 'string' && ctx.payload.trainerId.trim()) ||
    (typeof ctx.booking.metadata?.trainerId === 'string' && (ctx.booking.metadata.trainerId as string).trim())

  return named ? [] : ['Name the trainer who will run this session before confirming it.']
}

/**
 * Refuses a booking for a visitor who has not accepted the terms.
 *
 * §6.3 step 1: *"Profile created or loaded; visitor consent to terms logged."* §10.1: *"Consent
 * to terms recorded (digital acknowledgement); logged in system."* Checked at confirmation
 * because that is the first moment the booking is a commitment, and it applies to every
 * experience — the specification attaches it to the visitor, not to any one activity.
 */
export function requireConsent(ctx: WorkflowContext): string[] {
  const consented = ctx.booking.metadata?.consentAt ?? ctx.payload.consentAt
  return consented ? [] : ['Record the visitor’s acceptance of the terms before confirming.']
}

/**
 * Refuses a visitor who has missed their slot by more than the grace period.
 *
 * §11.1: *"Visitor must arrive within 15 minutes of booked slot; slot may be reallocated after
 * that period at supervisor's discretion."* — a refusal an agent cannot clear and a supervisor
 * can, which is why the message says whose decision it is.
 */
export const SLOT_GRACE_MINUTES = 15

export function requireWithinSlotGrace(ctx: WorkflowContext): string[] {
  const slot = ctx.booking.metadata?.slotAt
  if (typeof slot !== 'string') return []

  const booked = new Date(slot).getTime()
  if (!Number.isFinite(booked)) return []

  const lateBy = Math.round((ctx.now.getTime() - booked) / 60_000)
  if (lateBy <= SLOT_GRACE_MINUTES) return []

  // §11.1 puts reallocation at the supervisor's discretion, so they are allowed past this.
  if (ctx.actor.role !== 'AGENT') return []

  return [
    `This slot was booked for ${lateBy} minutes ago, beyond the ${SLOT_GRACE_MINUTES}-minute grace. A supervisor decides whether to reallocate it.`,
  ]
}

/**
 * Refuses a party smaller than the experience allows.
 *
 * §4.1 EXP-07: the group package is *"min. 5 persons"*. Passed in rather than hardcoded so the
 * one module that needs it says its own number out loud.
 */
export function requireMinimumParty(ctx: WorkflowContext, minimum: number): string[] {
  const size = Number(ctx.booking.metadata?.partySize ?? ctx.payload.partySize ?? 0)
  if (!Number.isFinite(size) || size <= 0) {
    return [`Say how many people are in the party — this experience takes at least ${minimum}.`]
  }
  return size >= minimum ? [] : [`This experience takes a party of at least ${minimum}; this one is ${size}.`]
}

/**
 * Refuses a feeding session with no feed bought.
 *
 * §6.5: *"Visitor purchasing a 'feeding session' also purchases physical animal feed from the
 * shop (tracked as inventory item)"* — the retail line and the session are one transaction, so
 * a session with nothing to feed is not a session that can start.
 */
export function requireFeedPurchased(ctx: WorkflowContext): string[] {
  const portions = Number(ctx.booking.metadata?.feedPortions ?? 0)
  return Number.isFinite(portions) && portions >= MINIMUM_FEED_PORTIONS
    ? []
    : ['Add the feed the visitor is buying before starting the session.']
}
