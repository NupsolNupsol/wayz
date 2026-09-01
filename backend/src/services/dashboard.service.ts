import { Booking, Incident, Payment } from '../models/index.js'

import { ENGINE_KINDS } from '../domain/types.js'

import type { Scope } from '../interfaces/index.js'
import { allowedEngines, engineFilter } from '../domain/access.js'

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function dashboardStats(scope: Scope) {
  const engines = engineFilter(scope)
  const base = {
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    ...(engines === undefined ? {} : { engineKind: engines }),
  }
  const now = new Date()
  const soon = new Date(now.getTime() + 45 * 60_000)

  const [
    todaysTransactions,
    revenueAgg,
    activeOperations,
    storedBagsAgg,
    dueSoon,
    overdue,
    pendingRetrievals,
    openIncidents,
    byEngineAgg,
  ] = await Promise.all([
    Payment.distinct('orderId', { ...base, kind: 'SALE', createdAt: { $gte: startOfToday() } }).then((ids) => ids.length),
    Payment.aggregate([
      { $match: { ...base, kind: { $in: ['SALE', 'OVERTIME'] }, status: 'CAPTURED', createdAt: { $gte: startOfToday() } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Booking.countDocuments({ ...base, status: { $in: ['ACTIVE', 'OVERTIME', 'RETRIEVAL_IN_PROGRESS'] } }),
    Booking.aggregate([
      { $match: { ...base } },
      { $unwind: '$bags' },
      { $match: { 'bags.status': 'STORED' } },
      { $count: 'n' },
    ]),
    Booking.countDocuments({ ...base, status: { $in: ['ACTIVE', 'OVERTIME'] }, 'session.expectedEndAt': { $gt: now, $lt: soon } }),
    Booking.countDocuments({ ...base, status: { $in: ['ACTIVE', 'OVERTIME'] }, 'session.expectedEndAt': { $lt: now } }),
    Booking.countDocuments({ ...base, status: 'RETRIEVAL_IN_PROGRESS' }),
    Incident.countDocuments({ ...base, status: { $nin: ['RESOLVED', 'REJECTED'] } }),
    Booking.aggregate([{ $match: { ...base } }, { $group: { _id: '$engineKind', count: { $sum: 1 } } }]),
  ])

  const byEngineMap = new Map<string, number>(byEngineAgg.map((e: { _id: string; count: number }) => [e._id, e.count]))
  return {
    todaysTransactions,
    todaysRevenue: Math.round((revenueAgg[0]?.total ?? 0) * 100) / 100,
    activeOperations,
    storedBags: storedBagsAgg[0]?.n ?? 0,
    dueSoon,
    overdue,
    pendingRetrievals,
    openIncidents,
    byEngine: allowedEngines(scope)?.map((k) => ({ engineKind: k, count: byEngineMap.get(k) ?? 0 }))
      ?? ENGINE_KINDS.map((k) => ({ engineKind: k, count: byEngineMap.get(k) ?? 0 })),
  }
}
