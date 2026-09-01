import { AssetUnit } from '../models/index.js'
import type { BookingHydrated } from '../models/booking.model.js'
import type { Role } from '../domain/types.js'
import { ApiError } from '../utils/ApiError.js'
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

export function getAvailableTransitions(
  booking: Pick<BookingHydrated, 'engineKind' | 'status'>,
  roles: Role[],
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
): Promise<WorkflowContext['assets']> {
  const assetTypeId = booking.metadata?.assetTypeId as string | undefined
  const currentId = booking.reservation?.assetUnitId ?? booking.assetUnitId ?? null
  const requestedId = typeof payload.unitId === 'string' ? payload.unitId : null
  const scannedId = typeof payload.scannedUnitId === 'string' ? payload.scannedUnitId : null

  const [current, available, referenced] = await Promise.all([
    currentId ? AssetUnit.findOne({ _id: currentId, tenantId }).lean() : null,
    assetTypeId
      ? AssetUnit.find({ tenantId, stationId, assetTypeId, status: 'AVAILABLE' }).sort({ identifier: 1 }).limit(25).lean()
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

export async function applyTransition(params: ApplyTransitionParams): Promise<ApplyTransitionResult> {
  const { booking, code, actor, tenantId, stationId } = params
  const payload = params.payload ?? {}
  const now = params.now ?? new Date()

  const wf = getWorkflow(booking.engineKind)
  if (!wf) throw ApiError.unprocessable(`No workflow registered for engine "${booking.engineKind}".`)

  const transition = wf.transitions.find((t) => t.code === code && t.source.includes(booking.status))
  if (!transition) {
    throw ApiError.unprocessable(`Transition "${code}" is not allowed from status "${booking.status}".`)
  }
  if (!transition.actors.includes(actor.role)) {
    throw ApiError.forbidden(`Role ${actor.role} may not perform "${code}".`)
  }

  const ctx: WorkflowContext = {
    booking: toSnapshot(booking),
    payload,
    actor,
    now,
    assets: await gatherAssets(booking, payload, tenantId, stationId),
  }

  const validator = getValidator(booking.engineKind)
  if (!validator) throw ApiError.unprocessable(`No validator registered for "${booking.engineKind}".`)
  const validation = await validator(code, ctx)
  if (validation.errors.length) throw ApiError.unprocessable(`Cannot ${transition.label}.`, validation.errors)

  const operator = getOperator(booking.engineKind)
  if (!operator) throw ApiError.unprocessable(`No operator registered for "${booking.engineKind}".`)
  const result = await operator(code, ctx)
  if (result.errors.length) throw ApiError.unprocessable(`Cannot ${transition.label}.`, result.errors)

  const from = booking.status
  applySnapshot(booking, result.booking)
  booking.transitionLog.push({ code, from, to: booking.status, by: actor.id, at: now, reason: payload.reason })
  booking.markModified('transitionLog')
  await booking.save()
  await applyAssetIntents(result.assetIntents, tenantId)

  return { booking, audits: result.audits, transition }
}
