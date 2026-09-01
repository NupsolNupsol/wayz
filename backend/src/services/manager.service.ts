import { AssetUnit, Booking, Customer, Incident, Order, Payment, Shift, Station, User } from '../models/index.js'
import { tenantEngines } from './catalogue.service.js'
import { ApiError } from '../utils/ApiError.js'
import { round2 } from '../utils/helpers.js'
import type { EngineKind } from '../domain/types.js'
import { computeOvertime } from '../domain/overtime.js'
import type { ManagerScope } from '../interfaces/index.js'

function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function daysAgo(n: number): Date {
  return startOfDay(new Date(Date.now() - n * 86_400_000))
}

const ACTIVE_STATUSES = ['ACTIVE', 'OVERTIME', 'RETRIEVAL_IN_PROGRESS']

export async function managerOverview(scope: ManagerScope) {
  const engines = await tenantEngines(scope.tenantId)
  const base = { tenantId: scope.tenantId }
  const now = new Date()
  const today = startOfDay()

  const [
    revenueToday,
    revenue7d,
    revenue30d,
    txToday,
    activeSessions,
    overdueSessions,
    openIncidents,
    pendingVariances,
    revenueByEngine,
    revenueTrend,
    byStation,
    unitAgg,
    staffCount,
  ] = await Promise.all([
    sumRevenue(base, today),
    sumRevenue(base, daysAgo(6)),
    sumRevenue(base, daysAgo(29)),
    Payment.distinct('orderId', { ...base, kind: 'SALE', createdAt: { $gte: today } }).then((ids) => ids.length),
    Booking.countDocuments({ ...base, status: { $in: ACTIVE_STATUSES } }),
    Booking.countDocuments({ ...base, status: { $in: ['ACTIVE', 'OVERTIME'] }, 'session.expectedEndAt': { $lt: now } }),
    Incident.countDocuments({ ...base, status: { $nin: ['RESOLVED', 'REJECTED'] } }),
    Shift.countDocuments({ ...base, status: 'RECONCILING' }),

    Payment.aggregate([
      { $match: { ...base, status: 'CAPTURED', createdAt: { $gte: daysAgo(29) } } },
      { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'booking' } },
      { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$booking.engineKind', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),

    Payment.aggregate([
      { $match: { ...base, status: 'CAPTURED', createdAt: { $gte: daysAgo(13) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Booking.aggregate([
      { $match: { ...base, createdAt: { $gte: daysAgo(29) } } },
      {
        $group: {
          _id: '$stationId',
          bookings: { $sum: 1 },
          active: { $sum: { $cond: [{ $in: ['$status', ACTIVE_STATUSES] }, 1, 0] } },
        },
      },
    ]),

    AssetUnit.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.countDocuments({ tenantId: scope.tenantId }),
  ])

  const stations = await Station.find({ tenantId: scope.tenantId }).lean()
  const stationName = new Map(stations.map((s) => [s._id, s.name]))

  const unitsByStatus = Object.fromEntries(unitAgg.map((u: { _id: string; count: number }) => [u._id, u.count]))
  const totalUnits = Object.values(unitsByStatus).reduce((a: number, b) => a + (b as number), 0)
  const inUse = (unitsByStatus.OCCUPIED ?? 0) + (unitsByStatus.RESERVED ?? 0) + (unitsByStatus.RETRIEVAL_PENDING ?? 0)

  const engineMap = new Map(
    revenueByEngine.map((r: { _id: string; total: number; count: number }) => [r._id, { total: r.total, count: r.count }]),
  )

  const trend: { date: string; total: number; count: number }[] = []
  const byDate = new Map(revenueTrend.map((d: { _id: string; total: number; count: number }) => [d._id, d]))
  for (let i = 13; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
    const hit = byDate.get(key)
    trend.push({ date: key, total: round2(hit?.total ?? 0), count: hit?.count ?? 0 })
  }

  return {
    revenue: { today: revenueToday, last7Days: revenue7d, last30Days: revenue30d },
    transactionsToday: txToday,
    activeSessions,
    overdueSessions,
    openIncidents,
    pendingVariances,
    staffCount,
    estate: {
      totalUnits,
      inUse,
      available: unitsByStatus.AVAILABLE ?? 0,
      outOfService: (unitsByStatus.MAINTENANCE ?? 0) + (unitsByStatus.OUT_OF_SERVICE ?? 0) + (unitsByStatus.BLOCKED ?? 0),
      utilisationPct: totalUnits ? Math.round((inUse / totalUnits) * 100) : 0,
      byStatus: unitsByStatus as Record<string, number>,
    },
    byEngine: engines.map((k) => ({
      engineKind: k,
      revenue: round2(engineMap.get(k)?.total ?? 0),
      payments: engineMap.get(k)?.count ?? 0,
    })),
    byStation: byStation.map((s: { _id: string; bookings: number; active: number }) => ({
      stationId: s._id,
      name: stationName.get(s._id) ?? s._id,
      bookings: s.bookings,
      active: s.active,
    })),
    revenueTrend: trend,
  }
}

async function sumRevenue(base: Record<string, unknown>, since: Date): Promise<number> {
  const agg = await Payment.aggregate([
    { $match: { ...base, status: 'CAPTURED', kind: { $in: ['SALE', 'OVERTIME'] }, createdAt: { $gte: since } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  return round2(agg[0]?.total ?? 0)
}

export async function managerIncidents(scope: ManagerScope) {
  const [incidents, stations] = await Promise.all([
    Incident.find({ tenantId: scope.tenantId }).sort({ createdAt: -1 }).limit(300).lean(),
    Station.find({ tenantId: scope.tenantId }).lean(),
  ])
  const stationName = new Map(stations.map((s) => [s._id, s.name]))
  return incidents.map((i) => ({ ...i, stationName: stationName.get(i.stationId) ?? i.stationId }))
}

export async function managerShifts(scope: ManagerScope) {
  const [shifts, stations, users] = await Promise.all([
    Shift.find({ tenantId: scope.tenantId }).sort({ openedAt: -1 }).limit(200).lean(),
    Station.find({ tenantId: scope.tenantId }).lean(),
    User.find({ tenantId: scope.tenantId }).lean(),
  ])
  const stationName = new Map(stations.map((s) => [s._id, s.name]))
  const userName = new Map(users.map((u) => [u._id, u.fullName]))
  return shifts.map((s) => ({
    ...s,
    stationName: stationName.get(s.stationId) ?? s.stationId,
    agentName: userName.get(s.agentId) ?? s.agentId,
  }))
}

export async function managerStaff(scope: ManagerScope) {
  const [users, stations] = await Promise.all([
    User.find({ tenantId: scope.tenantId }).lean(),
    Station.find({ tenantId: scope.tenantId }).lean(),
  ])
  const stationName = new Map(stations.map((s) => [s._id, s.name]))
  return users.map((u) => ({
    _id: u._id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    phone: u.phone,
    stationName: stationName.get(u.stationId) ?? u.stationId,
  }))
}

export async function managerLiveSessions(scope: ManagerScope) {
  const [bookings, stations] = await Promise.all([
    Booking.find({ tenantId: scope.tenantId, status: { $in: ACTIVE_STATUSES } })
      .sort({ 'session.expectedEndAt': 1 })
      .limit(200)
      .lean(),
    Station.find({ tenantId: scope.tenantId }).lean(),
  ])
  const stationName = new Map(stations.map((s) => [s._id, s.name]))

  return bookings.map((b) => {
    const overtime = computeOvertime(b.session)
    return {
      _id: b._id,
      ref: b.ref,
      engineKind: b.engineKind as EngineKind,
      status: b.status,
      productName: b.productName,
      customerName: b.customerName,
      stationName: stationName.get(b.stationId) ?? b.stationId,
      expectedEndAt: overtime.expectedEndAt,
      remainingMs: overtime.remainingMs,
      isOvertime: overtime.isOvertime,
      penaltyAmount: overtime.penaltyAmount,
    }
  })
}

const RENTAL_SCOPES = {
  active: ACTIVE_STATUSES,
  completed: ['COMPLETED'],
  expired: ['OVERTIME'],
  all: [] as string[],
}

export async function managerRentals(scope: ManagerScope, which: keyof typeof RENTAL_SCOPES = 'all') {
  const statuses = RENTAL_SCOPES[which]
  const query: Record<string, unknown> = { tenantId: scope.tenantId }
  if (which === 'expired') {
    query.status = { $in: ['ACTIVE', 'OVERTIME'] }
  } else if (statuses.length) {
    query.status = { $in: statuses }
  }

  const [bookings, stations, users] = await Promise.all([
    Booking.find(query).sort({ createdAt: -1 }).limit(400).lean(),
    Station.find({ tenantId: scope.tenantId }).lean(),
    User.find({ tenantId: scope.tenantId }).lean(),
  ])
  const stationName = new Map(stations.map((s) => [s._id, s.name]))
  const agentName = new Map(users.map((u) => [u._id, u.fullName]))

  const rows = bookings.map((b) => {
    const o = computeOvertime(b.session)
    return {
      _id: b._id,
      ref: b.ref,
      engineKind: b.engineKind,
      status: b.status,
      productName: b.productName,
      customerId: b.customerId,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      stationName: stationName.get(b.stationId) ?? b.stationId,
      agentName: agentName.get(b.agentId) ?? b.agentId,
      bagCount: b.bags.length,
      startedAt: b.session.startedAt ?? null,
      expectedEndAt: o.expectedEndAt,
      remainingMs: o.remainingMs,
      isOvertime: o.isOvertime,
      penaltyAmount: o.penaltyAmount,
      createdAt: b.createdAt,
    }
  })

  return which === 'expired' ? rows.filter((r) => r.isOvertime) : rows
}

export async function managerRentalDetail(scope: ManagerScope, bookingId: string) {
  const booking = await Booking.findOne({ _id: bookingId, tenantId: scope.tenantId }).lean()
  if (!booking) throw ApiError.notFound('Rental not found.')

  const [order, payments, station, agent] = await Promise.all([
    Order.findById(booking.orderId).lean(),
    Payment.find({ bookingId, tenantId: scope.tenantId }).sort({ createdAt: 1 }).lean(),
    Station.findById(booking.stationId).lean(),
    User.findById(booking.agentId).lean(),
  ])

  return {
    booking: { ...booking, overtime: computeOvertime(booking.session) },
    order: order ?? null,
    payments,
    stationName: station?.name ?? booking.stationId,
    agentName: agent?.fullName ?? booking.agentId,
  }
}

export async function managerCustomers(scope: ManagerScope) {
  const [customers, agg] = await Promise.all([
    Customer.find({ tenantId: scope.tenantId }).sort({ createdAt: -1 }).limit(500).lean(),
    Booking.aggregate([
      { $match: { tenantId: scope.tenantId } },
      {
        $group: {
          _id: '$customerId',
          bookings: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          lastAt: { $max: '$createdAt' },
        },
      },
    ]),
  ])
  const stats = new Map(agg.map((a: { _id: string; bookings: number; completed: number; lastAt: Date }) => [a._id, a]))

  return customers.map((c) => {
    const s = stats.get(c._id)
    return {
      _id: c._id,
      name: c.name,
      phone: c.phone,
      email: c.email ?? '',
      createdAt: c.createdAt,
      bookings: s?.bookings ?? 0,
      completed: s?.completed ?? 0,
      lastBookingAt: s?.lastAt ?? null,
    }
  })
}

export async function managerCustomerDetail(scope: ManagerScope, customerId: string) {
  const customer = await Customer.findOne({ _id: customerId, tenantId: scope.tenantId }).lean()
  if (!customer) throw ApiError.notFound('Customer not found.')

  const [bookings, paid] = await Promise.all([
    Booking.find({ tenantId: scope.tenantId, customerId }).sort({ createdAt: -1 }).limit(200).lean(),
    Payment.aggregate([
      { $match: { tenantId: scope.tenantId, status: 'CAPTURED' } },
      { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'b' } },
      { $unwind: '$b' },
      { $match: { 'b.customerId': customerId } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ])

  return {
    customer,
    lifetimeValue: round2(paid[0]?.total ?? 0),
    bookings: bookings.map((b) => ({
      _id: b._id,
      ref: b.ref,
      engineKind: b.engineKind,
      status: b.status,
      productName: b.productName,
      createdAt: b.createdAt,
      penaltyAmount: computeOvertime(b.session).penaltyAmount,
    })),
  }
}

export async function managerPayments(scope: ManagerScope) {
  const [payments, stations] = await Promise.all([
    Payment.aggregate([
      { $match: { tenantId: scope.tenantId } },
      { $sort: { createdAt: -1 } },
      { $limit: 500 },
      { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'b' } },
      { $unwind: { path: '$b', preserveNullAndEmptyArrays: true } },
    ]),
    Station.find({ tenantId: scope.tenantId }).lean(),
  ])
  const stationName = new Map(stations.map((s) => [s._id, s.name]))

  return (payments as Array<Record<string, unknown> & { b?: { ref?: string; customerName?: string; engineKind?: string } }>).map((p) => ({
    _id: p._id as string,
    amount: p.amount as number,
    method: p.method as string,
    kind: p.kind as string,
    status: p.status as string,
    createdAt: p.createdAt as Date,
    bookingId: (p.bookingId as string) ?? null,
    bookingRef: p.b?.ref ?? null,
    customerName: p.b?.customerName ?? null,
    engineKind: p.b?.engineKind ?? null,
    stationName: stationName.get(p.stationId as string) ?? (p.stationId as string),
  }))
}
