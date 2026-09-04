import {
  AssetUnit,
  Booking,
  Order,
  Payment,
  Receipt,
  Shift,
  type BagItem,
  type BookingDoc,
  type OrderLine,
} from '../models/index.js'
import { recordAudit } from './audit.service.js'
import type { BookingHydrated } from '../models/booking.model.js'
import type { DurationUnit, EngineKind, Role } from '../domain/types.js'
import { ApiError } from '../utils/ApiError.js'
import { computeTotals, makeBarcode, round2 } from '../utils/helpers.js'
import { packBags, priceQuote } from '../domain/packing.js'
import { OVERTIME_LINE_PRODUCT_ID, computeOvertime, describeOvertime, pendingOvertime } from '../domain/overtime.js'
import { DEFAULT_VAT_RATE, noVat, splitInclusive } from '../domain/tax.js'
import { getWorkflow, type TransitionPayload } from '../domain/workflow.js'
import { applyTransition, getAvailableTransitions } from './workflow.service.js'
import { formatId, nextId, nextSequence, pad } from './counter.service.js'
import { getProduct, getAssetType } from './catalogue.service.js'
import { getCustomer } from './customer.service.js'
import { Tenant } from '../models/index.js'
import type { CreateBookingInput, Scope } from '../interfaces/index.js'
import type { PaymentSplit } from '../interfaces/index.js'
import { CARD_SCHEMES } from '../domain/commission.js'
import { canWorkEngine, engineFilter, kioskFilter } from '../domain/access.js'
import { tenantRules } from './rules.service.js'
import { raise } from './notification.service.js'
import { tillForTransaction } from './shift.service.js'
import { FLOOR_LEADS } from '../domain/roles.js'

const UNIT_MINUTES: Record<DurationUnit, number> = { HOUR: 60, DAY: 1440, HALF_HOUR: 30, FIFTEEN_MIN: 15 }

function periodsFor(durationMin: number, unit?: DurationUnit): number {
  return Math.max(1, Math.ceil(durationMin / (unit ? UNIT_MINUTES[unit] : 60)))
}

interface AuditIntent {
  action: string
  reason?: string
  detail?: string
}

async function writeAudits(tenantId: string, actorId: string, entityId: string, audits: AuditIntent[]) {
  for (const a of audits) {
    await recordAudit({ tenantId, actorId, action: a.action, entity: 'Booking', entityId, reason: a.reason, detail: a.detail })
  }
}

async function loadBooking(scope: Scope, bookingId: string): Promise<BookingHydrated> {
  const booking = await Booking.findOne({ _id: bookingId, tenantId: scope.tenantId, stationId: scope.stationId })
  if (!booking) throw ApiError.notFound('Booking not found.')
  if (!canWorkEngine(scope, booking.engineKind)) throw ApiError.notFound('Booking not found.')
  const kiosk = kioskFilter(scope)
  if (kiosk !== undefined && booking.kioskId !== kiosk) throw ApiError.notFound('Booking not found.')
  return booking
}

async function assertStationCanFulfil(
  scope: Scope,
  assetTypeId: string | null,
  quantity: number,
  productName: string,
): Promise<void> {
  if (!assetTypeId) return

  const [owned, free] = await Promise.all([
    AssetUnit.countDocuments({ tenantId: scope.tenantId, stationId: scope.stationId, assetTypeId }),
    AssetUnit.countDocuments({ tenantId: scope.tenantId, stationId: scope.stationId, assetTypeId, status: 'AVAILABLE' }),
  ])

  if (owned === 0) {
    throw ApiError.unprocessable(`${productName} is not set up at this station.`, [
      'Ask a manager to add units for it under Assets, or serve the customer from a station that has them.',
    ])
  }
  if (free < quantity) {
    throw ApiError.unprocessable(`No ${productName} is free right now.`, [
      `${owned} at this station, ${free} available — ${quantity} needed.`,
    ])
  }
}

export async function createBooking(scope: Scope, input: CreateBookingInput) {
  if (!canWorkEngine(scope, input.engineKind)) {
    throw ApiError.forbidden('You are not assigned to that activity.')
  }
  const product = await getProduct(scope.tenantId, input.productId)
  if (!product) throw ApiError.notFound('Product not found.')
  if (product.engineKind !== input.engineKind) throw ApiError.badRequest('Product does not belong to that engine.')
  const customer = await getCustomer(scope.tenantId, input.customerId)
  const tenant = await Tenant.findById(scope.tenantId).lean()
  const vatRate = tenant?.vatRate ?? DEFAULT_VAT_RATE
  const wf = getWorkflow(input.engineKind)
  if (!wf) throw ApiError.unprocessable(`No workflow registered for engine "${input.engineKind}".`)
  const rules = await tenantRules(scope.tenantId)

  const byTours = input.rateMode === 'TOURS'
  const tours = Math.max(1, Math.floor(input.tours ?? input.quantity ?? 1))
  if (byTours && !(product.tourPrice && product.tourPrice > 0)) {
    throw ApiError.unprocessable(`${product.name} is not sold by the tour — price it by the hour, or give it a tour price.`)
  }

  const tourMinutes = product.tourMinutes ?? 60
  const durationMin = byTours ? tours * tourMinutes : (input.durationMin ?? 120)
  const quantity = input.quantity ?? 1

  const lines: OrderLine[] = []
  let productName = product.name
  let bags: BagItem[] = []
  let packingPlan: BookingDoc['packingPlan'] = null
  let holdAssetTypeId: string | null = null
  let holdQty = 1

  if (input.engineKind === 'SHOP_AND_DROP') {
    const bagInputs = input.bags ?? []
    if (bagInputs.length < 1) throw ApiError.badRequest('At least one bag is required for Shop & Drop.')
    if (!product.assetTypeId) throw ApiError.badRequest('Shop & Drop product has no asset type.')
    const assetType = await getAssetType(scope.tenantId, product.assetTypeId)
    if (!assetType) throw ApiError.badRequest('Asset type not found for product.')

    bags = bagInputs.map((b, i) => ({
      index: i + 1,
      category: b.category ?? 'SOFT',
      description: b.description ?? `Bag ${i + 1}`,
      dimensions: b.dimensions ?? { w: 30, h: 25, d: 20 },
      weight: b.weight ?? 3,
      barcode: makeBarcode(),
      status: 'REGISTERED',
      assignedUnitId: null,
    }))

    const packed = packBags(bags, assetType)
    const periods = periodsFor(durationMin, product.durationUnit)
    const quote = priceQuote(product.billingModel, product.basePrice, bags.length, packed.numberOfCompartmentsRequired, periods, product.basePrice)

    productName = `${product.name} (${bags.length} bag${bags.length > 1 ? 's' : ''})`
    lines.push({ productId: product._id, name: productName, quantity: 1, unitPrice: round2(quote.amount), isDeposit: false, taxable: true })

    packingPlan = {
      requiredCapacityScore: packed.requiredCapacityScore,
      suggestedAssetTypeId: assetType._id,
      numberOfCompartmentsRequired: packed.numberOfCompartmentsRequired,
      allocations: packed.allocations,
      priceCalculationSummary: quote.summary,
    }
    holdAssetTypeId = assetType._id
    holdQty = packed.numberOfCompartmentsRequired
  } else {
    const periods = byTours
      ? tours
      : product.billingModel === 'DURATION_BASED'
        ? periodsFor(durationMin, product.durationUnit)
        : quantity
    const unit = byTours ? (product.tourPrice ?? 0) : (product.hourlyPrice ?? product.basePrice)
    const soldAs = byTours
      ? `${product.name} — ${tours} tour${tours > 1 ? 's' : ''}`
      : `${product.name}${quantity > 1 ? ` × ${quantity}` : ''}`
    productName = soldAs
    lines.push({ productId: product._id, name: soldAs, quantity: 1, unitPrice: round2(unit * periods), isDeposit: false, taxable: true })
    if (product.depositRequired > 0) {
      lines.push({ productId: product._id, name: 'Refundable Deposit', quantity: 1, unitPrice: product.depositRequired, isDeposit: true, taxable: false })
    }
    holdAssetTypeId = product.assetTypeId
  }

  await assertStationCanFulfil(scope, holdAssetTypeId, holdQty, product.name)

  const totals = computeTotals(lines, vatRate)

  const [bookingSeq, orderSeq] = await Promise.all([
    nextSequence('booking'),
    nextSequence('order'),
  ])
  const bookingId = formatId('booking', bookingSeq)
  const orderRef = `INV-${pad(orderSeq)}`

  const order = await Order.create({
    _id: formatId('order', orderSeq),
    ref: orderRef,
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    kioskId: scope.kioskId ?? null,
    agentId: scope.agentId,
    customerId: input.customerId,
    engineKind: input.engineKind,
    lines,
    status: 'DRAFT',
    hold: holdAssetTypeId
      ? { assetTypeId: holdAssetTypeId, quantityRequired: holdQty, expiresAt: new Date(Date.now() + 10 * 60_000), status: 'ACTIVE' }
      : null,
    ...totals,
  })

  const booking = await Booking.create({
    _id: bookingId,
    ref: `${enginePrefix(input.engineKind)}-${pad(bookingSeq)}`,
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    kioskId: scope.kioskId ?? null,
    agentId: scope.agentId,
    orderId: order._id,
    customerId: input.customerId,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email ?? '',
    engineKind: input.engineKind,
    productName,
    baseAmount: totals.subtotal,
    vatAmount: totals.vat,
    totalAmount: totals.total,
    vatRate,
    status: 'DRAFT',
    bags,
    session: {
      kind: wf.sessionKind,
      status: 'DRAFT',
      requestedDurationMin: durationMin,
      gracePeriodMin: rules.rental.graceMin,
      overtimeHourlyRate: product.overtimeHourlyRate ?? product.basePrice,
      expiryWarningSentAt: null,
    },
    reservation: null,
    packingPlan,
    metadata: { ...(input.metadata ?? {}), assetTypeId: product.assetTypeId ?? undefined, deposit: product.depositRequired || undefined },
  })

  return { booking, order }
}

export async function payBooking(scope: Scope, bookingId: string, splits: PaymentSplit[]) {
  const booking = await loadBooking(scope, bookingId)
  const order = await Order.findById(booking.orderId)
  if (!order) throw ApiError.notFound('Order not found.')
  if (order.status === 'PAID') throw ApiError.badRequest('Order already paid.')
  if (booking.status !== 'DRAFT') throw ApiError.badRequest(`Cannot pay a booking in status ${booking.status}.`)

  const paid = round2(splits.reduce((s, x) => s + (x.amount || 0), 0))
  if (Math.abs(paid - order.total) > 0.01) {
    throw ApiError.badRequest(`Payment ${paid} does not cover the total ${order.total}.`)
  }

  for (const split of splits) {
    if (split.method === 'CASH' && split.cardScheme) {
      throw ApiError.badRequest('Cash has no card scheme — leave it blank.')
    }
    if (split.method === 'CARD') {
      if (!split.cardScheme) {
        throw ApiError.badRequest('Say which card was used — the bank charges a different commission for each.')
      }
      if (!CARD_SCHEMES.includes(split.cardScheme)) {
        throw ApiError.badRequest(`Unknown card scheme "${split.cardScheme}".`)
      }
    }
  }

  const cash = splits.filter((s) => s.method === 'CASH').reduce((s, x) => s + x.amount, 0)
  const till = await tillForTransaction(scope, { cash: cash > 0 })

  const vatRate = (await Tenant.findById(scope.tenantId).lean())?.vatRate ?? DEFAULT_VAT_RATE

  const paymentIds = await Promise.all(splits.map(() => nextId('payment')))
  await Payment.insertMany(
    splits.map((s, i) => {
      const kind = s.kind ?? 'SALE'
      const tax = kind === 'DEPOSIT' ? noVat(round2(s.amount)) : splitInclusive(round2(s.amount), vatRate)
      return {
        _id: paymentIds[i],
        tenantId: scope.tenantId,
        stationId: scope.stationId,
        kioskId: scope.kioskId ?? null,
        orderId: order._id,
        bookingId: booking._id,
        amount: tax.totalAmount,
        baseAmount: tax.baseAmount,
        vatAmount: tax.vatAmount,
        vatRate: tax.vatRate,
        engineKind: booking.engineKind,
        method: s.method,
        cardScheme: s.method === 'CARD' ? (s.cardScheme ?? null) : null,
        kind,
        status: 'CAPTURED',
        takenBy: scope.agentId,
        shiftId: till?._id ?? null,
      }
    }),
  )

  order.status = 'PAID'
  if (order.hold) order.hold.status = 'CONSUMED'
  await order.save()

  if (cash > 0 && till) {
    await Shift.updateOne({ _id: till._id }, { $inc: { expectedCash: round2(cash) } })
  }

  const receipt = await Receipt.create({
    _id: await nextId('receipt'),
    ref: order.ref,
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    orderId: order._id,
    bookingId: booking._id,
    kind: 'SALE',
    qrPayload: `ZATCA|${scope.tenantId.toUpperCase()}|${order.ref}|${order.total.toFixed(2)}`,
  })

  booking.session.paidAt = new Date()
  booking.markModified('session')
  await booking.save()

  const { audits } = await applyTransition({
    booking,
    code: 'TO_CONFIRMED',
    actor: { id: scope.agentId, role: scope.role },
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    kioskId: scope.kioskId ?? null,
  })
  await writeAudits(scope.tenantId, scope.agentId, booking._id, audits)

  return { booking, order, receipt }
}

async function overtimeState(scope: Scope, booking: BookingHydrated, at?: Date) {
  const rules = await tenantRules(scope.tenantId)
  return computeOvertime(
    {
      startedAt: booking.session.startedAt,
      expectedEndAt: booking.session.expectedEndAt,
      chargeableEndedAt: booking.session.chargeableEndedAt,
      gracePeriodMin: booking.session.gracePeriodMin,
      overtimeHourlyRate: booking.session.overtimeHourlyRate,
      overtimeBlockMin: rules.rental.overtimeBlockMin,
    },
    at,
  )
}

function expireIdentityProofs(booking: BookingHydrated): void {
  const now = new Date()
  let touched = false
  for (const proof of booking.verifications ?? []) {
    if (proof.purpose !== 'RETRIEVAL' || proof.status !== 'VERIFIED') continue
    if (new Date(proof.expiresAt).getTime() <= now.getTime()) continue
    proof.expiresAt = now
    touched = true
  }
  if (touched) booking.markModified('verifications')
}

async function applyOvertimeCharge(scope: Scope, booking: BookingHydrated): Promise<number> {
  const state = await overtimeState(scope, booking)
  if (!state.isOvertime || state.penaltyAmount <= 0) return 0

  const order = await Order.findById(booking.orderId)
  if (!order) return 0

  const existing = order.lines.find((l) => l.productId === OVERTIME_LINE_PRODUCT_ID)
  const charged = round2(state.penaltyAmount - (existing ? existing.unitPrice * (existing.quantity ?? 1) : 0))
  if (charged <= 0) return 0

  const name = `Overtime — ${state.chargeableHours} × 1h block${state.chargeableHours > 1 ? 's' : ''}`
  const tenant = await Tenant.findById(scope.tenantId).lean()

  if (existing) {
    existing.name = name
    existing.quantity = 1
    existing.unitPrice = round2(state.penaltyAmount)
  } else {
    order.lines.push({
      productId: OVERTIME_LINE_PRODUCT_ID,
      name,
      quantity: 1,
      unitPrice: round2(state.penaltyAmount),
      isDeposit: false,
      taxable: true,
    })
  }
  Object.assign(order, computeTotals(order.lines, tenant?.vatRate ?? DEFAULT_VAT_RATE))
  order.status = 'AWAITING_PAYMENT'
  await order.save()

  expireIdentityProofs(booking)
  if (booking.isModified('verifications')) await booking.save()

  await raise({
    tenantId: booking.tenantId,
    stationId: booking.stationId,
    kioskId: booking.kioskId,
    engineKind: booking.engineKind,
    title: 'Overtime penalty due',
    body: `${booking.ref}: ${describeOvertime(state, tenant?.currency ?? 'SAR')}. Collect before handover.`,
    level: 'warning',
    link: `/bookings/${booking._id}`,
  })

  return state.penaltyAmount
}

const HANDS_BACK = ['TO_RETRIEVAL', 'TO_COMPLETED', 'TO_SERVED', 'TO_RETURNED']

export async function transitionBooking(scope: Scope, bookingId: string, code: string, payload: TransitionPayload = {}) {
  const booking = await loadBooking(scope, bookingId)

  if (HANDS_BACK.includes(code)) {
    await applyOvertimeCharge(scope, booking)
    const outstanding = await amountDue(scope.tenantId, booking.orderId)
    if (outstanding > 0) {
      throw ApiError.unprocessable(`${outstanding.toFixed(2)} is still owed on this booking.`, [
        'Take the payment first — nothing goes back to the customer while money is outstanding.',
      ])
    }
  }

  const hadChargeEnd = !!booking.session.chargeableEndedAt
  const { audits } = await applyTransition({
    booking,
    code,
    payload,
    actor: { id: scope.agentId, role: scope.role },
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    kioskId: scope.kioskId ?? null,
  })

  if (!hadChargeEnd && booking.session.chargeableEndedAt) {
    const penalty = await applyOvertimeCharge(scope, booking)
    if (penalty > 0) audits.push({ action: 'OVERTIME_CHARGE', detail: `${penalty}` })
    await settleWrongDesk(scope, booking, audits)
  }

  await writeAudits(scope.tenantId, scope.agentId, booking._id, audits)
  return booking
}

async function settleWrongDesk(scope: Scope, booking: BookingHydrated, audits: AuditIntent[]): Promise<boolean> {
  const movedStation = booking.stationId !== scope.stationId
  const movedDesk = !!booking.kioskId && !!scope.kioskId && booking.kioskId !== scope.kioskId
  if (!movedStation && !movedDesk) return false

  const charged = await chargeWrongStation(scope, booking)
  if (booking.assetUnitId) await rehomeUnit(scope, booking.assetUnitId)

  audits.push({
    action: 'WRONG_STATION_RETURN',
    detail: `${booking.kioskId ?? booking.stationId} → ${scope.kioskId ?? scope.stationId} · ${charged}`,
  })

  booking.stationId = scope.stationId
  if (scope.kioskId) booking.kioskId = scope.kioskId
  await booking.save()

  return true
}

export async function outstandingFor(tenantId: string, bookingId: string): Promise<number> {
  const booking = await Booking.findOne({ _id: bookingId, tenantId })
  if (!booking) return 0

  const [order, settled, rules] = await Promise.all([
    Order.findById(booking.orderId, { lines: 1 }).lean(),
    amountDue(tenantId, booking.orderId),
    tenantRules(tenantId),
  ])

  const running = computeOvertime({
    startedAt: booking.session.startedAt,
    expectedEndAt: booking.session.expectedEndAt,
    chargeableEndedAt: booking.session.chargeableEndedAt,
    gracePeriodMin: booking.session.gracePeriodMin,
    overtimeHourlyRate: booking.session.overtimeHourlyRate,
    overtimeBlockMin: rules.rental.overtimeBlockMin,
  })

  return round2(settled + pendingOvertime(running, order?.lines ?? []))
}

export async function amountDue(tenantId: string, orderId: string): Promise<number> {
  const [order, paid] = await Promise.all([
    Order.findById(orderId).lean(),
    Payment.aggregate([
      { $match: { tenantId, orderId, status: 'CAPTURED' } },
      { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ['$kind', 'REFUND'] }, { $multiply: ['$amount', -1] }, '$amount'] } } } },
    ]),
  ])
  if (!order) return 0
  return round2(Math.max(0, order.total - (paid[0]?.total ?? 0)))
}

export async function settleBooking(scope: Scope, bookingId: string, splits: PaymentSplit[]) {
  return settleOutstanding(scope, await loadBooking(scope, bookingId), splits)
}

export async function settleOutstanding(scope: Scope, booking: BookingHydrated, splits: PaymentSplit[]) {
  await applyOvertimeCharge(scope, booking)

  const order = await Order.findById(booking.orderId)
  if (!order) throw ApiError.notFound('Order not found.')

  const due = await amountDue(scope.tenantId, order._id)
  if (due <= 0) throw ApiError.unprocessable('There is nothing left to collect on this booking.')

  const paid = round2(splits.reduce((sum, s) => sum + (s.amount || 0), 0))
  if (Math.abs(paid - due) > 0.01) {
    throw ApiError.badRequest(`Payment ${paid} does not cover the ${due} outstanding.`)
  }

  for (const split of splits) {
    if (split.method === 'CASH' && split.cardScheme) throw ApiError.badRequest('Cash has no card scheme — leave it blank.')
    if (split.method === 'CARD') {
      if (!split.cardScheme) throw ApiError.badRequest('Say which card was used — the bank charges a different commission for each.')
      if (!CARD_SCHEMES.includes(split.cardScheme)) throw ApiError.badRequest(`Unknown card scheme "${split.cardScheme}".`)
    }
  }

  const cash = splits.filter((s) => s.method === 'CASH').reduce((sum, s) => sum + s.amount, 0)
  const till = await tillForTransaction(scope, { cash: cash > 0 })

  const tenant = await Tenant.findById(scope.tenantId).lean()
  const vatRate = tenant?.vatRate ?? DEFAULT_VAT_RATE

  const paymentIds = await Promise.all(splits.map(() => nextId('payment')))
  await Payment.insertMany(
    splits.map((s, i) => {
      const tax = splitInclusive(round2(s.amount), vatRate)
      return {
        _id: paymentIds[i],
        tenantId: scope.tenantId,
        stationId: booking.stationId,
        kioskId: booking.kioskId ?? null,
        orderId: order._id,
        bookingId: booking._id,
        amount: tax.totalAmount,
        baseAmount: tax.baseAmount,
        vatAmount: tax.vatAmount,
        vatRate: tax.vatRate,
        engineKind: booking.engineKind,
        method: s.method,
        cardScheme: s.method === 'CARD' ? (s.cardScheme ?? null) : null,
        kind: 'OVERTIME',
        status: 'CAPTURED',
        takenBy: scope.agentId,
        shiftId: till?._id ?? null,
      }
    }),
  )

  if (cash > 0 && till) await Shift.updateOne({ _id: till._id }, { $inc: { expectedCash: round2(cash) } })

  order.status = 'PAID'
  await order.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'BOOKING_SETTLED',
    entity: 'Booking',
    entityId: booking._id,
    detail: `${paid} collected on ${order.ref}`,
  })

  return { booking, order: order.toObject(), collected: paid, due: await amountDue(scope.tenantId, order._id) }
}

export async function returnAtStation(scope: Scope, bookingId: string, code: string, payload: TransitionPayload = {}) {
  const booking = await Booking.findOne({ _id: bookingId, tenantId: scope.tenantId })
  if (!booking) throw ApiError.notFound('Booking not found.')
  if (!canWorkEngine(scope, booking.engineKind)) throw ApiError.notFound('Booking not found.')

  if (HANDS_BACK.includes(code)) {
    await applyOvertimeCharge(scope, booking)
    const outstanding = await amountDue(scope.tenantId, booking.orderId)
    if (outstanding > 0) {
      throw ApiError.unprocessable(`${outstanding.toFixed(2)} is still owed on this booking.`, [
        'Take the payment first — the rental cannot be closed while money is outstanding.',
      ])
    }
  }

  const hadChargeEnd = !!booking.session.chargeableEndedAt
  const { audits } = await applyTransition({
    booking,
    code,
    payload,
    actor: { id: scope.agentId, role: scope.role },
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    kioskId: scope.kioskId ?? null,
  })

  let wrongStation = false
  if (!hadChargeEnd && booking.session.chargeableEndedAt) {
    const penalty = await applyOvertimeCharge(scope, booking)
    if (penalty > 0) audits.push({ action: 'OVERTIME_CHARGE', detail: `${penalty}` })
    wrongStation = await settleWrongDesk(scope, booking, audits)
  }

  await writeAudits(scope.tenantId, scope.agentId, booking._id, audits)
  return { booking, wrongStation }
}

const WRONG_STATION_PRODUCT_ID = 'WRONG_STATION_PENALTY'

async function chargeWrongStation(scope: Scope, booking: BookingHydrated): Promise<number> {
  const rules = await tenantRules(scope.tenantId)
  const amount = rules.rental.wrongStationPenalty
  if (amount <= 0) return 0

  const order = await Order.findById(booking.orderId)
  if (!order) return 0
  if (order.lines.some((l) => l.productId === WRONG_STATION_PRODUCT_ID)) return 0

  const tenant = await Tenant.findById(scope.tenantId).lean()
  order.lines.push({
    productId: WRONG_STATION_PRODUCT_ID,
    name: 'Returned to a different station',
    quantity: 1,
    unitPrice: round2(amount),
    isDeposit: false,
    taxable: true,
  })
  Object.assign(order, computeTotals(order.lines, tenant?.vatRate ?? DEFAULT_VAT_RATE))
  order.status = 'AWAITING_PAYMENT'
  await order.save()

  await raise({
    tenantId: booking.tenantId,
    stationId: booking.stationId,
    kioskId: booking.kioskId,
    engineKind: booking.engineKind,
    title: 'Vehicle returned to another station',
    body: `${booking.ref} came back somewhere else. ${amount} ${tenant?.currency ?? 'SAR'} added to the order and the unit moved.`,
    level: 'warning',
    link: `/bookings/${booking._id}`,
  })
  return amount
}

async function rehomeUnit(scope: Scope, unitId: string) {
  await AssetUnit.updateOne(
    { _id: unitId, tenantId: scope.tenantId },
    { $set: { stationId: scope.stationId, kioskId: scope.kioskId ?? null } },
  )
}

export function reserveBooking(scope: Scope, bookingId: string, unitId?: string) {
  return transitionBooking(scope, bookingId, 'TO_RESERVED', { unitId })
}

export async function reassignBooking(scope: Scope, bookingId: string, unitId: string, reason: string) {
  const code = await replacementCode(scope, bookingId)
  const booking = await transitionBooking(scope, bookingId, code, { unitId, reason })

  const rules = await tenantRules(scope.tenantId)
  await raise({
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    kioskId: scope.kioskId,
    engineKind: booking.engineKind,
    title: 'Vehicle replaced',
    body: `${booking.ref}: swapped to ${unitId} — ${reason}. ${rules.rental.replacementBonusMin} min added to the rental.`,
    level: 'warning',
    audience: FLOOR_LEADS,
    link: `/bookings/${booking._id}`,
  })

  return booking
}

const REPLACEMENT_CODES = ['TO_REASSIGNED', 'TO_REPLACED']

async function replacementCode(scope: Scope, bookingId: string): Promise<string> {
  const booking = await loadBooking(scope, bookingId)
  const wf = getWorkflow(booking.engineKind)
  const available = (wf?.transitions ?? []).filter(
    (t) => REPLACEMENT_CODES.includes(t.code) && t.source.includes(booking.status),
  )
  if (!available.length) {
    throw ApiError.unprocessable(`Nothing can be swapped out from status "${booking.status}".`)
  }
  return available[0].code
}

export async function scanBagOut(scope: Scope, bookingId: string, barcode: string) {
  const booking = await loadBooking(scope, bookingId)
  if (booking.status !== 'RETRIEVAL_IN_PROGRESS') throw ApiError.badRequest('Booking is not in retrieval.')
  const bag = booking.bags.find((b) => b.barcode === barcode.trim())
  if (!bag) throw ApiError.unprocessable('Wrong bag — this barcode does not belong to this booking.')
  if (bag.status === 'RETRIEVED' || bag.status === 'DELIVERED') throw ApiError.badRequest('Bag already scanned out.')
  bag.status = 'RETRIEVED'
  booking.custody.push({ from: 'LOCKER', to: 'AGENT', at: new Date(), bagIndex: bag.index, note: `Bag ${bag.index} scanned out` })
  await booking.save()
  return booking
}

export async function getBookingOrder(scope: Scope, bookingId: string) {
  const booking = await loadBooking(scope, bookingId)
  const order = await Order.findById(booking.orderId).lean()
  if (!order) throw ApiError.notFound('Order not found.')
  return order
}

export function availableTransitions(booking: BookingHydrated, roles: Role[]) {
  return getAvailableTransitions(booking, roles)
}

export function listBookings(scope: Scope, filter?: { status?: string; engineKind?: EngineKind }) {
  const q: Record<string, unknown> = { tenantId: scope.tenantId, stationId: scope.stationId }
  if (filter?.status) q.status = filter.status
  const engines = engineFilter(scope, filter?.engineKind)
  if (engines !== undefined) q.engineKind = engines
  const kiosk = kioskFilter(scope)
  if (kiosk !== undefined) q.kioskId = kiosk
  return Booking.find(q).sort({ createdAt: -1 }).limit(200)
}

export { loadBooking }

function enginePrefix(k: EngineKind): string {
  return { SHOP_AND_DROP: 'SD', MOBILITY: 'MB', LAGOON: 'LG', COTE_RESTAURANT: 'CT', ANAAM: 'AN' }[k]
}
