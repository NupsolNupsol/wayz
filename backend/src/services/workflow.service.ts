import { AssetType, AssetUnit, Gate, Kiosk } from '../models/index.js'
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
  booking: { engineKind: string; gateId?: string | null },
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
   * What this desk can reserve: its own counter, and the gates of its station.
   *
   * The reservation and the check that runs before the money is taken must agree exactly, or an
   * agent sells storage and then cannot lock a locker for it. Lockers live at gates now, so a
   * desk-only lookup would find nothing for any bag drop on the platform.
   */
  const gates = await Gate.find({ tenantId, stationId, active: { $ne: false } }, { _id: 1 }).lean()
  const reach = kioskId
    ? gates.length
      ? { $or: [{ kioskId }, { gateId: { $in: gates.map((g) => g._id) } }] }
      : { kioskId }
    : {}

  const [current, available, referenced] = await Promise.all([
    currentId ? AssetUnit.findOne({ _id: currentId, tenantId }).lean() : null,
    assetTypeId
      ? AssetUnit.find({
          tenantId,
          stationId,
          assetTypeId,
          status: 'AVAILABLE',
          ...reach,
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

export async function applyTransition(params: ApplyTransitionParams): Promise<ApplyTransitionResult> {
  const { booking, code, actor, tenantId, stationId } = params
  const kioskId = params.kioskId ?? booking.kioskId ?? null
  const payload = params.payload ?? {}
  const now = params.now ?? new Date()

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
      timer: rules.rental.timers[booking.engineKind],
      replacementBonusMin: rules.rental.replacementBonusMin,
    },
  }

  const validator = getValidator(booking.engineKind)
  if (!validator) throw ApiError.unprocessable(`No validator registered for "${booking.engineKind}".`)
  const validation = await validator(code, ctx)
  if (validation.errors.length) throw ApiError.unprocessable(`Cannot ${transition.label}.`, validation.errors)

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
