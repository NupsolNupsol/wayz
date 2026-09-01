import {
  Booking,
  CashMovement,
  CASH_MOVEMENT_KINDS,
  MOVEMENT_SIGN,
  Customer,
  Order,
  Payment,
  Receipt,
  Shift,
  Tenant,
  User,
  type CashMovementKind,
} from '../models/index.js'
import { recordAudit } from './audit.service.js'
import { ApiError } from '../utils/ApiError.js'
import type { BookingHydrated } from '../models/booking.model.js'
import type { PaymentHydrated } from '../models/payment.model.js'
import { engineFilter } from '../domain/access.js'
import { round2 } from '../utils/helpers.js'
import { nextId } from './counter.service.js'
import { DEFAULT_VAT_RATE, noVat, splitInclusive } from '../domain/tax.js'

import type { DrawerBreakdown, MovementInput, RefundInput, TransactionFilters } from '../interfaces/index.js'
import type { Scope } from '../interfaces/index.js'

export async function openTill(scope: Scope) {
  return Shift.findOne({
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    agentId: scope.agentId,
    status: { $ne: 'CLOSED' },
  })
}

export async function requireOpenTill(scope: Scope) {
  const shift = await openTill(scope)
  if (!shift) {
    throw ApiError.unprocessable('Open your till before handling cash.', [
      'Go to Shift and open one — cash taken without a till cannot be reconciled at the end of the day.',
    ])
  }
  if (shift.status === 'RECONCILING') {
    throw ApiError.unprocessable('This till is awaiting a supervisor. It cannot take more cash until the variance is resolved.')
  }
  return shift
}

export async function drawer(scope: Scope, shiftId?: string): Promise<DrawerBreakdown | null> {
  const shift = shiftId
    ? await Shift.findOne({ _id: shiftId, tenantId: scope.tenantId, stationId: scope.stationId })
    : await openTill(scope)
  if (!shift) return null

  const [movements, payments] = await Promise.all([
    CashMovement.find({ tenantId: scope.tenantId, shiftId: shift._id }).lean(),
    Payment.find({
      tenantId: scope.tenantId,
      shiftId: shift._id,
      status: { $in: ['CAPTURED', 'REFUNDED'] },
    }).lean(),
  ])

  const sum = (rows: { amount: number }[]) => round2(rows.reduce((t, r) => t + r.amount, 0))
  const ofKind = (kind: CashMovementKind) => sum(movements.filter((m) => m.kind === kind))

  const cash = payments.filter((p) => p.method === 'CASH')
  const cashSales = sum(cash.filter((p) => p.kind !== 'REFUND'))
  const cashRefunds = sum(cash.filter((p) => p.kind === 'REFUND'))
  const cardSales = sum(payments.filter((p) => p.method !== 'CASH' && p.kind !== 'REFUND'))

  const floatIn = ofKind('FLOAT_IN')
  const paidOut = ofKind('PAY_OUT')
  const dropped = ofKind('DROP')
  const derived = round2(floatIn + cashSales - cashRefunds - paidOut - dropped)

  return {
    shiftId: shift._id,
    openedAt: shift.openedAt,
    status: shift.status,
    floatIn,
    cashSales,
    cashRefunds,
    paidOut,
    dropped,
    derived,
    expected: round2(shift.expectedCash),
    drift: round2(derived - shift.expectedCash),
    cardSales,
    movements: movements.length,
  }
}

export async function recordMovement(scope: Scope, input: MovementInput) {
  if (!CASH_MOVEMENT_KINDS.includes(input.kind)) throw ApiError.badRequest(`Unknown movement "${input.kind}".`)
  const amount = round2(input.amount)
  if (!(amount > 0)) throw ApiError.badRequest('Enter an amount greater than zero.')
  const reason = input.reason?.trim() ?? ''
  if (reason.length < 3) throw ApiError.badRequest('Every drawer movement needs a reason.')

  const shift = await requireOpenTill(scope)
  const sign = MOVEMENT_SIGN[input.kind]

  if (sign < 0 && amount > round2(shift.expectedCash)) {
    throw ApiError.unprocessable(
      `The till is only expected to hold ${round2(shift.expectedCash).toFixed(2)} — you cannot take out ${amount.toFixed(2)}.`,
    )
  }

  const vatRate = (await Tenant.findById(scope.tenantId).lean())?.vatRate ?? DEFAULT_VAT_RATE
  const tax = input.kind === 'PAY_OUT' ? splitInclusive(amount, vatRate) : noVat(amount)

  const movement = await CashMovement.create({
    _id: await nextId('cashMovement'),
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    shiftId: shift._id,
    actorId: scope.agentId,
    kind: input.kind,
    amount,
    baseAmount: tax.baseAmount,
    vatAmount: tax.vatAmount,
    vatRate: tax.vatRate,
    reason,
    reference: input.reference?.trim() ?? '',
  })

  await Shift.updateOne({ _id: shift._id }, { $inc: { expectedCash: round2(sign * amount) } })

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: `CASH_${input.kind}`,
    entity: 'Shift',
    entityId: shift._id,
    reason,
    detail: `${amount.toFixed(2)} · ${movement._id}`,
  })

  return movement
}

export async function listMovements(scope: Scope, shiftId?: string) {
  const shift = shiftId ? { _id: shiftId } : await openTill(scope)
  if (!shift) return []
  const rows = await CashMovement.find({ tenantId: scope.tenantId, shiftId: shift._id }).sort({ createdAt: -1 }).lean()
  const actors = await User.find({ _id: { $in: [...new Set(rows.map((r) => r.actorId))] } }).lean()
  const name = new Map(actors.map((a) => [a._id, a.fullName]))
  return rows.map((r) => ({ ...r, actorName: name.get(r.actorId) ?? r.actorId }))
}

export async function paymentQueue(scope: Scope) {
  const engines = engineFilter(scope)
  const bookings = await Booking.find({
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    status: 'DRAFT',
    ...(engines === undefined ? {} : { engineKind: engines }),
  })
    .sort({ createdAt: 1 })
    .limit(50)
    .lean()

  if (!bookings.length) return []

  const orders = await Order.find({ _id: { $in: bookings.map((b) => b.orderId) } }).lean()
  const byId = new Map(orders.map((o) => [o._id, o]))

  return bookings
    .map((b) => {
      const order = byId.get(b.orderId)
      return {
        bookingId: b._id,
        ref: b.ref,
        orderId: b.orderId,
        orderRef: order?.ref ?? '',
        engineKind: b.engineKind,
        productName: b.productName,
        customerId: b.customerId,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        items: b.bags.length,
        createdAt: b.createdAt,
        waitingMs: Date.now() - new Date(b.createdAt).getTime(),
        subtotal: order?.subtotal ?? 0,
        vat: order?.vat ?? 0,
        depositTotal: order?.depositTotal ?? 0,
        total: order?.total ?? 0,
        orderStatus: order?.status ?? 'DRAFT',
      }
    })
    .filter((row) => row.orderStatus !== 'PAID' && row.orderStatus !== 'CANCELLED')
}

export async function transactions(scope: Scope, filters: TransactionFilters = {}) {
  const query: Record<string, unknown> = { tenantId: scope.tenantId, stationId: scope.stationId }
  if (filters.method) query.method = filters.method
  if (filters.kind) query.kind = filters.kind
  if (filters.from || filters.to) {
    const range: Record<string, Date> = {}
    if (filters.from) range.$gte = new Date(filters.from)
    if (filters.to) range.$lte = new Date(filters.to)
    query.createdAt = range
  }

  const payments = await Payment.find(query).sort({ createdAt: -1 }).limit(300).lean()
  if (!payments.length) return []

  const bookingIds = [...new Set(payments.map((p) => p.bookingId).filter(Boolean) as string[])]
  const orderIds = [...new Set(payments.map((p) => p.orderId))]

  const takerIds = [...new Set(payments.map((p) => p.takenBy).filter(Boolean))]

  const [bookings, receipts, takers] = await Promise.all([
    Booking.find({ _id: { $in: bookingIds } }).lean(),
    Receipt.find({ orderId: { $in: orderIds } }).lean(),
    User.find({ _id: { $in: takerIds } }).lean(),
  ])
  const booking = new Map(bookings.map((b) => [b._id, b]))
  const receipt = new Map(receipts.map((r) => [r.orderId, r]))
  const takerName = new Map(takers.map((u) => [u._id, u.fullName]))

  return payments.map((p) => {
    const b = p.bookingId ? booking.get(p.bookingId) : undefined
    return {
      _id: p._id,
      amount: p.amount,
      method: p.method,
      cardScheme: p.cardScheme ?? null,
      kind: p.kind,
      status: p.status,
      createdAt: p.createdAt,
      orderId: p.orderId,
      bookingId: p.bookingId ?? null,
      bookingRef: b?.ref ?? '',
      customerName: b?.customerName ?? '',
      productName: b?.productName ?? '',
      engineKind: b?.engineKind ?? null,
      receiptRef: receipt.get(p.orderId)?.ref ?? null,
      takenBy: p.takenBy ?? '',
      takenByName: takerName.get(p.takenBy ?? '') ?? '',
    }
  })
}

/** What is still refundable on one captured payment. */
export async function refundableOn(tenantId: string, payment: { _id: string; orderId: string; amount: number }) {
  const already = await Payment.find({ tenantId, orderId: payment.orderId, kind: 'REFUND' }).lean()
  const refunded = round2(already.reduce((t, r) => t + r.amount, 0))
  return { refunded, remaining: round2(payment.amount - refunded) }
}

/**
 * Gives money back against one captured payment: the same method and card scheme it came in on,
 * the till adjusted when it was cash, and the original marked REFUNDED once nothing is left.
 */
async function giveBack(scope: Scope, original: PaymentHydrated, amount: number) {
  if (original.method === 'CASH') {
    const shift = await requireOpenTill(scope)
    if (amount > round2(shift.expectedCash)) {
      throw ApiError.unprocessable(
        `The till is only expected to hold ${round2(shift.expectedCash).toFixed(2)} — take a smaller amount or bank a float first.`,
      )
    }
    await Shift.updateOne({ _id: shift._id }, { $inc: { expectedCash: -amount } })
  }

  const refundTill = await openTill(scope)
  const refundRate = original.vatRate || (await Tenant.findById(scope.tenantId).lean())?.vatRate || DEFAULT_VAT_RATE
  const tax = original.kind === 'DEPOSIT' ? noVat(amount) : splitInclusive(amount, refundRate)

  const refund = await Payment.create({
    _id: await nextId('payment'),
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    orderId: original.orderId,
    bookingId: original.bookingId ?? null,
    amount,
    baseAmount: tax.baseAmount,
    vatAmount: tax.vatAmount,
    vatRate: tax.vatRate,
    engineKind: original.engineKind ?? null,
    method: original.method,
    cardScheme: original.cardScheme ?? null,
    kind: 'REFUND',
    status: 'CAPTURED',
    takenBy: scope.agentId,
    shiftId: refundTill?._id ?? null,
  })

  const { refunded } = await refundableOn(scope.tenantId, original)
  if (round2(refunded) >= round2(original.amount)) {
    original.status = 'REFUNDED'
    await original.save()
  }

  return refund
}

export async function refundPayment(scope: Scope, paymentId: string, input: RefundInput) {
  const reason = input.reason?.trim() ?? ''
  if (reason.length < 3) throw ApiError.badRequest('A refund needs a reason.')
  const amount = round2(input.amount)
  if (!(amount > 0)) throw ApiError.badRequest('Enter an amount greater than zero.')

  const original = await Payment.findOne({ _id: paymentId, tenantId: scope.tenantId, stationId: scope.stationId })
  if (!original) throw ApiError.notFound('Payment not found.')
  if (original.kind === 'REFUND') throw ApiError.unprocessable('That transaction is itself a refund.')
  if (original.status !== 'CAPTURED') {
    throw ApiError.unprocessable(`Cannot refund a payment that is already ${original.status}.`)
  }

  const { remaining } = await refundableOn(scope.tenantId, original)
  if (amount > remaining) {
    throw ApiError.unprocessable(`Only ${remaining.toFixed(2)} is left to refund on this payment.`)
  }

  const refund = await giveBack(scope, original, amount)

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'PAYMENT_REFUNDED',
    entity: 'Payment',
    entityId: original._id,
    reason,
    detail: `${amount.toFixed(2)} ${original.method} → ${refund._id}`,
  })

  return { refund, original, remaining: round2(remaining - amount) }
}

/** Everything taken on a booking, what has already gone back, and what is left to give. */
export async function bookingRefundPosition(tenantId: string, stationId: string, booking: { _id: string; orderId: string }) {
  const payments = await Payment.find({
    tenantId,
    stationId,
    $or: [{ bookingId: booking._id }, { orderId: booking.orderId }],
  }).sort({ createdAt: 1 })

  const taken = payments.filter((p) => p.kind !== 'REFUND')
  const given = payments.filter((p) => p.kind === 'REFUND')
  const paid = round2(taken.reduce((t, p) => t + p.amount, 0))
  const refunded = round2(given.reduce((t, p) => t + p.amount, 0))

  return { payments: taken, paid, refunded, refundable: round2(paid - refunded) }
}

/**
 * Refunds a booking rather than a single line: the amount is spread over what the customer
 * actually paid, oldest payment first, so each part goes back the way it came in.
 */
export async function refundBooking(
  scope: Scope,
  booking: BookingHydrated,
  input: { amount?: number; reason: string },
  actorName: string,
) {
  const reason = input.reason?.trim() ?? ''
  if (reason.length < 3) throw ApiError.badRequest('A refund needs a reason.')

  const position = await bookingRefundPosition(scope.tenantId, scope.stationId, booking)
  if (position.paid <= 0) throw ApiError.unprocessable('Nothing has been paid on this booking yet.')
  if (position.refundable <= 0) throw ApiError.unprocessable('This booking has already been refunded in full.')

  const amount = round2(input.amount ?? position.refundable)
  if (!(amount > 0)) throw ApiError.badRequest('Enter an amount greater than zero.')
  if (amount > position.refundable) {
    throw ApiError.unprocessable(`Only ${position.refundable.toFixed(2)} is left to refund on this booking.`)
  }

  let left = amount
  const created: string[] = []
  for (const payment of position.payments) {
    if (left <= 0) break
    if (payment.status !== 'CAPTURED') continue
    const { remaining } = await refundableOn(scope.tenantId, payment)
    if (remaining <= 0) continue

    const slice = round2(Math.min(remaining, left))
    const refund = await giveBack(scope, payment, slice)
    created.push(refund._id)
    left = round2(left - slice)
  }

  if (!created.length) throw ApiError.unprocessable('Nothing on this booking could be refunded.')

  booking.refunds.push({
    amount: round2(amount - left),
    reason,
    refundedBy: scope.agentId,
    refundedByName: actorName,
    paymentIds: created,
    at: new Date(),
  })
  await booking.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'BOOKING_REFUNDED',
    entity: 'Booking',
    entityId: booking._id,
    reason,
    detail: `${round2(amount - left).toFixed(2)} SAR on ${booking.ref} · ${created.join(', ')}`,
  })

  const after = await bookingRefundPosition(scope.tenantId, scope.stationId, booking)
  return { booking, refunded: after.refunded, refundable: after.refundable, paid: after.paid }
}

export async function cashierOverview(scope: Scope) {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [shift, queue, todays, customers] = await Promise.all([
    openTill(scope),
    paymentQueue(scope),
    Payment.find({
      tenantId: scope.tenantId,
      stationId: scope.stationId,
      createdAt: { $gte: startOfDay },
    }).lean(),
    Customer.countDocuments({ tenantId: scope.tenantId }),
  ])

  const sum = (rows: { amount: number }[]) => round2(rows.reduce((t, r) => t + r.amount, 0))
  const sales = todays.filter((p) => p.kind !== 'REFUND')
  const refunds = todays.filter((p) => p.kind === 'REFUND')

  return {
    shift: shift
      ? { _id: shift._id, status: shift.status, openedAt: shift.openedAt, expectedCash: round2(shift.expectedCash) }
      : null,
    drawer: await drawer(scope),
    queue: { count: queue.length, value: round2(queue.reduce((t, q) => t + q.total, 0)), oldestWaitingMs: queue[0]?.waitingMs ?? 0 },
    today: {
      transactions: todays.length,
      gross: sum(sales),
      refunded: sum(refunds),
      net: round2(sum(sales) - sum(refunds)),
      cash: sum(sales.filter((p) => p.method === 'CASH')),
      card: sum(sales.filter((p) => p.method !== 'CASH')),
    },
    customers,
  }
}
