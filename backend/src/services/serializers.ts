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

/**
 * A session that is over must not keep counting. The clock stops where the workflow stopped it,
 * and for anything closed before we recorded that — or closed by a cancellation — it stops when
 * the booking last changed, so no finished rental ever shows a live overtime.
 */
const FINISHED = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW']

export function sessionEndedAt(b: BookingDoc): Date | null {
  if (b.session?.chargeableEndedAt) return b.session.chargeableEndedAt
  if (!b.session?.startedAt) return null
  return FINISHED.includes(b.status) ? ((b as { updatedAt?: Date }).updatedAt ?? null) : null
}

export function bookingDTO(b: BookingDoc) {
  const obj = typeof (b as unknown as { toObject?: () => unknown }).toObject === 'function'
    ? (b as unknown as { toObject: () => Record<string, unknown> }).toObject()
    : (b as unknown as Record<string, unknown>)

  const endedAt = sessionEndedAt(b)
  // Spreading a mongoose subdocument drops its schema paths, so hand the fields over by name.
  const overtime = computeOvertime({
    startedAt: b.session?.startedAt,
    expectedEndAt: b.session?.expectedEndAt,
    chargeableEndedAt: endedAt,
    gracePeriodMin: b.session?.gracePeriodMin,
    overtimeHourlyRate: b.session?.overtimeHourlyRate,
  })

  return {
    ...obj,
    id: b._id,
    session: {
      ...(obj as { session: object }).session,
      endedAt,
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
