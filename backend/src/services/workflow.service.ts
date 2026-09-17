import { AssetType, AssetUnit, Kiosk } from '../models/index.js'
import { unitsReachableFrom } from '../domain/access.js'
import { placesAround } from './reach.service.js'
import type { BookingHydrated } from '../models/booking.model.js'
import type { Role } from '../domain/types.js'
import { ApiError } from '../utils/ApiError.js'
import { tenantRules } from './rules.service.js'
import {
  getOperator,
  getValidator,
  getWorkflow,
  type AssetIntent,
  type AssetUnitSnapshot,
  type BookingSnapshot,
  type TransitionPayload,
  type WorkflowContext,
} from '../domain/workflow.js'
import type { ApplyTransitionParams, ApplyTransitionResult, AvailableTransition } from '../interfaces/index.js'

/** What a built-in workflow has to say about a booking that does not use one. */
const ACTIVITY_ELSEWHERE = {
  allowed: false,
  message: 'This booking follows its own activity’s steps.',
  transitions: [] as AvailableTransition[],
}

/**
 * Where the person acting has to be standing.
 *
 * Roles say what a job is allowed to do; they cannot say whether the person is in the right
 * place, and for bags that is the whole question. A Shop & Drop counter sells storage and holds
 * none of it: the lockers are at a gate, the bags are carried there, and both the storing and the
 * fetching happen there. So the counter that took the money is exactly the desk that cannot put
 * the bags in or take them out.
 *
 * Only the two moments that touch a locker are placed. Everything else — confirming payment,
 * reserving, cancelling — belongs to the desk that made the sale, as it always did.
 *
 * Anyone not tied to a counter (a supervisor, a manager, an admin) walks the whole venue and is
 * placed nowhere, so nothing here narrows them.
 */
const PLACED_AT_A_GATE = ['TO_STORED', 'TO_RETRIEVAL', 'TO_COMPLETED']

function standingInTheRightPlace(
  code: string,
  booking: { engineKind: string | null; gateId?: string | null },
  at?: PlaceContext,
): boolean {
  if (!at?.kioskScoped) return true
  if (booking.engineKind !== 'SHOP_AND_DROP') return true
  if (!PLACED_AT_A_GATE.includes(code)) return true

  // Bags reach a gate in a courier's hands. Nobody at a counter can say they were put away.
  if (code === 'TO_STORED') return false

  // And they come back out where they are: the staff posted to that gate, and nobody else.
  return !!booking.gateId && booking.gateId === at.gateId
}

/** Where the person asking is standing, when that matters. */
export interface PlaceContext {
  /** True for the roles tied to one counter — an agent or a chief captain. */
  kioskScoped: boolean
  /** The gate they are posted to, if any. */
  gateId: string | null
}

export function getAvailableTransitions(
  booking: Pick<BookingHydrated, 'engineKind' | 'status'> & { gateId?: string | null },
  roles: Role[],
  at?: PlaceContext,
): { allowed: boolean; message: string; transitions: AvailableTransition[] } {
  /*
   * A booking sold under a tenant's own activity does not belong here.
   *
   * Its steps are the ones its activity's published revision defines, and they are applied by
   * the activity session service. Answering with the built-in workflow's transitions would
   * offer an agent buttons that mean nothing for what they are actually running.
   */
  if (booking.engineKind === null) return ACTIVITY_ELSEWHERE

  const wf = getWorkflow(booking.engineKind)
  if (!wf) {
    return { allowed: false, message: `No workflow registered for ${booking.engineKind}.`, transitions: [] }
  }
  if (!roles.some((r) => wf.actors.includes(r))) {
    return { allowed: false, message: `You have no permission on ${booking.engineKind}.`, transitions: [] }
  }

  const available = wf.transitions
    .filter((t) => t.source.includes(booking.status) && roles.some((r) => t.actors.includes(r)))
    .filter((t) => standingInTheRightPlace(t.code, booking, at))
    .map((t) => ({ code: t.code, label: t.label, from: booking.status, target: t.target, style: t.style }))

  return {
    allowed: available.length > 0,
    message: available.length ? 'Transitions fetched.' : `No transitions available from "${booking.status}".`,
    transitions: available,
  }
}

function toSnapshot(booking: BookingHydrated): BookingSnapshot {
  return JSON.parse(JSON.stringify(booking.toObject())) as BookingSnapshot
}

const unitSnapshot = (u: {
  _id: string
  identifier: string
  status: string
  assetTypeId: string
  currentBookingId: string | null
}): AssetUnitSnapshot => ({
  _id: u._id,
  identifier: u.identifier,
  status: u.status as AssetUnitSnapshot['status'],
  assetTypeId: u.assetTypeId,
  currentBookingId: u.currentBookingId,
})

async function gatherAssets(
  booking: BookingHydrated,
  payload: TransitionPayload,
  tenantId: string,
  stationId: string,
  kioskId?: string | null,
): Promise<WorkflowContext['assets']> {
  const assetTypeId = booking.metadata?.assetTypeId as string | undefined
  const currentId = booking.reservation?.assetUnitId ?? booking.assetUnitId ?? null
  const requestedId = typeof payload.unitId === 'string' ? payload.unitId : null
  const scannedId = typeof payload.scannedUnitId === 'string' ? payload.scannedUnitId : null

  /*
   * What this desk can reserve — the same rule the counter used to decide it could sell.
   *
   * The reservation and the check that runs before the money is taken must agree exactly, or an
   * agent sells something and then cannot hand it over. This used to be its own copy of the
   * rule, and when location-held stock was added to the counter's copy this one still looked
   * only at the desk's own area: WIQAR's reception could sell a ride on a horse in the stable
   * and then be told the horse was "already out with someone else" when the ride started.
   *
   * The condition carries its own "where", so no station is added beside it here.
   */
  const where = unitsReachableFrom(kioskId ?? undefined, await placesAround(stationId))

  const [current, available, referenced] = await Promise.all([
    currentId ? AssetUnit.findOne({ _id: currentId, tenantId }).lean() : null,
    assetTypeId
      ? AssetUnit.find({
          tenantId,
          assetTypeId,
          status: 'AVAILABLE',
          ...where,
        })
          .sort({ identifier: 1 })
          .limit(25)
          .lean()
      : [],
    AssetUnit.find({ _id: { $in: [requestedId, scannedId].filter(Boolean) }, tenantId }).lean(),
  ])

  const byId: Record<string, AssetUnitSnapshot> = {}
  for (const u of [...(available ?? []), ...(referenced ?? []), ...(current ? [current] : [])]) {
    byId[u._id] = unitSnapshot(u)
  }

  return {
    current: current ? unitSnapshot(current) : null,
    available: (available ?? []).map(unitSnapshot),
    byId,
  }
}

function applySnapshot(booking: BookingHydrated, next: BookingSnapshot): void {
  booking.status = next.status
  booking.bags = next.bags as unknown as BookingHydrated['bags']
  booking.session = { ...booking.session, ...next.session } as unknown as BookingHydrated['session']
  booking.reservation = next.reservation as unknown as BookingHydrated['reservation']
  booking.assetUnitId = next.assetUnitId ?? null
  booking.custody = next.custody as unknown as BookingHydrated['custody']
  booking.verifications = next.verifications as unknown as BookingHydrated['verifications']
  /*
   * What the operation wrote about the session.
   *
   * This was marked modified and never copied, so every operation-level note was dropped on
   * save — the trainer who ran a WIQAR session, when its animal may work again, and how a
   * photo session's pictures were delivered. The operation starts from a clone of the booking,
   * so this is the whole metadata with its additions, not a partial overwrite.
   */
  if (next.metadata) booking.metadata = next.metadata as BookingHydrated['metadata']
  booking.markModified('bags')
  booking.markModified('session')
  booking.markModified('custody')
  booking.markModified('verifications')
  booking.markModified('metadata')
}

async function applyAssetIntents(intents: AssetIntent[], tenantId: string): Promise<void> {
  for (const intent of intents) {
    if (intent.op !== 'SET_STATUS') continue
    const patch: Record<string, unknown> = { status: intent.status }
    if (intent.currentBookingId !== undefined) patch.currentBookingId = intent.currentBookingId
    if (intent.note !== undefined) patch.note = intent.note
    if (intent.restingUntil !== undefined) patch.restingUntil = intent.restingUntil ? new Date(intent.restingUntil) : null
    /* Anything that puts a unit back to work ends whatever rest it was on. */
    if (intent.status !== 'RESTING' && intent.restingUntil === undefined) patch.restingUntil = null
    await AssetUnit.updateOne({ _id: intent.unitId, tenantId }, { $set: patch })
  }
}

const NO_UNIT_ERRORS = ['No available unit to reserve.', 'No replacement unit available.']

async function noUnitHere(
  tenantId: string,
  stationId: string,
  kioskId: string | null,
  assetTypeId: string | undefined,
): Promise<string[]> {
  if (!assetTypeId) return []

  const [type, kiosk, elsewhere, otherSizes] = await Promise.all([
    AssetType.findOne({ _id: assetTypeId, tenantId }, { name: 1, kind: 1 }).lean(),
    kioskId ? Kiosk.findOne({ _id: kioskId, tenantId }, { name: 1 }).lean() : null,
    AssetUnit.countDocuments({ tenantId, stationId, assetTypeId, status: 'AVAILABLE', ...(kioskId ? { kioskId: { $ne: kioskId } } : {}) }),
    kioskId
      ? AssetUnit.aggregate<{ _id: string; free: number }>([
          { $match: { tenantId, stationId, kioskId, status: 'AVAILABLE' } },
          { $group: { _id: '$assetTypeId', free: { $sum: 1 } } },
        ])
      : [],
  ])

  const here = kiosk?.name ?? 'this desk'
  const size = type?.name ?? 'that size'
  const names = await AssetType.find(
    { _id: { $in: otherSizes.map((row) => row._id).filter((id) => id !== assetTypeId) }, tenantId, kind: type?.kind },
    { name: 1 },
  ).lean()
  const nameOf = new Map(names.map((t) => [t._id, t.name]))
  const free = otherSizes
    .filter((row) => row._id !== assetTypeId && nameOf.has(row._id))
    .map((row) => `${nameOf.get(row._id)} (${row.free})`)

  const lines = [`${here} has no ${size} free right now.`]
  if (free.length) lines.push(`Free at ${here}: ${free.join(', ')} — go back and pick one of those.`)
  if (elsewhere > 0) lines.push(`${elsewhere} ${size} are free at other desks, but a desk can only lock its own.`)
  return lines
}

/**
 * Everything `applyTransition` checks before it changes anything, and nothing after.
 *
 * Exposed so a caller that has to do something irreversible *before* a transition can ask first.
 * Payment is the case that needed it: money was recorded and the order marked paid, and only
 * then did confirmation run the activity's rules — a WIQAR ride with no trainer named was
 * refused after the card had been charged, leaving a paid order on a draft booking that could
 * not be paid again.
 */
export async function checkTransition(params: ApplyTransitionParams) {
  const { booking, code, actor, tenantId, stationId } = params
  const kioskId = params.kioskId ?? booking.kioskId ?? null
  const payload = params.payload ?? {}
  const now = params.now ?? new Date()

  if (booking.engineKind === null) {
    throw ApiError.unprocessable(
      'This booking follows its own activity’s steps, which are applied through the activity session.',
    )
  }

  const wf = getWorkflow(booking.engineKind)
  if (!wf) throw ApiError.unprocessable(`No workflow registered for engine "${booking.engineKind}".`)

  const transition = wf.transitions.find((t) => t.code === code && t.source.includes(booking.status))
  if (!transition) {
    throw ApiError.unprocessable(`Transition "${code}" is not allowed from status "${booking.status}".`)
  }
  /*
   * Enforced, not merely hidden.
   *
   * The same rule decides which buttons a screen shows, but a screen is not a fence: the endpoint
   * is reachable by anyone with a token, and a counter asking to store bags it never touched has
   * to be refused here, where the answer actually binds.
   */
  if (!standingInTheRightPlace(code, booking, params.at)) {
    throw ApiError.forbidden(
      code === 'TO_STORED'
        ? 'Bags are stored at the gate by whoever carried them there, not at the counter that sold the storage.'
        : 'These bags are in another gate — the staff posted to it hand them back.',
    )
  }

  if (!transition.actors.includes(actor.role)) {
    throw ApiError.forbidden(`Role ${actor.role} may not perform "${code}".`)
  }

  const rules = await tenantRules(tenantId)
  const ctx: WorkflowContext = {
    booking: toSnapshot(booking),
    payload,
    actor,
    now,
    assets: await gatherAssets(booking, payload, tenantId, stationId, kioskId),
    rules: {
      timer: rules.rental.timers[wf.engineKind],
      replacementBonusMin: rules.rental.replacementBonusMin,
    },
  }

  const validator = getValidator(booking.engineKind)
  if (!validator) throw ApiError.unprocessable(`No validator registered for "${booking.engineKind}".`)
  const validation = await validator(code, ctx)
  if (validation.errors.length) throw ApiError.unprocessable(`Cannot ${transition.label}.`, validation.errors)

  return { ctx, transition, kioskId, payload, now }
}

export async function applyTransition(params: ApplyTransitionParams): Promise<ApplyTransitionResult> {
  const { booking, code, actor, tenantId, stationId } = params
  if (booking.engineKind === null) {
    throw ApiError.unprocessable(
      'This booking follows its own activity’s steps, which are applied through the activity session.',
    )
  }
  const { ctx, transition, kioskId, payload, now } = await checkTransition(params)

  const operator = getOperator(booking.engineKind)
  if (!operator) throw ApiError.unprocessable(`No operator registered for "${booking.engineKind}".`)
  const result = await operator(code, ctx)
  if (result.errors.length) {
    if (result.errors.some((e) => NO_UNIT_ERRORS.includes(e))) {
      const detail = await noUnitHere(tenantId, stationId, kioskId, booking.metadata?.assetTypeId as string | undefined)
      if (detail.length) throw ApiError.unprocessable(detail[0], detail.slice(1))
    }
    throw ApiError.unprocessable(`Cannot ${transition.label}.`, result.errors)
  }

  const from = booking.status
  applySnapshot(booking, result.booking)

  /*
   * Follow the locker to its gate.
   *
   * Storage and retrieval happen where the locker is, and the counter that sold it is elsewhere
   * in the venue. Recording the gate on the booking is what lets the staff posted there find the
   * bags, and the courier carrying them know where they are going — without either having to
   * chase a unit id through two collections every time a screen loads.
   */
  const heldUnitId = booking.reservation?.assetUnitId ?? booking.assetUnitId ?? null
  if (heldUnitId) {
    const held = await AssetUnit.findOne({ _id: heldUnitId, tenantId }, { gateId: 1 }).lean()
    booking.gateId = held?.gateId ?? null
  } else {
    booking.gateId = null
  }

  booking.transitionLog.push({ code, from, to: booking.status, by: actor.id, at: now, reason: payload.reason })
  booking.markModified('transitionLog')
  await booking.save()
  await applyAssetIntents(result.assetIntents, tenantId)

  return { booking, audits: result.audits, transition }
}
