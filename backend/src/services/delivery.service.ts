import { AssetUnit, Booking, DeliveryRequest, Station, User } from '../models/index.js'
import { recordAudit } from './audit.service.js'
import type { BookingHydrated } from '../models/booking.model.js'
import type { DeliveryRequestDoc } from '../models/delivery.model.js'
import type { Role } from '../domain/types.js'
import { ApiError } from '../utils/ApiError.js'
import { nextId } from './counter.service.js'
import { env } from '../config/env.js'

import {
  DEFAULT_DELIVERY_ASSET_KIND,
  DLV_ASSIGNED,
  DLV_DELIVERED,
  DLV_ORIGIN_AT_STORAGE,
  DLV_ORIGIN_CUSTOMER_CONTACT,
  DLV_PICKED_UP,
  DLV_REQUESTED,
  DELIVERY_TERMINAL,
  bagStatusFor,
  getDeliveryOperator,
  getDeliveryValidator,
  getDeliveryWorkflow,
  type DeliveryBagRef,
  type DeliveryContext,
  type DeliverySnapshot,
  type DeliveryStatus,
  } from '../domain/workflow.js'
import type {
  ApplyDeliveryParams,
  CourierScope,
  CreateDeliveryInput,
  DeliveryActor,
} from '../interfaces/index.js'
import type { Scope } from '../interfaces/index.js'

const ACTIVE_BOOKING_STATES = ['ACTIVE', 'OVERTIME']

const OPEN_STATES: DeliveryStatus[] = [
  DLV_REQUESTED,
  DLV_ASSIGNED,
  'RELEASE_REQUESTED',
  'RELEASE_APPROVED',
  DLV_PICKED_UP,
]

function toSnapshot(d: DeliveryRequestDoc): DeliverySnapshot {
  const iso = (v: Date | null | undefined) => (v ? new Date(v).toISOString() : null)
  return {
    _id: d._id,
    ref: d._id,
    tenantId: d.tenantId,
    siteId: d.siteId,
    stationId: d.stationId,
    kioskId: d.kioskId,
    bookingId: d.bookingId,
    bookingRef: d.bookingRef,
    customerId: d.customerId,
    customerName: d.customerName,
    customerPhone: d.customerPhone,
    destination: { address: d.destination.address, notes: d.destination.notes, contactPhone: d.destination.contactPhone },
    status: d.status,
    origin: d.origin,
    verifiedBy: d.verifiedBy,
    verifiedAt: iso(d.verifiedAt),
    requestedBy: d.requestedBy,
    requestedAt: iso(d.requestedAt) ?? new Date().toISOString(),
    assignedTo: d.assignedTo,
    assignedAt: iso(d.assignedAt),
    releaseRequestedAt: iso(d.releaseRequestedAt),
    releaseApprovedBy: d.releaseApprovedBy,
    releaseApprovedAt: iso(d.releaseApprovedAt),
    compartmentCode: d.compartmentCode,
    compartmentCodeExpiresAt: iso(d.compartmentCodeExpiresAt),
    pickedUpAt: iso(d.pickedUpAt),
    scannedBarcodes: d.scannedBarcodes ?? [],
    deliveredAt: iso(d.deliveredAt),
    failureReason: d.failureReason,
    timeline: (d.timeline ?? []).map((t) => ({
      status: t.status,
      at: new Date(t.at).toISOString(),
      by: t.by,
      note: t.note,
    })),
  }
}

function applySnapshot(doc: DeliveryRequestDoc, next: DeliverySnapshot): void {
  const date = (v: string | null) => (v ? new Date(v) : null)
  doc.status = next.status
  doc.assignedTo = next.assignedTo
  doc.assignedAt = date(next.assignedAt)
  doc.releaseRequestedAt = date(next.releaseRequestedAt)
  doc.releaseApprovedBy = next.releaseApprovedBy
  doc.releaseApprovedAt = date(next.releaseApprovedAt)
  doc.compartmentCode = next.compartmentCode
  doc.compartmentCodeExpiresAt = date(next.compartmentCodeExpiresAt)
  doc.pickedUpAt = date(next.pickedUpAt)
  doc.scannedBarcodes = next.scannedBarcodes
  doc.deliveredAt = date(next.deliveredAt)
  doc.failureReason = next.failureReason
  doc.timeline = next.timeline.map((t) => ({ status: t.status, at: new Date(t.at), by: t.by, note: t.note }))
}

export async function siteOfStation(tenantId: string, stationId: string): Promise<string> {
  const station = await Station.findOne({ _id: stationId, tenantId }).lean()
  if (!station) throw ApiError.notFound('Station not found.')
  return station.siteId
}

export async function courierScopeFrom(tenantId: string, stationId: string, userId: string, role: Role): Promise<CourierScope> {
  return { tenantId, stationId, siteId: await siteOfStation(tenantId, stationId), userId, role }
}

export async function createDeliveryRequest(scope: Scope, input: CreateDeliveryInput) {
  const booking = await Booking.findOne({ _id: input.bookingId, tenantId: scope.tenantId, stationId: scope.stationId })
  if (!booking) throw ApiError.notFound('Booking not found.')
  if (booking.engineKind !== 'SHOP_AND_DROP') {
    throw ApiError.badRequest('Only stored bags can be delivered.')
  }
  if (!ACTIVE_BOOKING_STATES.includes(booking.status)) {
    throw ApiError.unprocessable(`The bags must be in storage to arrange a delivery (this booking is ${booking.status}).`)
  }
  if (!booking.bags.length) throw ApiError.unprocessable('This booking has no bags.')

  const address = input.address.trim()
  if (!address) throw ApiError.badRequest('A delivery address is required.')

  const existing = await DeliveryRequest.findOne({
    tenantId: scope.tenantId,
    bookingId: booking._id,
    status: { $in: OPEN_STATES },
  }).lean()
  if (existing) throw ApiError.conflict(`A delivery (${existing._id}) is already open for this booking.`)

  let verifiedBy: string | null = null
  let verifiedAt: Date | null = null
  let verificationMethod: string | null = null
  if (input.origin === DLV_ORIGIN_CUSTOMER_CONTACT) {
    const proof = freshDeliveryProof(booking)
    if (!proof) {
      throw ApiError.unprocessable(
        'Verify the customer before opening a delivery they asked for by phone.',
        ['Send a code to the phone or email on the booking, or use the ID document fallback.'],
      )
    }
    proof.status = 'CONSUMED'
    proof.consumedAt = new Date()
    booking.markModified('verifications')
    verifiedBy = proof.verifiedBy
    verifiedAt = proof.verifiedAt
    verificationMethod = proof.method
  }

  const unitId = booking.assetUnitId ?? booking.session.assetUnitId ?? null
  const unit = unitId ? await AssetUnit.findOne({ _id: unitId, tenantId: scope.tenantId }).lean() : null
  const siteId = await siteOfStation(scope.tenantId, scope.stationId)
  const now = new Date()

  const doc = await DeliveryRequest.create({
    _id: await nextId('delivery'),
    tenantId: scope.tenantId,
    siteId,
    stationId: scope.stationId,
    kioskId: (booking.metadata?.kioskId as string | undefined) ?? unit?.kioskId ?? null,
    bookingId: booking._id,
    bookingRef: booking.ref,
    customerId: booking.customerId,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    destination: { address, notes: input.notes?.trim() ?? '', contactPhone: input.contactPhone?.trim() || booking.customerPhone },
    status: DLV_REQUESTED,
    origin: input.origin,
    verifiedBy,
    verifiedAt,
    verificationMethod,
    requestedBy: scope.agentId,
    requestedAt: now,
    assetUnitId: unitId,
    assetUnitIdentifier: unit?.identifier ?? null,
    fee: input.fee ?? 0,
    timeline: [{ status: DLV_REQUESTED, at: now, by: scope.agentId, note: `Requested (${input.origin === DLV_ORIGIN_AT_STORAGE ? 'at the desk' : 'by phone'})` }],
  })

  if (booking.isModified()) await booking.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'DELIVERY_REQUESTED',
    entity: 'Delivery',
    entityId: doc._id,
    detail: `${booking._id} → ${address}`,
  })

  return doc
}

function freshDeliveryProof(booking: BookingHydrated) {
  const now = Date.now()
  return booking.verifications.find(
    (v) =>
      v.purpose === 'DELIVERY_REQUEST' &&
      v.status === 'VERIFIED' &&
      !v.consumedAt &&
      new Date(v.expiresAt).getTime() > now,
  )
}

const sortNewest = { requestedAt: -1 as const }

export async function courierBoard(scope: CourierScope) {
  const [available, mine, history] = await Promise.all([
    DeliveryRequest.find({ tenantId: scope.tenantId, siteId: scope.siteId, status: DLV_REQUESTED, assignedTo: null })
      .sort(sortNewest)
      .limit(50)
      .lean(),
    DeliveryRequest.find({
      tenantId: scope.tenantId,
      assignedTo: scope.userId,
      status: { $nin: DELIVERY_TERMINAL },
    })
      .sort(sortNewest)
      .lean(),
    DeliveryRequest.find({ tenantId: scope.tenantId, assignedTo: scope.userId, status: { $in: DELIVERY_TERMINAL } })
      .sort(sortNewest)
      .limit(25)
      .lean(),
  ])
  return { available, mine, history }
}

export async function stationDeliveries(scope: Scope, opts: { status?: string; bookingId?: string } = {}) {
  const filter: Record<string, unknown> = { tenantId: scope.tenantId, stationId: scope.stationId }
  if (opts.status === 'open') filter.status = { $in: OPEN_STATES }
  else if (opts.status) filter.status = opts.status
  if (opts.bookingId) filter.bookingId = opts.bookingId
  return DeliveryRequest.find(filter).sort(sortNewest).limit(100).lean()
}

export async function deliveryDetail(tenantId: string, id: string, actor?: DeliveryActor) {
  const filter: Record<string, unknown> = { _id: id, tenantId }
  if (actor?.siteId) filter.siteId = actor.siteId
  else if (actor?.stationId) filter.stationId = actor.stationId
  const doc = await DeliveryRequest.findOne(filter).lean()
  if (!doc) throw ApiError.notFound('Delivery not found.')
  const revealBarcodes = actor ? actor.role !== 'DELIVERY_AGENT' : true
  const [booking, courier, requester] = await Promise.all([
    Booking.findOne({ _id: doc.bookingId, tenantId }).lean(),
    doc.assignedTo ? User.findOne({ _id: doc.assignedTo, tenantId }).lean() : null,
    User.findOne({ _id: doc.requestedBy, tenantId }).lean(),
  ])
  return {
    delivery: doc,
    bags: (booking?.bags ?? []).map((b) => ({
      index: b.index,
      barcode: revealBarcodes ? b.barcode : null,
      demoScan: !revealBarcodes && env.DEMO_SCANNER ? b.barcode : null,
      description: b.description,
      status: b.status,
    })),
    demoScanner: env.DEMO_SCANNER,
    booking: booking ? { _id: booking._id, ref: booking.ref, status: booking.status, productName: booking.productName } : null,
    courier: courier ? { _id: courier._id, fullName: courier.fullName, email: courier.email, phone: courier.phone } : null,
    requestedByName: requester?.fullName ?? doc.requestedBy,
  }
}

async function loadForActor(actor: DeliveryActor, id: string) {
  const filter: Record<string, unknown> = { _id: id, tenantId: actor.tenantId }
  if (actor.siteId) filter.siteId = actor.siteId
  else if (actor.stationId) filter.stationId = actor.stationId
  const doc = await DeliveryRequest.findOne(filter)
  if (!doc) throw ApiError.notFound('Delivery not found.')
  return doc
}

export function availableDeliveryTransitions(status: DeliveryStatus, role: Role) {
  const wf = getDeliveryWorkflow(DEFAULT_DELIVERY_ASSET_KIND)
  if (!wf) return []
  return wf.transitions
    .filter((t) => t.source.includes(status) && t.actors.includes(role))
    .map((t) => ({ code: t.code, label: t.label, target: t.target, style: t.style }))
}

export async function applyDeliveryTransition(params: ApplyDeliveryParams) {
  const { actor, id, code } = params
  const payload = params.payload ?? {}
  const now = params.now ?? new Date()

  const doc = await loadForActor(actor, id)

  const wf = getDeliveryWorkflow(DEFAULT_DELIVERY_ASSET_KIND)
  if (!wf) throw ApiError.unprocessable('No delivery workflow is registered.')
  const transition = wf.transitions.find((t) => t.code === code && t.source.includes(doc.status))
  if (!transition) {
    throw ApiError.unprocessable(`Transition "${code}" is not allowed from status "${doc.status}".`)
  }
  if (!transition.actors.includes(actor.role)) {
    throw ApiError.forbidden(`Role ${actor.role} may not perform "${code}".`)
  }

  const booking = await Booking.findOne({ _id: doc.bookingId, tenantId: actor.tenantId })
  const bags: DeliveryBagRef[] = (booking?.bags ?? []).map((b) => ({
    index: b.index,
    barcode: b.barcode,
    description: b.description,
    status: b.status,
  }))

  const ctx: DeliveryContext = {
    delivery: toSnapshot(doc),
    bags,
    payload: { ...payload, assetUnitId: doc.assetUnitId ?? undefined },
    actor: { id: actor.userId, role: actor.role },
    now,
  }

  const validator = getDeliveryValidator(DEFAULT_DELIVERY_ASSET_KIND)
  if (!validator) throw ApiError.unprocessable('No delivery validator is registered.')
  const validation = await validator(code, ctx)
  if (validation.errors.length) throw ApiError.unprocessable(`Cannot ${transition.label}.`, validation.errors)

  const operator = getDeliveryOperator(DEFAULT_DELIVERY_ASSET_KIND)
  if (!operator) throw ApiError.unprocessable('No delivery operator is registered.')
  const result = await operator(code, ctx)
  if (result.errors.length) throw ApiError.unprocessable(`Cannot ${transition.label}.`, result.errors)

  if (code === 'TO_ASSIGNED') {
    const claimed = await DeliveryRequest.updateOne(
      { _id: doc._id, tenantId: actor.tenantId, status: DLV_REQUESTED, assignedTo: null },
      { $set: { status: DLV_ASSIGNED, assignedTo: actor.userId, assignedAt: now, timeline: result.delivery.timeline.map((t) => ({ status: t.status, at: new Date(t.at), by: t.by, note: t.note })) } },
    )
    if (claimed.modifiedCount !== 1) throw ApiError.conflict('Another courier claimed this delivery first.')
  } else {
    applySnapshot(doc, result.delivery)
    await doc.save()
  }

  if (booking) await applyBookingEffects(booking, code, actor, result.delivery, now)

  for (const intent of result.assetIntents) {
    if (intent.op !== 'SET_STATUS') continue
    await AssetUnit.updateOne(
      { _id: intent.unitId, tenantId: actor.tenantId },
      { $set: { status: intent.status, currentBookingId: intent.currentBookingId ?? null } },
    )
  }

  for (const a of result.audits) {
    await recordAudit({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      action: a.action,
      entity: 'Delivery',
      entityId: doc._id,
      reason: a.reason,
      detail: a.detail,
    })
  }

  const fresh = await DeliveryRequest.findOne({ _id: doc._id, tenantId: actor.tenantId }).lean()
  return { delivery: fresh!, transition }
}

async function applyBookingEffects(
  booking: BookingHydrated,
  code: string,
  actor: DeliveryActor,
  delivery: DeliverySnapshot,
  now: Date,
) {
  const bagStatus = bagStatusFor(code)
  if (!bagStatus) return

  const from = booking.status
  for (const bag of booking.bags) bag.status = bagStatus

  if (code === 'TO_PICKED_UP') {
    booking.status = 'RETRIEVAL_IN_PROGRESS'
    booking.session.status = 'RETRIEVAL_IN_PROGRESS'
    booking.assetUnitId = null
    booking.session.assetUnitId = null
    booking.custody.push({ from: 'LOCKER', to: 'PORTER', at: now, note: `Collected by courier for ${delivery._id}` })
  } else if (code === 'TO_DELIVERED') {
    booking.status = 'COMPLETED'
    booking.session.status = 'COMPLETED'
    booking.session.chargeableEndedAt = booking.session.chargeableEndedAt ?? now
    booking.custody.push({ from: 'PORTER', to: 'CUSTOMER', at: now, note: `Delivered to ${delivery.destination.address}` })
  }

  booking.transitionLog.push({ code, from, to: booking.status, by: actor.userId, at: now, reason: `Delivery ${delivery._id}` })
  booking.markModified('bags')
  booking.markModified('session')
  booking.markModified('custody')
  booking.markModified('transitionLog')
  await booking.save()
}

export async function tenantDeliveries(tenantId: string, siteId?: string) {
  const filter: Record<string, unknown> = { tenantId }
  if (siteId) filter.siteId = siteId
  return DeliveryRequest.find(filter).sort(sortNewest).limit(200).lean()
}

export { DLV_DELIVERED, OPEN_STATES }
