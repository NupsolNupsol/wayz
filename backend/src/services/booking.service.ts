import {
  AssetUnit,
  Booking,
  Notification,
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
import { computeOvertime, describeOvertime, DEFAULT_GRACE_MINUTES } from '../domain/overtime.js'
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
import { canWorkEngine, engineFilter } from '../domain/access.js'

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
  return booking
}

/**
 * A station cannot sell what it has no unit for. Catching it here keeps the agent from
 * taking money for something that cannot be handed over.
 */
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

  const durationMin = input.durationMin ?? 120
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
    const periods = product.billingModel === 'DURATION_BASED' ? periodsFor(durationMin, product.durationUnit) : quantity
    const unit = product.basePrice
    lines.push({ productId: product._id, name: `${product.name}${quantity > 1 ? ` × ${quantity}` : ''}`, quantity: 1, unitPrice: round2(unit * periods), isDeposit: false, taxable: true })
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
      gracePeriodMin: DEFAULT_GRACE_MINUTES,
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
  const till = await Shift.findOne({
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    agentId: scope.agentId,
    status: 'OPEN',
  })
  if (cash > 0 && !till) {
    throw ApiError.unprocessable('Open your till before taking cash.', [
      'Go to Shift and open one — cash taken without an open till cannot be reconciled at the end of the day.',
    ])
  }

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

  if (cash > 0) {
    await Shift.updateOne({ _id: till!._id }, { $inc: { expectedCash: round2(cash) } })
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

  const { audits } = await applyTransition({
    booking,
    code: 'TO_CONFIRMED',
    actor: { id: scope.agentId, role: scope.role },
    tenantId: scope.tenantId,
    stationId: scope.stationId,
  })
  await writeAudits(scope.tenantId, scope.agentId, booking._id, audits)

  return { booking, order, receipt }
}

const OVERTIME_LINE_PRODUCT_ID = 'OVERTIME_PENALTY'

async function applyOvertimeCharge(scope: Scope, booking: BookingHydrated): Promise<number> {
  const state = computeOvertime(booking.session)
  if (!state.isOvertime || state.penaltyAmount <= 0) return 0

  const order = await Order.findById(booking.orderId)
  if (!order) return 0
  if (order.lines.some((l) => l.productId === OVERTIME_LINE_PRODUCT_ID)) return 0

  const tenant = await Tenant.findById(scope.tenantId).lean()
  order.lines.push({
    productId: OVERTIME_LINE_PRODUCT_ID,
    name: `Overtime — ${state.chargeableHours} × 1h block${state.chargeableHours > 1 ? 's' : ''}`,
    quantity: 1,
    unitPrice: round2(state.penaltyAmount),
    isDeposit: false,
    taxable: true,
  })
  Object.assign(order, computeTotals(order.lines, tenant?.vatRate ?? DEFAULT_VAT_RATE))
  order.status = 'AWAITING_PAYMENT'
  await order.save()

  await Notification.create({
    tenantId: booking.tenantId,
    stationId: booking.stationId,
    title: 'Overtime penalty due',
    body: `${booking.ref}: ${describeOvertime(state, tenant?.currency ?? 'SAR')}. Collect before handover.`,
    level: 'warning',
  })

  return state.penaltyAmount
}

export async function transitionBooking(scope: Scope, bookingId: string, code: string, payload: TransitionPayload = {}) {
  const booking = await loadBooking(scope, bookingId)

  const hadChargeEnd = !!booking.session.chargeableEndedAt
  const { audits } = await applyTransition({
    booking,
    code,
    payload,
    actor: { id: scope.agentId, role: scope.role },
    tenantId: scope.tenantId,
    stationId: scope.stationId,
  })

  if (!hadChargeEnd && booking.session.chargeableEndedAt) {
    const penalty = await applyOvertimeCharge(scope, booking)
    if (penalty > 0) audits.push({ action: 'OVERTIME_CHARGE', detail: `${penalty}` })
  }

  await writeAudits(scope.tenantId, scope.agentId, booking._id, audits)
  return booking
}

export function reserveBooking(scope: Scope, bookingId: string, unitId?: string) {
  return transitionBooking(scope, bookingId, 'TO_RESERVED', { unitId })
}

export function reassignBooking(scope: Scope, bookingId: string, unitId: string, reason: string) {
  return transitionBooking(scope, bookingId, 'TO_REASSIGNED', { unitId, reason })
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
  return Booking.find(q).sort({ createdAt: -1 }).limit(200)
}

export { loadBooking }

function enginePrefix(k: EngineKind): string {
  return { SHOP_AND_DROP: 'SD', MOBILITY: 'MB', LAGOON: 'LG', COTE_RESTAURANT: 'CT', ANAAM: 'AN' }[k]
}
