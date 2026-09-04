import { AssetUnit, Booking, DeliveryRequest, Kiosk, Order, Station, Tenant, User } from '../models/index.js'
import { recordAudit } from './audit.service.js'
import { raise } from './notification.service.js'
import type { BookingHydrated } from '../models/booking.model.js'
import type { DeliveryRequestDoc, DeliveryStopDoc } from '../models/delivery.model.js'
import type { Role } from '../domain/types.js'
import { ApiError } from '../utils/ApiError.js'
import { nextId } from './counter.service.js'
import { computeTotals, round2 } from '../utils/helpers.js'
import { outstandingFor, settleOutstanding } from './booking.service.js'
import type { PaymentSplit } from '../interfaces/index.js'
import { DEFAULT_VAT_RATE } from '../domain/tax.js'
import { env } from '../config/env.js'

import {
  DEFAULT_DELIVERY_ASSET_KIND,
  DLV_ASSIGNED,
  DLV_CANCELLED,
  DLV_DELIVERED,
  DLV_FAILED,
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

export async function customerBagsElsewhere(scope: Scope, bookingId: string) {
  const booking = await Booking.findOne({ _id: bookingId, tenantId: scope.tenantId }).lean()
  if (!booking) throw ApiError.notFound('Booking not found.')

  const held = await Booking.find({
    tenantId: scope.tenantId,
    stationId: booking.stationId,
    customerId: booking.customerId,
    engineKind: 'SHOP_AND_DROP',
    status: { $in: ACTIVE_BOOKING_STATES },
    _id: { $ne: booking._id },
  })
    .sort({ createdAt: 1 })
    .lean()

  if (!held.length) return []

  const open = await DeliveryRequest.find({
    tenantId: scope.tenantId,
    status: { $in: OPEN_STATES },
    $or: [{ bookingId: { $in: held.map((b) => b._id) } }, { 'stops.bookingId': { $in: held.map((b) => b._id) } }],
  })
    .select({ bookingId: 1, stops: 1 })
    .lean()

  const spokenFor = new Set<string>()
  for (const d of open) {
    spokenFor.add(d.bookingId)
    for (const stop of d.stops ?? []) spokenFor.add(stop.bookingId)
  }

  const kiosks = await Kiosk.find({ tenantId: scope.tenantId }).lean()
  const kioskName = new Map(kiosks.map((k) => [k._id, k.name]))
  const unitIds = held.map((b) => b.reservation?.assetUnitId ?? b.assetUnitId).filter(Boolean) as string[]
  const units = await AssetUnit.find({ tenantId: scope.tenantId, _id: { $in: unitIds } }).lean()
  const unitName = new Map(units.map((u) => [u._id, u.identifier]))

  return held
    .filter((b) => !spokenFor.has(b._id))
    .map((b) => {
      const unitId = b.reservation?.assetUnitId ?? b.assetUnitId ?? null
      return {
        bookingId: b._id,
        bookingRef: b.ref,
        kioskId: b.kioskId ?? null,
        kioskName: b.kioskId ? (kioskName.get(b.kioskId) ?? b.kioskId) : '',
        stationId: b.stationId,
        assetUnitId: unitId,
        assetUnitIdentifier: unitId ? (unitName.get(unitId) ?? unitId) : null,
        bagCount: b.bags.length,
        storedAt: b.session?.startedAt ?? b.createdAt,
      }
    })
}

async function gatherExtraStops(scope: Scope, booking: BookingHydrated, bookingIds: string[]) {
  const wanted = [...new Set(bookingIds.filter((id) => id && id !== booking._id))]
  if (!wanted.length) return []

  const available = await customerBagsElsewhere(scope, booking._id)
  const byId = new Map(available.map((row) => [row.bookingId, row]))

  const bookings = await Booking.find({ tenantId: scope.tenantId, _id: { $in: wanted } }, { bags: 1 }).lean()
  const barcodesOf = new Map(bookings.map((b) => [b._id, b.bags.map((bag) => bag.barcode)]))

  return wanted.map((id) => {
    const row = byId.get(id)
    if (!row) {
      throw ApiError.unprocessable(
        `${id} is not one of this customer's stored bookings, or a delivery is already open on it.`,
      )
    }
    return {
      bookingId: row.bookingId,
      bookingRef: row.bookingRef,
      kioskId: row.kioskId,
      kioskName: row.kioskName,
      assetUnitId: row.assetUnitId,
      assetUnitIdentifier: row.assetUnitIdentifier,
      bagBarcodes: barcodesOf.get(id) ?? [],
      bagCount: row.bagCount,
      status: 'PENDING' as const,
      scannedBarcodes: [] as string[],
      collectedAt: null,
    }
  })
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

  const extras = await gatherExtraStops(scope, booking, input.alsoBookingIds ?? [])
  const kiosks = await Kiosk.find({ tenantId: scope.tenantId }, { name: 1 }).lean()
  const kioskNames = new Map(kiosks.map((k) => [k._id, k.name]))
  const homeKiosk = (booking.metadata?.kioskId as string | undefined) ?? unit?.kioskId ?? booking.kioskId ?? null

  const stops = [
    {
      bookingId: booking._id,
      bookingRef: booking.ref,
      kioskId: homeKiosk,
      kioskName: homeKiosk ? (kioskNames.get(homeKiosk) ?? homeKiosk) : '',
      assetUnitId: unitId,
      assetUnitIdentifier: unit?.identifier ?? null,
      bagBarcodes: booking.bags.map((b) => b.barcode),
      bagCount: booking.bags.length,
      status: 'PENDING' as const,
      scannedBarcodes: [],
      collectedAt: null,
    },
    ...extras,
  ]

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
    stops,
    timeline: [
      {
        status: DLV_REQUESTED,
        at: now,
        by: scope.agentId,
        note:
          stops.length > 1
            ? `Requested (${input.origin === DLV_ORIGIN_AT_STORAGE ? 'at the desk' : 'by phone'}) · ${stops.length} kiosks to call at`
            : `Requested (${input.origin === DLV_ORIGIN_AT_STORAGE ? 'at the desk' : 'by phone'})`,
      },
    ],
  })

  if (booking.isModified()) await booking.save()

  if (doc.fee > 0) await chargeDeliveryFee(scope.tenantId, booking, doc.fee)

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'DELIVERY_REQUESTED',
    entity: 'Delivery',
    entityId: doc._id,
    detail: `${booking._id} → ${address}`,
  })

  await raise({
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    title: 'A delivery is waiting for a courier',
    body:
      stops.length > 1
        ? `${doc._id}: ${booking.customerName} — ${stops.length} kiosks to call at, then ${address}.`
        : `${doc._id}: ${booking.customerName} — ${address}.`,
    level: 'info',
    audience: ['DELIVERY_AGENT'],
    link: `/deliveries/${doc._id}`,
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

const DELIVERY_FEE_LINE = 'DELIVERY_FEE'

async function chargeDeliveryFee(tenantId: string, booking: BookingHydrated, fee: number) {
  const order = await Order.findById(booking.orderId)
  if (!order) return

  const existing = order.lines.find((l) => l.productId === DELIVERY_FEE_LINE)
  if (existing) {
    existing.unitPrice = round2(fee)
    existing.quantity = 1
  } else {
    order.lines.push({
      productId: DELIVERY_FEE_LINE,
      name: 'Delivery to the customer',
      quantity: 1,
      unitPrice: round2(fee),
      isDeposit: false,
      taxable: true,
    })
  }

  const tenant = await Tenant.findById(tenantId).lean()
  Object.assign(order, computeTotals(order.lines, tenant?.vatRate ?? DEFAULT_VAT_RATE))
  order.status = 'AWAITING_PAYMENT'
  await order.save()
}

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

  const withDue = await Promise.all(
    mine.map(async (d) => ({ ...d, amountDue: await deliveryAmountDue(scope.tenantId, d) })),
  )

  return { available, mine: withDue, history }
}

export async function stationDeliveries(scope: Scope, opts: { status?: string; bookingId?: string } = {}) {
  const filter: Record<string, unknown> = { tenantId: scope.tenantId, stationId: scope.stationId }
  if (opts.status === 'open') filter.status = { $in: OPEN_STATES }
  else if (opts.status) filter.status = opts.status
  if (opts.bookingId) filter.bookingId = opts.bookingId

  const rows = await DeliveryRequest.find(filter).sort(sortNewest).limit(100).lean()
  return rows.map((row) => {
    const stop = (row.stops ?? []).find((s) => s.status === 'PENDING') ?? null
    return {
      ...row,
      activeStop: stop,
      atMyKiosk: stop ? stop.kioskId === (scope.kioskId ?? null) : row.kioskId === (scope.kioskId ?? null),
    }
  })
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
    stops: (doc.stops ?? []).map((stop) => ({
      bookingId: stop.bookingId,
      bookingRef: stop.bookingRef,
      kioskId: stop.kioskId,
      kioskName: stop.kioskName,
      assetUnitIdentifier: stop.assetUnitIdentifier,
      bagCount: stop.bagCount,
      status: stop.status,
      collectedAt: stop.collectedAt,
      active: stop.status === 'PENDING' && stop.bookingId === doc.bookingId,
    })),
    amountDue: await deliveryAmountDue(tenantId, doc),
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

  if (code === 'TO_CANCELLED' && actor.role === 'DELIVERY_AGENT') {
    const carrying = (doc.stops ?? []).filter((s) => s.status === 'COLLECTED')
    if (carrying.length) {
      throw ApiError.unprocessable('You are already carrying bags from this run.', [
        `${carrying.map((s) => s.kioskName).join(', ')} handed their bags over — finish the run, or call the desk so they can take them back.`,
      ])
    }
  }

  if (code === 'TO_DELIVERED') {
    const owed = await deliveryAmountDue(actor.tenantId, doc)
    if (owed > 0) {
      throw ApiError.unprocessable('Take the payment before handing the bags over.', [
        `The customer still owes ${owed.toFixed(2)} — collect it on the doorstep first.`,
      ])
    }
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

  if (code === 'TO_DELIVERED') {
    for (const stop of doc.stops ?? []) {
      if (stop.bookingId === doc.bookingId) continue
      const other = await Booking.findOne({ _id: stop.bookingId, tenantId: actor.tenantId })
      if (other) await applyBookingEffects(other, code, actor, result.delivery, now)
    }
  }

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

  if (code === 'TO_RELEASE_REQUESTED') {
    const stop = activeStop(doc)
    const kioskId = stop?.kioskId ?? doc.kioskId ?? null
    const unit = stop?.assetUnitIdentifier ?? doc.assetUnitIdentifier ?? ''
    const courier = await User.findOne({ _id: actor.userId, tenantId: actor.tenantId }, { fullName: 1 }).lean()
    await raise({
      tenantId: actor.tenantId,
      stationId: doc.stationId,
      kioskId,
      engineKind: 'SHOP_AND_DROP',
      title: 'A courier is at your desk',
      body: `${courier?.fullName ?? 'A courier'} is asking for ${doc.customerName}'s bags${unit ? ` in ${unit}` : ''} — check their ID and give them the code.`,
      level: 'warning',
      audience: ['AGENT'],
      link: `/deliveries/${doc._id}`,
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

export async function collectOnDelivery(scope: CourierScope, deliveryId: string, splits: PaymentSplit[]) {
  const delivery = await DeliveryRequest.findOne({ _id: deliveryId, tenantId: scope.tenantId })
  if (!delivery) throw ApiError.notFound('Delivery not found.')
  if (!delivery.assignedTo) {
    throw ApiError.unprocessable('Pick this task up before taking any money for it.')
  }
  if (delivery.assignedTo !== scope.userId) {
    throw ApiError.forbidden('That delivery is being carried by somebody else.')
  }
  if (delivery.status === DLV_CANCELLED || delivery.status === DLV_FAILED) {
    throw ApiError.unprocessable(`This delivery is ${delivery.status.toLowerCase()} — there is nothing to hand over.`)
  }

  const ids = [...new Set([delivery.bookingId, ...(delivery.stops ?? []).map((s) => s.bookingId)])]
  const courierScope = {
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    kioskId: null,
    agentId: scope.userId,
    role: scope.role,
    engineKinds: [],
  }

  const owedTotal = await deliveryAmountDue(scope.tenantId, delivery)
  const offered = round2(splits.reduce((sum, s) => sum + (s.amount || 0), 0))
  if (Math.abs(offered - owedTotal) > 0.01) {
    throw ApiError.badRequest(`Payment ${offered} does not cover the ${owedTotal} outstanding across this run.`)
  }

  const method = splits[0]
  let collected = 0

  for (const id of ids) {
    const owed = await outstandingFor(scope.tenantId, id)
    if (owed <= 0) continue

    const booking = await Booking.findOne({ _id: id, tenantId: scope.tenantId })
    if (!booking) continue

    const paid = await settleOutstanding(courierScope, booking, [
      { method: method.method, cardScheme: method.cardScheme ?? null, amount: owed },
    ])
    collected = round2(collected + paid.collected)
  }

  const result = { collected, due: await deliveryAmountDue(scope.tenantId, delivery) }

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'DELIVERY_PAYMENT_COLLECTED',
    entity: 'Delivery',
    entityId: delivery._id,
    detail: `${result.collected} collected on ${delivery.bookingRef}`,
  })

  return { delivery: delivery.toObject(), collected: result.collected, due: result.due }
}

export async function deliveryAmountDue(
  tenantId: string,
  delivery: { bookingId: string; stops?: { bookingId: string }[] },
): Promise<number> {
  const ids = [...new Set([delivery.bookingId, ...(delivery.stops ?? []).map((s) => s.bookingId)])]
  const each = await Promise.all(ids.map((id) => outstandingFor(tenantId, id)))
  return round2(each.reduce((sum, owed) => sum + owed, 0))
}

export function activeStop(doc: { stops?: DeliveryStopDoc[] }) {
  return (doc.stops ?? []).find((s) => s.status === 'PENDING') ?? null
}

export async function collectStop(actor: DeliveryActor, id: string, input: { scannedBarcodes: string[] }) {
  const doc = await loadForActor(actor, id)
  const stops = doc.stops ?? []
  if (stops.length === 0) {
    return (await applyDeliveryTransition({ actor, id, code: 'TO_PICKED_UP', payload: { scannedBarcodes: input.scannedBarcodes } })).delivery
  }

  const current = activeStop(doc)
  if (!current) throw ApiError.unprocessable('Every kiosk on this delivery has already been collected.')

  await applyDeliveryTransition({ actor, id, code: 'TO_PICKED_UP', payload: { scannedBarcodes: input.scannedBarcodes } })

  const fresh = await DeliveryRequest.findOne({ _id: id, tenantId: actor.tenantId })
  if (!fresh) throw ApiError.notFound('Delivery not found.')

  const now = new Date()
  const stop = (fresh.stops ?? []).find((s) => s.bookingId === current.bookingId)
  if (stop) {
    stop.status = 'COLLECTED'
    stop.scannedBarcodes = input.scannedBarcodes.map((s) => String(s).trim())
    stop.collectedAt = now
  }

  const next = (fresh.stops ?? []).find((s) => s.status === 'PENDING')
  if (next) {
    fresh.status = DLV_ASSIGNED
    fresh.bookingId = next.bookingId
    fresh.bookingRef = next.bookingRef
    fresh.kioskId = next.kioskId
    fresh.assetUnitId = next.assetUnitId
    fresh.assetUnitIdentifier = next.assetUnitIdentifier
    fresh.releaseRequestedAt = null
    fresh.releaseApprovedBy = null
    fresh.releaseApprovedAt = null
    fresh.compartmentCode = null
    fresh.compartmentCodeExpiresAt = null
    fresh.pickedUpAt = null
    fresh.scannedBarcodes = []
    fresh.timeline.push({
      status: DLV_ASSIGNED,
      at: now,
      by: actor.userId,
      note: `Collected at ${stop?.kioskName ?? current.kioskName} — next stop ${next.kioskName}`,
    })
  }

  fresh.markModified('stops')
  await fresh.save()

  await recordAudit({
    tenantId: actor.tenantId,
    actorId: actor.userId,
    action: 'DELIVERY_STOP_COLLECTED',
    entity: 'Delivery',
    entityId: fresh._id,
    detail: `${current.kioskName} · ${input.scannedBarcodes.length} bag(s)${next ? ` · next ${next.kioskName}` : ' · all collected'}`,
  })

  return fresh.toObject()
}
