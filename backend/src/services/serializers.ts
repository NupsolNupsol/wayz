import { Order, Payment } from '../models/index.js'
import type { BookingDoc } from '../models/index.js'
import { computeOvertime, pendingOvertime } from '../domain/overtime.js'

export async function withAmountsDue<T extends { orderId: string; session?: { overtime?: ReturnType<typeof computeOvertime> } }>(
  tenantId: string,
  rows: T[],
) {
  if (rows.length === 0) return [] as (T & { amountDue: number; amountCharged: number })[]

  const orderIds = [...new Set(rows.map((r) => r.orderId))]
  const [orders, paid] = await Promise.all([
    Order.find({ _id: { $in: orderIds }, tenantId }, { total: 1, lines: 1 }).lean(),
    Payment.aggregate([
      { $match: { tenantId, orderId: { $in: orderIds }, status: 'CAPTURED' } },
      {
        $group: {
          _id: '$orderId',
          total: { $sum: { $cond: [{ $eq: ['$kind', 'REFUND'] }, { $multiply: ['$amount', -1] }, '$amount'] } },
        },
      },
    ]),
  ])

  const totalOf = new Map(orders.map((o) => [o._id, o.total]))
  const linesOf = new Map(orders.map((o) => [o._id, o.lines ?? []]))
  const paidOf = new Map((paid as { _id: string; total: number }[]).map((p) => [p._id, p.total]))

  return rows.map((row) => {
    const charged = totalOf.get(row.orderId) ?? 0
    const settled = Math.max(0, charged - (paidOf.get(row.orderId) ?? 0))
    const running = row.session?.overtime ? pendingOvertime(row.session.overtime, linesOf.get(row.orderId) ?? []) : 0
    return {
      ...row,
      amountCharged: Math.round((charged + running) * 100) / 100,
      amountDue: Math.round((settled + running) * 100) / 100,
    }
  })
}

export function bookingDTO(b: BookingDoc) {
  const obj = typeof (b as unknown as { toObject?: () => unknown }).toObject === 'function'
    ? (b as unknown as { toObject: () => Record<string, unknown> }).toObject()
    : (b as unknown as Record<string, unknown>)

  const overtime = computeOvertime(b.session)

  return {
    ...obj,
    id: b._id,
    session: {
      ...(obj as { session: object }).session,
      remainingMs: overtime.remainingMs,
      isOvertime: overtime.isOvertime,
      overtime,
    },
  }
}

export function bookingListDTO(list: BookingDoc[]) {
  return list.map(bookingDTO)
}

export async function bookingListWithDue(tenantId: string, list: BookingDoc[]) {
  const rows = list.map((b) => ({ ...bookingDTO(b), orderId: b.orderId }))
  return withAmountsDue(tenantId, rows)
}
