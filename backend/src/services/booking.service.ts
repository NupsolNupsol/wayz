import { AssetUnit, Booking, Customer, Order, Payment, Receipt, Shift, type BagItem, type BookingDoc, type OrderLine } from '../models/index.js'
import { recordAudit } from './audit.service.js'
import type { BookingHydrated } from '../models/booking.model.js'
import type { DurationUnit, EngineKind, Role } from '../domain/types.js'
import { ApiError } from '../utils/ApiError.js'
import { computeTotals, makeBarcode, round2 } from '../utils/helpers.js'
import { packBags, priceQuote } from '../domain/packing.js'
import { OVERTIME_LINE_PRODUCT_ID, computeOvertime, describeOvertime, pendingOvertime } from '../domain/overtime.js'
import { DEFAULT_VAT_RATE, noVat, splitInclusive } from '../domain/tax.js'
import { getWorkflow, type TransitionPayload } from '../domain/workflow.js'
import { applyTransition, getAvailableTransitions, type PlaceContext } from './workflow.service.js'
import { formatId, nextId, nextSequence, pad } from './counter.service.js'
import { getProduct, getAssetType } from './catalogue.service.js'
import { getCustomer, phoneProofIsFresh, PHONE_PROOF_TTL_MIN } from './customer.service.js'
import { Gate, Tenant, User, Voucher } from '../models/index.js'
import type { CreateBookingInput, Scope } from '../interfaces/index.js'
import type { PaymentSplit } from '../interfaces/index.js'
import { CARD_SCHEMES } from '../domain/commission.js'
import { canWorkEngine, engineFilter, kioskFilter, reachableUnitFilter, scopeKiosk } from '../domain/access.js'
import { tenantRules } from './rules.service.js'
import { lineNameAr } from '../constants/messages.constants.js'
import { seatOnBoat, unseatFromBoat, seatsLeftOn } from './trip.service.js'
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

/**
 * Whose booking is this?
 *
 * Two answers, because a booking now touches two places. The desk that took the sale owns it —
 * the money, the customer, the cancellation. And the gate holding the locker owns the bags: the
 * customer comes back to the gate, not to the counter that served them, so the staff posted there
 * have to be able to open the booking and hand the bags over.
 *
 * Everyone else tied to a counter sees neither, which is the same fence as before.
 */
function mineToHandle(scope: Scope, booking: Pick<BookingDoc, 'kioskId' | 'gateId'>): boolean {
  const kiosk = kioskFilter(scope)
  if (kiosk === undefined) return true
  if (booking.kioskId === kiosk) return true
  return !!scope.gateId && booking.gateId === scope.gateId
}

async function loadBooking(scope: Scope, bookingId: string): Promise<BookingHydrated> {
  const booking = await Booking.findOne({ _id: bookingId, tenantId: scope.tenantId, stationId: scope.stationId })
  if (!booking) throw ApiError.notFound('Booking not found.')

  const mine = mineToHandle(scope, booking)

  /*
   * An activity a person does not work is not theirs to touch — unless the bags are in front of
   * them, in which case the place outranks the activity.
   *
   * Two ways that happens, and both are real. A mobility agent posted to a gate fetches Shop &
   * Drop bags out of its lockers, because that is where they are. And bags delivered to a desk to
   * be collected are that desk's to hand over, whatever it normally sells, because the customer
   * is standing at it and the bags are behind it.
   */
  if (!mine && !canWorkEngine(scope, booking.engineKind)) throw ApiError.notFound('Booking not found.')
  if (!mine) throw ApiError.notFound('Booking not found.')
  return booking
}

/**
 * Can this desk actually provide what is being sold?
 *
 * The check before the money is taken has to be scoped exactly the way the reservation is, or an
 * agent sells something, takes payment, and finds out at the reserve step that they cannot
 * provide it. What changed is what "this desk" reaches: its own counter for the things it hands
 * over itself, and the gates of its station for the lockers — a Shop & Drop counter holds none of
 * its own, and asking only about the counter would refuse every bag drop in the platform.
 */
async function assertDeskCanFulfil(
  scope: Scope,
  assetTypeId: string | null,
  quantity: number,
  productName: string,
): Promise<void> {
  if (!assetTypeId) return

  const gates = await Gate.find(
    { tenantId: scope.tenantId, stationId: scope.stationId, active: { $ne: false } },
    { _id: 1 },
  ).lean()
  const reach = reachableUnitFilter(scope, gates.map((g) => g._id)) ?? {}
  const base = { tenantId: scope.tenantId, stationId: scope.stationId, assetTypeId }

  const [owned, free, freeElsewhere] = await Promise.all([
    AssetUnit.countDocuments({ ...base, ...reach }),
    AssetUnit.countDocuments({ ...base, status: 'AVAILABLE', ...reach }),
    // What is free at this station but out of this desk's reach, so the agent can send the
    // customer somewhere that can serve them instead of guessing.
    scope.kioskId ? AssetUnit.countDocuments({ ...base, status: 'AVAILABLE', $nor: [reach] }) : 0,
  ])

  const elsewhere =
    freeElsewhere > 0 ? [`${freeElsewhere} are free elsewhere, but this desk cannot reach them.`] : []

  if (owned === 0) {
    throw ApiError.unprocessable(`${productName} is not set up where this desk can reach it.`, [
      'Ask a manager to add units for it at this desk or at one of its gates, under Assets.',
      ...elsewhere,
    ])
  }
  if (free < quantity) {
    throw ApiError.unprocessable(`No ${productName} is free for this desk right now.`, [
      `${owned} within reach, ${free} available — ${quantity} needed.`,
      ...elsewhere,
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
  // A lagoon trip is a ride, not a rental: no period is asked for and none is recorded, so nothing
  // counts down and nothing runs into overtime.
  const ridesOnly = input.engineKind === 'LAGOON'
  const durationMin = ridesOnly ? 0 : byTours ? tours * tourMinutes : (input.durationMin ?? 120)
  const quantity = input.quantity ?? 1

  const lines: OrderLine[] = []
  let productName = product.name
  let productNameAr = product.nameAr || product.name
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
    productNameAr = lineNameAr.bags(product.nameAr || product.name, bags.length)
    lines.push({
      productId: product._id,
      name: productName,
      nameAr: lineNameAr.bags(product.nameAr || product.name, bags.length),
      quantity: 1,
      unitPrice: round2(quote.amount),
      isDeposit: false,
      taxable: true,
    })

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
    productNameAr = byTours
      ? lineNameAr.tours(product.nameAr || product.name, tours)
      : lineNameAr.quantity(product.nameAr || product.name, quantity)
    const arabicProduct = product.nameAr || product.name
    lines.push({
      productId: product._id,
      name: soldAs,
      nameAr: byTours ? lineNameAr.tours(arabicProduct, tours) : lineNameAr.quantity(arabicProduct, quantity),
      quantity: 1,
      unitPrice: round2(unit * periods),
      isDeposit: false,
      taxable: true,
    })
    if (product.depositRequired > 0) {
      lines.push({
        productId: product._id,
        name: 'Refundable Deposit',
        nameAr: lineNameAr.deposit,
        quantity: 1,
        unitPrice: product.depositRequired,
        isDeposit: true,
        taxable: false,
      })
    }
    holdAssetTypeId = product.assetTypeId
  }

  await assertDeskCanFulfil(scope, holdAssetTypeId, holdQty, product.name)

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

  let lagoonBoat: { _id: string; identifier: string; free: number; seats: number } | null = null
  if (input.engineKind === 'LAGOON') {
    if (!input.unitId) {
      throw ApiError.badRequest('Choose the boat this party is boarding.')
    }
    const boat = await seatsLeftOn(scope, input.unitId)
    if (boat.assetTypeId !== product.assetTypeId) {
      throw ApiError.badRequest(`${boat.identifier} is not a ${product.name}.`)
    }
    const people = Math.max(1, Math.floor(Number((input.metadata ?? {}).visitors ?? quantity) || 1))
    if (people > boat.free) {
      throw ApiError.unprocessable(
        boat.free === 0
          ? `${boat.identifier} is full — pick another boat.`
          : `${boat.identifier} has ${boat.free} seat(s) left, and this party is ${people}.`,
      )
    }
    lagoonBoat = boat
  }

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
    productNameAr,
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
    assetUnitId: lagoonBoat?._id ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      assetTypeId: product.assetTypeId ?? undefined,
      deposit: product.depositRequired || undefined,
      ...(lagoonBoat ? { boat: lagoonBoat.identifier } : {}),
    },
  })

  if (lagoonBoat) {
    booking.session.assetUnitId = lagoonBoat._id
    booking.markModified('session')
    await booking.save()
  }

  return { booking, order }
}

export const DISCOUNT_LINE_PRODUCT_ID = 'DISCOUNT'

/**
 * Takes money off a sale that has not been paid yet. The reason comes from the tenant's own list,
 * so a new one is a settings change rather than a code change.
 */
export async function discountBooking(
  scope: Scope,
  bookingId: string,
  input: { reasonCode: string; percent?: number; amount?: number; note?: string; voucherCode?: string },
  /** A code redeemed at the desk carries its own authority: the batch decides the ceiling, not the desk's list. */
  systemReason?: { code: string; label: string; labelAr?: string; maxPercent: number },
) {
  const booking = await loadBooking(scope, bookingId)
  const order = await Order.findById(booking.orderId)
  if (!order) throw ApiError.notFound('Order not found.')
  if (order.status === 'PAID') throw ApiError.unprocessable('That sale is already paid — refund it instead.')

  const rules = await tenantRules(scope.tenantId)
  const reason =
    systemReason ?? rules.discountReasons.find((r) => r.code === input.reasonCode.trim().toUpperCase())
  if (!reason) throw ApiError.badRequest('Pick a reason from the list.')

  const chargeable = order.lines
    .filter((l) => !l.isDeposit && l.productId !== DISCOUNT_LINE_PRODUCT_ID)
    .reduce((sum, l) => sum + l.unitPrice * (l.quantity ?? 1), 0)
  if (chargeable <= 0) throw ApiError.unprocessable('There is nothing to discount on this sale.')

  const asked =
    input.percent !== undefined ? (chargeable * Math.max(0, Math.min(100, input.percent))) / 100 : round2(input.amount ?? 0)
  if (asked <= 0) throw ApiError.badRequest('Say how much comes off.')

  const ceiling = round2((chargeable * reason.maxPercent) / 100)
  if (asked > ceiling + 0.001) {
    throw ApiError.unprocessable(
      `${reason.label} allows at most ${reason.maxPercent}% (${ceiling.toFixed(2)}) off this sale.`,
    )
  }

  const off = round2(Math.min(asked, chargeable))
  const existing = order.lines.find((l) => l.productId === DISCOUNT_LINE_PRODUCT_ID)

  // A second discount would quietly replace the first. That is a nuisance for a hand-typed one and
  // a real loss for a code, which is spent and cannot be handed back — so one sale carries one
  // discount whenever a code is involved, on either side.
  if (existing) {
    const codeAlreadySpent = await Voucher.exists({ tenantId: scope.tenantId, bookingId: booking._id, status: 'REDEEMED' })
    if (systemReason || codeAlreadySpent) {
      throw ApiError.unprocessable('This sale already has a discount on it.', [
        `${existing.name} is already taking ${Math.abs(existing.unitPrice).toFixed(2)} off.`,
        codeAlreadySpent
          ? 'That came from a discount code, which has been spent — cancel the sale and start again to change it.'
          : 'Take that one off before applying another.',
      ])
    }
  }
  const name = off >= chargeable ? `Free — ${reason.label}` : `Discount — ${reason.label}`
  const arabicName = off >= chargeable
    ? lineNameAr.free(reason.labelAr || reason.label)
    : lineNameAr.discount(reason.labelAr || reason.label)

  if (existing) {
    existing.name = name
    existing.nameAr = arabicName
    existing.unitPrice = -off
    existing.quantity = 1
  } else {
    order.lines.push({ productId: DISCOUNT_LINE_PRODUCT_ID, name, nameAr: arabicName, quantity: 1, unitPrice: -off, isDeposit: false, taxable: true })
  }

  const tenant = await Tenant.findById(scope.tenantId).lean()
  Object.assign(order, computeTotals(order.lines, tenant?.vatRate ?? DEFAULT_VAT_RATE))
  await order.save()

  booking.baseAmount = order.subtotal
  booking.vatAmount = order.vat
  booking.totalAmount = order.total

  // Kept on the booking so it can be counted and reported, not dug out of a log line later.
  const givenBy = await User.findById(scope.agentId, { fullName: 1 }).lean()
  booking.discount = {
    amount: off,
    percent: Math.round((off / chargeable) * 1000) / 10,
    reasonCode: reason.code,
    reasonLabel: reason.label,
    note: input.note?.trim() ?? '',
    voucherCode: input.voucherCode ?? null,
    free: off >= chargeable,
    givenBy: scope.agentId,
    givenByName: givenBy?.fullName ?? '',
    at: new Date(),
  }
  booking.markModified('discount')
  await booking.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: off >= chargeable ? 'SALE_MADE_FREE' : 'SALE_DISCOUNTED',
    entity: 'Booking',
    entityId: booking._id,
    detail: `${booking.ref}: ${off.toFixed(2)} off (${reason.label})`,
    reason: input.note?.trim() || reason.label,
  })

  return { booking, order }
}

interface Payer {
  id: string
  name: string
  phone: string
  isPrimary: boolean
}

/**
 * Everyone paying towards this sale, the booking's own customer first.
 *
 * A split names a second person; anyone else on the splits is looked up so their name goes on
 * their payment and their identity can be checked before it is taken.
 */
async function resolvePayers(scope: Scope, booking: BookingHydrated, splits: PaymentSplit[]): Promise<Payer[]> {
  const primary: Payer = {
    id: booking.customerId,
    name: booking.customerName,
    phone: booking.customerPhone,
    isPrimary: true,
  }

  const others = [...new Set(splits.map((s) => s.payerId).filter((id): id is string => !!id && id !== booking.customerId))]
  if (others.length === 0) return [primary]
  if (others.length > 1) {
    throw ApiError.unprocessable('A sale can be split between two people, not more.', [
      'Take the rest as a separate sale.',
    ])
  }

  const found = await Customer.find({ _id: { $in: others }, tenantId: scope.tenantId }).lean()
  const missing = others.filter((id) => !found.some((c) => c._id === id))
  if (missing.length) throw ApiError.badRequest(`No customer ${missing.join(', ')} in this tenant.`)

  return [
    primary,
    ...found.map((c) => ({ id: c._id, name: c.name, phone: c.phone, isPrimary: false })),
  ]
}

/**
 * What was actually taken against a booking, and from whom.
 *
 * The invoice groups payments by method for the customer's copy; this is the desk's view — one row
 * per payment, so a sale split between two people shows both names and both amounts.
 */
export async function bookingPayments(scope: Scope, bookingId: string) {
  const booking = await loadBooking(scope, bookingId)
  const rows = await Payment.find({ tenantId: scope.tenantId, bookingId: booking._id })
    .sort({ createdAt: 1 })
    .lean()

  return rows.map((p) => ({
    _id: p._id,
    amount: p.amount,
    method: p.method,
    cardScheme: p.cardScheme,
    kind: p.kind,
    status: p.status,
    payerId: p.payerId ?? booking.customerId,
    payerName: p.payerName || booking.customerName,
    takenAt: p.createdAt,
  }))
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

  // The drawer comes first: it is the desk's own precondition, and being sent to confirm a customer
  // only to be told afterwards that the till is shut wastes the customer's time as well as the agent's.
  const cashOffered = splits.filter((s) => s.method === 'CASH').reduce((sum, x) => sum + x.amount, 0)
  const till = await tillForTransaction(scope, { cash: cashOffered > 0 })

  /**
   * Everyone whose money is being taken has to be confirmed first.
   *
   * A sale can be split between two people — a friend paying half — and the second payer is a
   * customer in their own right: their half goes on their name, so their identity is checked the
   * same way, with the same code and the same expiry. Skipping it for the second person would put
   * a stranger's name on a payment nobody verified.
   */
  const payers = await resolvePayers(scope, booking, splits)
  for (const payer of payers) {
    if (!payer.phone) continue
    if (await phoneProofIsFresh(scope.tenantId, payer.phone)) continue
    throw ApiError.unprocessable(
      payer.isPrimary ? 'Confirm the customer before taking their money.' : `Confirm ${payer.name} before taking their money.`,
      [
        `Send the code to ${payer.phone} and have them read it back — the confirmation lasts ${PHONE_PROOF_TTL_MIN} minutes.`,
      ],
    )
  }
  const payerById = new Map(payers.map((p) => [p.id, p]))

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

  const cash = cashOffered

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
        payerId: s.payerId ?? booking.customerId,
        payerName: payerById.get(s.payerId ?? booking.customerId)?.name ?? booking.customerName,
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

  if (booking.engineKind === 'LAGOON' && booking.assetUnitId) {
    await seatOnBoat(scope, {
      _id: booking._id,
      ref: booking.ref,
      customerName: booking.customerName,
      assetUnitId: booking.assetUnitId,
      metadata: booking.metadata as Record<string, unknown>,
    })
  }

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
  const arabicName = lineNameAr.overtime(state.chargeableHours)
  const tenant = await Tenant.findById(scope.tenantId).lean()

  if (existing) {
    existing.name = name
    existing.nameAr = arabicName
    existing.quantity = 1
    existing.unitPrice = round2(state.penaltyAmount)
  } else {
    order.lines.push({
      productId: OVERTIME_LINE_PRODUCT_ID,
      name,
      nameAr: arabicName,
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
    // A person at a desk, so the transitions that turn on where they stand are checked.
    at: placeOf(scope),
  })

  if (!hadChargeEnd && booking.session.chargeableEndedAt) {
    const penalty = await applyOvertimeCharge(scope, booking)
    if (penalty > 0) audits.push({ action: 'OVERTIME_CHARGE', detail: `${penalty}` })
    await settleWrongDesk(scope, booking, audits)
  }

  // A party that is cancelled leaves the boat it was seated on, so the captain's manifest matches
  // who is actually coming.
  if (booking.engineKind === 'LAGOON' && booking.status === 'CANCELLED') {
    await unseatFromBoat(scope, booking._id)
  }

  await writeAudits(scope.tenantId, scope.agentId, booking._id, audits)
  return booking
}

/**
 * Was this actually brought back to the wrong place?
 *
 * The penalty exists for a customer who takes a scooter from one gate and leaves it at another:
 * somebody has to walk it back, and the charge pays for that.
 *
 * Bags are the opposite case and must never be caught by it. A Shop & Drop counter sells the
 * storage and holds no lockers; the bags are carried to a gate and put away there, and the
 * customer returns to that gate to collect them. The desk on the booking is the counter that took
 * the money, which is a different place by design — so comparing it to where the handover happens
 * would charge a penalty on every single bag drop, for a journey nothing made.
 */
async function settleWrongDesk(scope: Scope, booking: BookingHydrated, audits: AuditIntent[]): Promise<boolean> {
  // Handed back at the gate its locker is in: exactly where it was left, and where it belongs.
  if (scope.gateId && booking.gateId === scope.gateId) return false

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
    nameAr: lineNameAr.wrongStation,
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

/**
 * Moves a unit to the desk that has just taken it back.
 *
 * A scooter returned to another gate now belongs to that gate — that is how a fleet actually
 * drifts around a venue. A locker is different: it is bolted to a wall in a gate and cannot be
 * carried to a counter, so one is never rehomed, however it came back.
 */
async function rehomeUnit(scope: Scope, unitId: string) {
  const unit = await AssetUnit.findOne({ _id: unitId, tenantId: scope.tenantId }, { gateId: 1 }).lean()
  if (unit?.gateId) return

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

export function availableTransitions(booking: BookingHydrated, roles: Role[], scope?: Scope) {
  return getAvailableTransitions(booking, roles, scope ? placeOf(scope) : undefined)
}

/** Where this member of staff stands, for the actions that depend on it. */
export function placeOf(scope: Scope): PlaceContext {
  return { kioskScoped: scopeKiosk(scope) !== null, gateId: scope.gateId ?? null }
}

export function listBookings(scope: Scope, filter?: { status?: string; engineKind?: EngineKind }) {
  const q: Record<string, unknown> = { tenantId: scope.tenantId, stationId: scope.stationId }
  if (filter?.status) q.status = filter.status
  const engines = engineFilter(scope, filter?.engineKind)
  const kiosk = kioskFilter(scope)

  if (kiosk !== undefined) {
    /*
     * A desk sees its own work, and a gate sees the bags standing in it.
     *
     * The second half is the point of a gate: the customer comes back to where their bags are,
     * which is a locker hall, not the counter that sold them the storage. Without it a mobility
     * agent posted to a gate would look at an empty board while the bags sat behind them.
     */
    if (scope.gateId) q.$or = [{ kioskId: kiosk }, { gateId: scope.gateId }]
    else q.kioskId = kiosk
    if (engines !== undefined && filter?.engineKind) q.engineKind = engines
  } else if (engines !== undefined) {
    q.engineKind = engines
  }

  return Booking.find(q).sort({ createdAt: -1 }).limit(200)
}

export { loadBooking }

function enginePrefix(k: EngineKind): string {
  return { SHOP_AND_DROP: 'SD', MOBILITY: 'MB', LAGOON: 'LG', COTE_RESTAURANT: 'CT', ANAAM: 'AN' }[k]
}
