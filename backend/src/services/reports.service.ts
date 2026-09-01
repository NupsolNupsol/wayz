import { Audit, AssetUnit, Booking, Customer, Payment, Station } from '../models/index.js'
import { tenantEngines } from './catalogue.service.js'
import { computeOvertime } from '../domain/overtime.js'
import { round2 } from '../utils/helpers.js'

import type { ReportRange } from '../interfaces/index.js'
import type { ManagerScope } from '../interfaces/index.js'

function resolveRange(range: ReportRange): { from: Date; to: Date } {
  const to = range.to ? new Date(`${range.to}T23:59:59.999Z`) : new Date()
  const from = range.from ? new Date(`${range.from}T00:00:00.000Z`) : new Date(Date.now() - 29 * 86_400_000)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Invalid date range')
  }
  return { from, to }
}

const LIVE = ['ACTIVE', 'OVERTIME', 'RETRIEVAL_IN_PROGRESS']

export async function revenueReport(scope: ManagerScope, range: ReportRange) {
  const engines = await tenantEngines(scope.tenantId)
  const { from, to } = resolveRange(range)
  const match = { tenantId: scope.tenantId, status: 'CAPTURED', createdAt: { $gte: from, $lte: to } }

  const [daily, byMethod, byKind, byEngineStation, stations] = await Promise.all([
    Payment.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([{ $match: match }, { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: match }, { $group: { _id: '$kind', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Payment.aggregate([
      { $match: match },
      { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'b' } },
      { $unwind: { path: '$b', preserveNullAndEmptyArrays: true } },
      { $group: { _id: { engine: '$b.engineKind', station: '$stationId' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Station.find({ tenantId: scope.tenantId }).lean(),
  ])

  const stationName = new Map(stations.map((s) => [s._id, s.name]))
  const engineTotals = new Map<string, number>()
  const stationTotals = new Map<string, number>()
  for (const row of byEngineStation as { _id: { engine?: string; station?: string }; total: number }[]) {
    if (row._id.engine) engineTotals.set(row._id.engine, (engineTotals.get(row._id.engine) ?? 0) + row.total)
    if (row._id.station) stationTotals.set(row._id.station, (stationTotals.get(row._id.station) ?? 0) + row.total)
  }

  const gross = daily.reduce((s: number, d: { total: number }) => s + d.total, 0)
  const overtime = (byKind as { _id: string; total: number }[]).find((k) => k._id === 'OVERTIME')?.total ?? 0

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    gross: round2(gross),
    overtimeRevenue: round2(overtime),
    transactions: daily.reduce((s: number, d: { count: number }) => s + d.count, 0),
    daily: daily.map((d: { _id: string; total: number; count: number }) => ({
      date: d._id,
      total: round2(d.total),
      count: d.count,
    })),
    byMethod: (byMethod as { _id: string; total: number; count: number }[]).map((m) => ({
      method: m._id ?? 'UNKNOWN',
      total: round2(m.total),
      count: m.count,
    })),
    byKind: (byKind as { _id: string; total: number; count: number }[]).map((k) => ({
      kind: k._id ?? 'UNKNOWN',
      total: round2(k.total),
      count: k.count,
    })),
    byEngine: engines.map((e) => ({ engineKind: e, total: round2(engineTotals.get(e) ?? 0) })),
    byStation: [...stationTotals.entries()].map(([id, total]) => ({
      stationId: id,
      name: stationName.get(id) ?? id,
      total: round2(total),
    })),
  }
}

export async function occupancyReport(scope: ManagerScope) {
  const [byType, byStation, stations] = await Promise.all([
    AssetUnit.aggregate([
      { $match: { tenantId: scope.tenantId } },
      { $lookup: { from: 'assettypes', localField: 'assetTypeId', foreignField: '_id', as: 't' } },
      { $unwind: { path: '$t', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { id: '$assetTypeId', name: '$t.name', kind: '$t.kind' },
          total: { $sum: 1 },
          inUse: { $sum: { $cond: [{ $in: ['$status', ['OCCUPIED', 'RESERVED', 'RETRIEVAL_PENDING']] }, 1, 0] } },
          outOfService: { $sum: { $cond: [{ $in: ['$status', ['MAINTENANCE', 'OUT_OF_SERVICE', 'BLOCKED']] }, 1, 0] } },
        },
      },
    ]),
    AssetUnit.aggregate([
      { $match: { tenantId: scope.tenantId } },
      {
        $group: {
          _id: '$stationId',
          total: { $sum: 1 },
          inUse: { $sum: { $cond: [{ $in: ['$status', ['OCCUPIED', 'RESERVED', 'RETRIEVAL_PENDING']] }, 1, 0] } },
        },
      },
    ]),
    Station.find({ tenantId: scope.tenantId }).lean(),
  ])

  const stationName = new Map(stations.map((s) => [s._id, s.name]))
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

  return {
    byAssetType: (byType as { _id: { id: string; name?: string; kind?: string }; total: number; inUse: number; outOfService: number }[]).map((t) => ({
      assetTypeId: t._id.id,
      name: t._id.name ?? t._id.id,
      kind: t._id.kind ?? '—',
      total: t.total,
      inUse: t.inUse,
      outOfService: t.outOfService,
      utilisationPct: pct(t.inUse, t.total),
    })),
    byStation: (byStation as { _id: string; total: number; inUse: number }[]).map((s) => ({
      stationId: s._id,
      name: stationName.get(s._id) ?? s._id,
      total: s.total,
      inUse: s.inUse,
      utilisationPct: pct(s.inUse, s.total),
    })),
  }
}

export async function rentalsReport(scope: ManagerScope, range: ReportRange) {
  const engines = await tenantEngines(scope.tenantId)
  const { from, to } = resolveRange(range)
  const match = { tenantId: scope.tenantId, createdAt: { $gte: from, $lte: to } }

  const [byStatus, byEngine, durations, live] = await Promise.all([
    Booking.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: match }, { $group: { _id: '$engineKind', count: { $sum: 1 } } }]),
    Booking.aggregate([
      { $match: { ...match, 'session.startedAt': { $ne: null }, 'session.chargeableEndedAt': { $ne: null } } },
      {
        $group: {
          _id: null,
          avgMinutes: { $avg: { $divide: [{ $subtract: ['$session.chargeableEndedAt', '$session.startedAt'] }, 60000] } },
          completed: { $sum: 1 },
        },
      },
    ]),
    Booking.find({ tenantId: scope.tenantId, status: { $in: LIVE } }).lean(),
  ])

  const overdue = live.filter((b) => computeOvertime(b.session).isOvertime)
  const accruing = overdue.reduce((sum, b) => sum + computeOvertime(b.session).penaltyAmount, 0)
  const statusMap = new Map((byStatus as { _id: string; count: number }[]).map((s) => [s._id, s.count]))

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    total: [...statusMap.values()].reduce((a, b) => a + b, 0),
    completed: statusMap.get('COMPLETED') ?? 0,
    cancelled: statusMap.get('CANCELLED') ?? 0,
    live: live.length,
    overdueNow: overdue.length,
    penaltyAccruing: round2(accruing),
    averageDurationMin: Math.round(durations[0]?.avgMinutes ?? 0),
    byStatus: [...statusMap.entries()].map(([status, count]) => ({ status, count })),
    byEngine: engines.map((e) => ({
      engineKind: e,
      count: (byEngine as { _id: string; count: number }[]).find((x) => x._id === e)?.count ?? 0,
    })),
  }
}

export async function customersReport(scope: ManagerScope) {
  const [total, byCustomer] = await Promise.all([
    Customer.countDocuments({ tenantId: scope.tenantId }),
    Booking.aggregate([
      { $match: { tenantId: scope.tenantId } },
      { $group: { _id: '$customerId', bookings: { $sum: 1 }, name: { $first: '$customerName' } } },
      { $sort: { bookings: -1 } },
      { $limit: 10 },
    ]),
  ])
  const repeat = (byCustomer as { bookings: number }[]).filter((c) => c.bookings > 1).length
  return {
    totalCustomers: total,
    repeatCustomers: repeat,
    topCustomers: (byCustomer as { _id: string; name: string; bookings: number }[]).map((c) => ({
      customerId: c._id,
      name: c.name,
      bookings: c.bookings,
    })),
  }
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const cell = (v: unknown) => {
    const raw = v == null ? '' : String(v)
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
    return `"${safe.replace(/"/g, '""')}"`
  }
  return [headers.map(cell).join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))].join('\r\n')
}

export async function reportRows(scope: ManagerScope, kind: string, range: ReportRange): Promise<Record<string, unknown>[]> {
  switch (kind) {
    case 'revenue': {
      const r = await revenueReport(scope, range)
      return r.daily.map((d) => ({ date: d.date, transactions: d.count, revenue: d.total }))
    }
    case 'occupancy': {
      const r = await occupancyReport(scope)
      return r.byAssetType.map((t) => ({
        assetType: t.name,
        kind: t.kind,
        total: t.total,
        inUse: t.inUse,
        outOfService: t.outOfService,
        utilisationPct: t.utilisationPct,
      }))
    }
    case 'rentals': {
      const r = await rentalsReport(scope, range)
      return r.byEngine.map((e) => ({ service: e.engineKind, bookings: e.count }))
    }
    case 'payments': {
      const r = await revenueReport(scope, range)
      return r.byMethod.map((m) => ({ method: m.method, transactions: m.count, total: m.total }))
    }
    default:
      throw new Error(`Unknown report "${kind}"`)
  }
}

export async function activityLog(scope: ManagerScope, limit = 500) {
  const [entries, stations] = await Promise.all([
    Audit.find({ tenantId: scope.tenantId }).sort({ at: -1 }).limit(limit).lean(),
    Station.find({ tenantId: scope.tenantId }).lean(),
  ])
  void stations
  return entries.map((e) => ({
    _id: e._id,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId,
    actorId: e.actorId,
    reason: e.reason ?? null,
    detail: e.detail ?? null,
    at: e.at,
  }))
}
