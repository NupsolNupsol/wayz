import {
  Audit,
  AssetType,
  AssetUnit,
  Booking,
  CashMovement,
  Customer,
  DeliveryRequest,
  Incident,
  Kiosk,
  Payment,
  Shift,
  Site,
  Station,
  Tenant,
  User,
} from '../models/index.js'
import { recordAudit } from './audit.service.js'
import { ApiError } from '../utils/ApiError.js'
import { round2 } from '../utils/helpers.js'
import { computeOvertime } from '../domain/overtime.js'
import { ENGINE_KINDS, ROLES, type EngineKind, type Role } from '../domain/types.js'

import type { CompanyPatch } from '../interfaces/index.js'
import type { ManagerScope } from '../interfaces/index.js'

const LIVE = ['RESERVED', 'ACTIVE', 'OVERTIME', 'RETRIEVAL_IN_PROGRESS']
const IN_USE = ['OCCUPIED', 'RESERVED', 'HELD', 'RETRIEVAL_PENDING']
const OPEN_INCIDENT = { $nin: ['RESOLVED', 'CLOSED'] }

function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export async function tenantOverview(scope: ManagerScope) {
  const t = { tenantId: scope.tenantId }
  const today = startOfDay()
  const monthAgo = new Date(Date.now() - 30 * 86400000)

  const [
    tenant,
    sites,
    stations,
    kiosks,
    units,
    assetTypes,
    staff,
    customers,
    live,
    payments,
    incidents,
    shifts,
    deliveries,
    bookingsMonth,
  ] = await Promise.all([
    Tenant.findById(scope.tenantId).lean(),
    Site.find(t).lean(),
    Station.find(t).lean(),
    Kiosk.find(t).lean(),
    AssetUnit.find(t).lean(),
    AssetType.find(t).lean(),
    User.find(t).lean(),
    Customer.countDocuments(t),
    Booking.find({ ...t, status: { $in: LIVE } }).lean(),
    Payment.find({ ...t, createdAt: { $gte: monthAgo } }).lean(),
    Incident.countDocuments({ ...t, status: OPEN_INCIDENT }),
    Shift.find({ ...t, status: { $ne: 'CLOSED' } }).lean(),
    DeliveryRequest.find(t).lean(),
    Booking.countDocuments({ ...t, createdAt: { $gte: monthAgo } }),
  ])

  if (!tenant) throw ApiError.notFound('Tenant not found.')

  const now = new Date()
  const overdue = live.filter((b) => b.session?.expectedEndAt && computeOvertime(b.session as never, now).isOvertime)

  const sales = payments.filter((p) => p.kind !== 'REFUND')
  const refunds = payments.filter((p) => p.kind === 'REFUND')
  const todaySales = sales.filter((p) => new Date(p.createdAt) >= today)

  const byRole = Object.fromEntries(ROLES.map((r) => [r, staff.filter((u) => u.role === r).length])) as Record<Role, number>

  // Only what this tenant actually runs: an engine it has switched on, or one it still holds units for.
  const byEngine = ENGINE_KINDS.map((engineKind) => {
    const ids = new Set(
      assetTypes.filter((a) => a.engineKind === engineKind).map((a) => a._id),
    )
    const engineUnits = units.filter((u) => ids.has(u.assetTypeId))
    return {
      engineKind,
      units: engineUnits.length,
      inUse: engineUnits.filter((u) => IN_USE.includes(u.status)).length,
      enabled: (tenant.enabledEngines ?? []).includes(engineKind as EngineKind),
    }
  }).filter((row) => row.enabled || row.units > 0)

  const perSite = sites.map((site) => {
    const siteStations = stations.filter((s) => s.siteId === site._id)
    const stationIds = new Set(siteStations.map((s) => s._id))
    const siteUnits = units.filter((u) => stationIds.has(u.stationId))
    return {
      _id: site._id,
      name: site.name,
      city: site.city,
      venueType: site.venueType,
      active: site.active !== false,
      stations: siteStations.length,
      kiosks: kiosks.filter((k) => k.siteId === site._id).length,
      units: siteUnits.length,
      inUse: siteUnits.filter((u) => IN_USE.includes(u.status)).length,
      staff: staff.filter((u) => stationIds.has(u.stationId)).length,
      live: live.filter((b) => stationIds.has(b.stationId)).length,
      revenue30d: round2(sales.filter((p) => stationIds.has(p.stationId)).reduce((x, p) => x + p.amount, 0)),
    }
  })

  return {
    tenant: {
      _id: tenant._id,
      name: tenant.name,
      legalName: tenant.legalName,
      crNumber: tenant.crNumber,
      vatNumber: tenant.vatNumber,
      currency: tenant.currency,
      vatRate: tenant.vatRate,
      enabledEngines: tenant.enabledEngines,
      branding: tenant.branding,
      company: tenant.company ?? {},
    },
    estate: {
      sites: sites.length,
      stations: stations.length,
      kiosks: kiosks.length,
      assetTypes: assetTypes.length,
      units: units.length,
      inUse: units.filter((u) => IN_USE.includes(u.status)).length,
      available: units.filter((u) => u.status === 'AVAILABLE').length,
      outOfService: units.filter((u) => ['OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED'].includes(u.status)).length,
      utilisationPct: units.length
        ? Math.round((units.filter((u) => IN_USE.includes(u.status)).length / units.length) * 100)
        : 0,
    },
    people: { total: staff.length, active: staff.filter((u) => u.active !== false).length, byRole },
    operations: {
      live: live.length,
      overdue: overdue.length,
      bookings30d: bookingsMonth,
      customers,
      openIncidents: incidents,
      openTills: shifts.filter((s) => s.status === 'OPEN').length,
      reconciling: shifts.filter((s) => s.status === 'RECONCILING').length,
      deliveries: deliveries.length,
      deliveriesOpen: deliveries.filter((d) => !['DELIVERED', 'CANCELLED', 'FAILED'].includes(d.status)).length,
    },
    money: {
      today: round2(todaySales.reduce((x, p) => x + p.amount, 0)),
      last30Days: round2(sales.reduce((x, p) => x + p.amount, 0)),
      refunded30Days: round2(refunds.reduce((x, p) => x + p.amount, 0)),
      cash30Days: round2(sales.filter((p) => p.method === 'CASH').reduce((x, p) => x + p.amount, 0)),
      card30Days: round2(sales.filter((p) => p.method !== 'CASH').reduce((x, p) => x + p.amount, 0)),
      expectedInTills: round2(shifts.reduce((x, s) => x + (s.expectedCash ?? 0), 0)),
    },
    byEngine,
    sites: perSite.sort((a, b) => b.revenue30d - a.revenue30d),
  }
}

export async function tenantPeople(scope: ManagerScope) {
  const t = { tenantId: scope.tenantId }
  const [staff, stations, kiosks, bookingAgg, shifts] = await Promise.all([
    User.find(t).sort({ role: 1, fullName: 1 }).lean(),
    Station.find(t).lean(),
    Kiosk.find(t).lean(),
    Booking.aggregate([{ $match: t }, { $group: { _id: '$agentId', bookings: { $sum: 1 } } }]),
    Shift.find({ ...t, status: { $ne: 'CLOSED' } }).lean(),
  ])

  const stationName = new Map(stations.map((s) => [s._id, s.name]))
  const kioskName = new Map(kiosks.map((k) => [k._id, k.name]))
  const handled = new Map(bookingAgg.map((b: { _id: string; bookings: number }) => [b._id, b.bookings]))
  const shiftOf = new Map(shifts.map((s) => [s.agentId, s]))

  return staff.map((u) => {
    const sh = shiftOf.get(u._id)
    return {
      _id: u._id,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      phone: u.phone,
      active: u.active !== false,
      stationId: u.stationId,
      stationName: stationName.get(u.stationId) ?? u.stationId,
      kioskId: u.kioskId ?? null,
      kioskName: u.kioskId ? (kioskName.get(u.kioskId) ?? u.kioskId) : null,
      lastLoginAt: u.lastLoginAt ?? null,
      onShift: !!sh,
      shiftStatus: sh?.status ?? null,
      bookingsHandled: handled.get(u._id) ?? 0,
    }
  })
}

export async function tenantAudit(scope: ManagerScope, limit = 500) {
  const [rows, staff] = await Promise.all([
    Audit.find({ tenantId: scope.tenantId }).sort({ at: -1 }).limit(limit).lean(),
    User.find({ tenantId: scope.tenantId }).lean(),
  ])
  const name = new Map(staff.map((u) => [u._id, u.fullName]))
  return rows.map((r) => ({
    _id: r._id,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    reason: r.reason ?? null,
    detail: r.detail ?? null,
    actorId: r.actorId,
    actorName: name.get(r.actorId) ?? r.actorId,
    at: r.at,
  }))
}

export async function updateCompany(scope: ManagerScope, patch: CompanyPatch) {
  const tenant = await Tenant.findById(scope.tenantId)
  if (!tenant) throw ApiError.notFound('Tenant not found.')

  if (patch.vatRate !== undefined) {
    if (!Number.isFinite(patch.vatRate) || patch.vatRate < 0 || patch.vatRate > 1) {
      throw ApiError.badRequest('VAT rate is a fraction between 0 and 1 (0.15 = 15%).')
    }
    tenant.vatRate = patch.vatRate
  }

  if (patch.enabledEngines) {
    const unknown = patch.enabledEngines.filter((e) => !ENGINE_KINDS.includes(e))
    if (unknown.length) throw ApiError.badRequest(`Unknown engine(s): ${unknown.join(', ')}.`)
    if (patch.enabledEngines.length === 0) throw ApiError.badRequest('At least one engine must stay enabled.')

    const removed = (tenant.enabledEngines ?? []).filter((e) => !patch.enabledEngines!.includes(e))
    if (removed.length) {
      const live = await Booking.countDocuments({
        tenantId: scope.tenantId,
        engineKind: { $in: removed },
        status: { $in: LIVE },
      })
      if (live > 0) {
        throw ApiError.unprocessable(
          `${live} session(s) are still running on ${removed.join(', ')} — finish them before switching the engine off.`,
        )
      }
    }
    tenant.enabledEngines = patch.enabledEngines
  }

  if (patch.name) tenant.name = patch.name.trim()
  if (patch.legalName) tenant.legalName = patch.legalName.trim()
  if (patch.crNumber !== undefined) tenant.crNumber = patch.crNumber.trim()
  if (patch.vatNumber !== undefined) tenant.vatNumber = patch.vatNumber.trim()
  if (patch.currency) tenant.currency = patch.currency.trim().toUpperCase()
  if (patch.company) tenant.company = { ...tenant.company, ...patch.company } as typeof tenant.company
  if (patch.branding) tenant.branding = { ...tenant.branding, ...patch.branding } as typeof tenant.branding

  await tenant.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    action: 'TENANT_COMPANY_UPDATED',
    entity: 'Tenant',
    entityId: tenant._id,
    detail: Object.keys(patch).join(', '),
  })

  return tenant.toObject()
}

export async function tenantIsolationReport(scope: ManagerScope) {
  const t = { tenantId: scope.tenantId }
  const [sites, stations, kiosks, units, users, customers, bookings, payments, deliveries, movements, audits, incidents, shifts] =
    await Promise.all([
      Site.countDocuments(t),
      Station.countDocuments(t),
      Kiosk.countDocuments(t),
      AssetUnit.countDocuments(t),
      User.countDocuments(t),
      Customer.countDocuments(t),
      Booking.countDocuments(t),
      Payment.countDocuments(t),
      DeliveryRequest.countDocuments(t),
      CashMovement.countDocuments(t),
      Audit.countDocuments(t),
      Incident.countDocuments(t),
      Shift.countDocuments(t),
    ])

  return {
    tenantId: scope.tenantId,
    collections: [
      { name: 'Sites', count: sites },
      { name: 'Stations', count: stations },
      { name: 'Kiosks', count: kiosks },
      { name: 'Asset units', count: units },
      { name: 'People', count: users },
      { name: 'Customers', count: customers },
      { name: 'Bookings', count: bookings },
      { name: 'Payments', count: payments },
      { name: 'Deliveries', count: deliveries },
      { name: 'Cash movements', count: movements },
      { name: 'Shifts', count: shifts },
      { name: 'Incidents', count: incidents },
      { name: 'Audit entries', count: audits },
    ],
  }
}
