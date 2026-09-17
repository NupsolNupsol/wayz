import { AnimalTransfer, AssetUnit, Station, Tenant, User } from '../models/index.js'
import type { AnimalTransferDoc, AnimalTransferStatus } from '../models/animalTransfer.model.js'
import { ApiError } from '../utils/ApiError.js'
import { nextSequence, pad } from './counter.service.js'
import { recordAudit } from './audit.service.js'
import { resolveTransferRules, type TransferRules } from '../domain/rules.js'
import { requireOrganisation } from '../platform/orgScope.js'
import { restMinutesFor } from '@wayz/workflow'
import type { Role } from '../domain/types.js'

/**
 * Inter-location animal transfers — §7.4.
 *
 * A transfer is not something a visitor buys, so it is not an activity and has no counter. It
 * is an internal movement with its own approval chain, and it exists because WIQAR runs the
 * same experiences at three locations from one pool of animals.
 *
 * ## The approval question is deliberately not answered here
 *
 * §7.4 and §11.2 name four different approving roles with no overlap. Rather than pick one and
 * bury it, the policy is read from configuration on every call — see `TransferRules`. This
 * service enforces whatever the organisation has set; it has no opinion about what that is.
 *
 * ## What the animal does
 *
 * | Step | The animal |
 * |---|---|
 * | requested | carries on working — a pending transfer is paperwork |
 * | approved | still working; §11.2 has the driver wait for confirmation |
 * | departed | `TRANSFERRED` — §7.4 removes it from the source location's active count |
 * | arrived | `AVAILABLE` or `RESTING` at the new location, as the receiver decides |
 *
 * The animal only stops being bookable when it actually leaves, which is what keeps a transfer
 * raised on Monday from taking an animal out of Tuesday's sessions.
 */

export interface TransferActor {
  id: string
  name: string
  role: Role
}

/** The policy this organisation has set, or the documented default. */
async function rulesFor(): Promise<TransferRules> {
  const organisation = await Tenant.findById(requireOrganisation(), { transferRules: 1 }).lean<{
    transferRules?: Partial<TransferRules>
  } | null>()
  return resolveTransferRules(organisation?.transferRules)
}

const may = (rules: string[], role: Role) => rules.includes(role)

/** Appends to §7.4's "full transfer log", which is the point of the record. */
function log(transfer: AnimalTransferDoc, action: string, actor: TransferActor, note = '') {
  transfer.log.push({ action, by: actor.id, byName: actor.name, role: actor.role, at: new Date(), note })
}

export interface RaiseTransferInput {
  animalId: string
  toStationId: string
  driverId?: string | null
  expectedDepartureAt?: string | null
  expectedArrivalAt?: string | null
  reason?: string
}

/**
 * Raises a transfer order. §7.4: *"initiated by Project Manager or Supervisor"* — configurable.
 */
export async function raiseTransfer(actor: TransferActor, input: RaiseTransferInput) {
  const rules = await rulesFor()
  if (!may(rules.requesters, actor.role)) {
    throw ApiError.forbidden(
      `Your role does not raise transfer orders — this organisation has that set to ${rules.requesters.join(' or ')}.`,
    )
  }

  const animal = await AssetUnit.findById(input.animalId).lean()
  if (!animal) throw ApiError.notFound('No such animal.')

  const destination = await Station.findById(input.toStationId).lean()
  if (!destination) throw ApiError.notFound('No such destination area.')

  const origin = await Station.findById(animal.stationId).lean()
  if (!origin) throw ApiError.unprocessable('That animal is not posted anywhere.')

  if (origin.siteId === destination.siteId) {
    throw ApiError.badRequest('That is the same location — a transfer moves an animal between locations.')
  }

  /* One in flight at a time. The index enforces it; this is the readable refusal. */
  const inFlight = await AnimalTransfer.findOne({
    animalId: input.animalId,
    status: { $in: ['REQUESTED', 'APPROVED', 'IN_TRANSIT'] },
  }).lean()
  if (inFlight) {
    throw ApiError.conflict(`${animal.identifier} already has a transfer in progress (${inFlight.ref}).`)
  }

  const driver = input.driverId ? await User.findById(input.driverId).lean() : null
  if (input.driverId && !driver) throw ApiError.notFound('No such driver.')

  const seq = await nextSequence('animalTransfer')
  const transfer = new AnimalTransfer({
    _id: `atr_${pad(seq)}`,
    ref: `TRF-${pad(seq)}`,
    animalId: animal._id,
    animalIdentifier: animal.identifier,
    fromSiteId: origin.siteId,
    fromStationId: origin._id,
    toSiteId: destination.siteId,
    toStationId: destination._id,
    driverId: driver?._id ?? null,
    driverName: driver?.fullName ?? '',
    expectedDepartureAt: input.expectedDepartureAt ? new Date(input.expectedDepartureAt) : null,
    expectedArrivalAt: input.expectedArrivalAt ? new Date(input.expectedArrivalAt) : null,
    status: 'REQUESTED' as AnimalTransferStatus,
    reason: input.reason ?? '',
    requestedBy: actor.id,
    log: [],
  })
  log(transfer, 'RAISED', actor, input.reason)
  await transfer.save()

  await recordAudit({
    tenantId: requireOrganisation(),
    actorId: actor.id,
    action: 'ANIMAL_TRANSFER_RAISED',
    entity: 'AnimalTransfer',
    entityId: transfer._id,
    detail: `${animal.identifier} → ${destination.name}`,
  })

  return transfer.toObject()
}

/** Approves one. The approving roles are configuration — §7.4 and §11.2 disagree. */
export async function approveTransfer(actor: TransferActor, id: string, note = '') {
  const rules = await rulesFor()
  const transfer = await AnimalTransfer.findById(id)
  if (!transfer) throw ApiError.notFound('No such transfer order.')
  if (transfer.status !== 'REQUESTED') {
    throw ApiError.unprocessable(`${transfer.ref} is ${transfer.status.toLowerCase()} and cannot be approved.`)
  }

  if (!may(rules.approvers, actor.role)) {
    throw ApiError.forbidden(
      `Your role does not approve transfer orders — this organisation has that set to ${rules.approvers.join(' or ')}.`,
    )
  }

  /*
   * Whoever raised it may not also approve it, unless the organisation has said they may.
   *
   * §7.4 approves transfers "for liability tracking", which one person doing both defeats.
   */
  if (!rules.selfApproval && transfer.requestedBy === actor.id) {
    throw ApiError.forbidden(
      'The person who raised a transfer does not approve it — somebody else with an approving role has to.',
    )
  }

  transfer.status = 'APPROVED'
  transfer.approvedBy = actor.id
  transfer.approvedAt = new Date()
  log(transfer, 'APPROVED', actor, note)
  await transfer.save()

  await recordAudit({
    tenantId: requireOrganisation(),
    actorId: actor.id,
    action: 'ANIMAL_TRANSFER_APPROVED',
    entity: 'AnimalTransfer',
    entityId: transfer._id,
    detail: `${transfer.animalIdentifier} · ${transfer.ref}`,
  })

  return transfer.toObject()
}

/** Refuses one, with a reason. Same roles as approval. */
export async function rejectTransfer(actor: TransferActor, id: string, reason: string) {
  if (!reason?.trim()) throw ApiError.badRequest('A rejected transfer needs a reason.')

  const rules = await rulesFor()
  const transfer = await AnimalTransfer.findById(id)
  if (!transfer) throw ApiError.notFound('No such transfer order.')
  if (transfer.status !== 'REQUESTED') {
    throw ApiError.unprocessable(`${transfer.ref} is ${transfer.status.toLowerCase()} and cannot be rejected.`)
  }
  if (!may(rules.approvers, actor.role)) {
    throw ApiError.forbidden('Your role does not decide transfer orders.')
  }

  transfer.status = 'REJECTED'
  log(transfer, 'REJECTED', actor, reason)
  await transfer.save()
  return transfer.toObject()
}

/**
 * The animal leaves. §11.2: *"transport driver executes only after approval confirmed."*
 *
 * This is the step that takes the animal out of service, and the only one that does.
 */
export async function departTransfer(actor: TransferActor, id: string) {
  const transfer = await AnimalTransfer.findById(id)
  if (!transfer) throw ApiError.notFound('No such transfer order.')

  if (transfer.status !== 'APPROVED') {
    throw ApiError.unprocessable(
      transfer.status === 'REQUESTED'
        ? `${transfer.ref} has not been approved yet — the driver waits for that.`
        : `${transfer.ref} is ${transfer.status.toLowerCase()}.`,
    )
  }

  /* The named driver, or anybody who may approve — a driver can fall ill. */
  const rules = await rulesFor()
  const named = !transfer.driverId || transfer.driverId === actor.id
  if (!named && !may(rules.approvers, actor.role)) {
    throw ApiError.forbidden(`${transfer.ref} is assigned to ${transfer.driverName || 'another driver'}.`)
  }

  const animal = await AssetUnit.findById(transfer.animalId)
  if (!animal) throw ApiError.notFound('That animal no longer exists.')
  if (animal.currentBookingId) {
    throw ApiError.unprocessable(`${animal.identifier} is in a session — it cannot leave until that finishes.`)
  }

  animal.status = 'TRANSFERRED'
  await animal.save()

  transfer.status = 'IN_TRANSIT'
  transfer.departedAt = new Date()
  log(transfer, 'DEPARTED', actor)
  await transfer.save()

  return transfer.toObject()
}

/**
 * The animal arrives. §7.4: *"transport driver or receiving supervisor confirms receipt."*
 */
export async function receiveTransfer(actor: TransferActor, id: string, arriveAs: 'AVAILABLE' | 'RESTING' = 'RESTING') {
  const transfer = await AnimalTransfer.findById(id)
  if (!transfer) throw ApiError.notFound('No such transfer order.')
  if (transfer.status !== 'IN_TRANSIT') {
    throw ApiError.unprocessable(`${transfer.ref} is ${transfer.status.toLowerCase()} — nothing to receive.`)
  }

  /*
   * §7.4 names two: the driver who carried it, and the receiving supervisor.
   *
   * ASSUMPTION (A-4): a project manager, an activity manager and the tenant administrator can
   * also sign for an arrival. The specification does not name them, and this widening is here
   * because an animal that has physically arrived must be able to be taken onto the books even
   * when the one named supervisor is not on shift — leaving it IN_TRANSIT would take a working
   * animal out of service for no reason.
   *
   * It is deliberately not configuration: unlike who *approves*, which §7.4 and §11.2
   * contradict each other on, nothing in the document disagrees about who receives. If the
   * client wants this narrowed to the letter of §7.4, remove the three added roles.
   */
  const RECEIVERS: Role[] = ['SUPERVISOR', 'PROJECT_MANAGER', 'TENANT_ADMIN', 'MANAGER']
  const receiver = transfer.driverId === actor.id || RECEIVERS.includes(actor.role)
  if (!receiver) {
    throw ApiError.forbidden('Receipt is confirmed by the driver who carried it or by a supervisor at the destination.')
  }

  const animal = await AssetUnit.findById(transfer.animalId)
  if (!animal) throw ApiError.notFound('That animal no longer exists.')

  animal.stationId = transfer.toStationId
  animal.status = arriveAs
  /*
   * Arriving to rest means resting for the species' own interval — and then working. Without an
   * end time the sweep would never return it, and a transferred animal would stay out of service.
   */
  animal.restingUntil =
    arriveAs === 'RESTING' ? new Date(Date.now() + restMinutesFor(animal.assetTypeId) * 60_000) : null
  if (arriveAs === 'RESTING') animal.note = `Resting after the journey (${transfer.ref}).`
  await animal.save()

  transfer.status = 'ARRIVED'
  transfer.arrivedAt = new Date()
  transfer.arriveAs = arriveAs
  log(transfer, 'RECEIVED', actor, `arrived as ${arriveAs.toLowerCase()}`)
  await transfer.save()

  await recordAudit({
    tenantId: requireOrganisation(),
    actorId: actor.id,
    action: 'ANIMAL_TRANSFER_RECEIVED',
    entity: 'AnimalTransfer',
    entityId: transfer._id,
    detail: `${transfer.animalIdentifier} arrived · ${transfer.ref}`,
  })

  return transfer.toObject()
}

/** Withdraws one before it leaves. Whoever raised it, or anybody who may approve. */
export async function cancelTransfer(actor: TransferActor, id: string, reason: string) {
  const transfer = await AnimalTransfer.findById(id)
  if (!transfer) throw ApiError.notFound('No such transfer order.')
  if (!['REQUESTED', 'APPROVED'].includes(transfer.status)) {
    throw ApiError.unprocessable(`${transfer.ref} has already departed and cannot be withdrawn.`)
  }

  const rules = await rulesFor()
  if (transfer.requestedBy !== actor.id && !may(rules.approvers, actor.role)) {
    throw ApiError.forbidden('Only the person who raised a transfer, or somebody who may approve it, can withdraw it.')
  }

  transfer.status = 'CANCELLED'
  log(transfer, 'CANCELLED', actor, reason)
  await transfer.save()
  return transfer.toObject()
}

export async function listTransfers(status?: string) {
  return AnimalTransfer.find(status ? { status } : {})
    .sort({ createdAt: -1 })
    .limit(500)
    .lean()
}

/** The policy in force, so a screen can say who approves before somebody tries. */
export async function transferPolicy() {
  return rulesFor()
}
