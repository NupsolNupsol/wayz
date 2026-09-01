import { AssetUnit, Booking, Kiosk, Site, Station } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { nextId } from './counter.service.js'

import type { KioskInput, SiteInput, StationInput } from '../interfaces/index.js'
import type { ManagerScope } from '../interfaces/index.js'

export const VENUE_TYPES = ['AIRPORT', 'MALL', 'STADIUM', 'FESTIVAL', 'HOTEL', 'TRAIN_STATION', 'OTHER'] as const

const IN_USE = ['OCCUPIED', 'RESERVED', 'RETRIEVAL_PENDING']
const LIVE_BOOKING = ['ACTIVE', 'OVERTIME', 'RETRIEVAL_IN_PROGRESS']

export async function orgTree(scope: ManagerScope) {
  const [sites, stations, kiosks, unitAgg, bookingAgg] = await Promise.all([
    Site.find({ tenantId: scope.tenantId }).sort({ name: 1 }).lean(),
    Station.find({ tenantId: scope.tenantId }).sort({ name: 1 }).lean(),
    Kiosk.find({ tenantId: scope.tenantId }).sort({ name: 1 }).lean(),
    AssetUnit.aggregate([
      { $match: { tenantId: scope.tenantId } },
      {
        $group: {
          _id: { stationId: '$stationId', kioskId: '$kioskId' },
          total: { $sum: 1 },
          available: { $sum: { $cond: [{ $eq: ['$status', 'AVAILABLE'] }, 1, 0] } },
          inUse: { $sum: { $cond: [{ $in: ['$status', IN_USE] }, 1, 0] } },
        },
      },
    ]),
    Booking.aggregate([
      { $match: { tenantId: scope.tenantId, status: { $in: LIVE_BOOKING } } },
      { $group: { _id: '$stationId', active: { $sum: 1 } } },
    ]),
  ])

  type Counts = { total: number; available: number; inUse: number }
  const byStation = new Map<string, Counts>()
  const byKiosk = new Map<string, Counts>()

  type UnitRow = { _id: { stationId: string; kioskId: string | null } } & Counts
  for (const row of unitAgg as UnitRow[]) {
    const acc = byStation.get(row._id.stationId) ?? { total: 0, available: 0, inUse: 0 }
    acc.total += row.total
    acc.available += row.available
    acc.inUse += row.inUse
    byStation.set(row._id.stationId, acc)
    if (row._id.kioskId) byKiosk.set(row._id.kioskId, { total: row.total, available: row.available, inUse: row.inUse })
  }

  const activeByStation = new Map(bookingAgg.map((b: { _id: string; active: number }) => [b._id, b.active]))
  const zero: Counts = { total: 0, available: 0, inUse: 0 }

  return {
    venueTypes: [...VENUE_TYPES],
    sites: sites.map((site) => ({
      ...site,
      stations: stations
        .filter((st) => st.siteId === site._id)
        .map((st) => ({
          ...st,
          ...(byStation.get(st._id) ?? zero),
          activeSessions: activeByStation.get(st._id) ?? 0,
          kiosks: kiosks
            .filter((k) => k.stationId === st._id)
            .map((k) => ({ ...k, ...(byKiosk.get(k._id) ?? zero) })),
        })),
    })),
  }
}

export async function createSite(scope: ManagerScope, input: SiteInput) {
  return Site.create({
    _id: await nextId('site'),
    tenantId: scope.tenantId,
    name: input.name.trim(),
    city: input.city.trim(),
    venueType: input.venueType ?? 'MALL',
    address: input.address ?? '',
    contactPhone: input.contactPhone ?? '',
    active: true,
  })
}

export async function updateSite(scope: ManagerScope, id: string, patch: Partial<SiteInput> & { active?: boolean }) {
  const site = await Site.findOne({ _id: id, tenantId: scope.tenantId })
  if (!site) throw ApiError.notFound('Site not found.')

  if (patch.active === false) {
    const live = await Booking.countDocuments({
      tenantId: scope.tenantId,
      stationId: { $in: (await Station.find({ tenantId: scope.tenantId, siteId: id }).lean()).map((s) => s._id) },
      status: { $in: LIVE_BOOKING },
    })
    if (live > 0) throw ApiError.unprocessable(`This site still has ${live} live session(s) across its stations.`)
  }

  Object.assign(site, sanitise(patch))
  await site.save()
  return site
}

export async function createStation(scope: ManagerScope, input: StationInput) {
  const site = await Site.findOne({ _id: input.siteId, tenantId: scope.tenantId }).lean()
  if (!site) throw ApiError.badRequest('That site does not exist in this tenant.')

  return Station.create({
    _id: await nextId('station'),
    tenantId: scope.tenantId,
    siteId: input.siteId,
    zoneId: '',
    name: input.name.trim(),
    code: input.code ?? '',
    engineKinds: input.engineKinds ?? [],
    openingTime: input.openingTime ?? '08:00',
    closingTime: input.closingTime ?? '22:00',
    contactPhone: input.contactPhone ?? '',
    active: true,
  })
}

export async function updateStation(scope: ManagerScope, id: string, patch: Partial<StationInput> & { active?: boolean }) {
  const station = await Station.findOne({ _id: id, tenantId: scope.tenantId })
  if (!station) throw ApiError.notFound('Station not found.')

  if (patch.active === false) {
    const live = await Booking.countDocuments({ tenantId: scope.tenantId, stationId: id, status: { $in: LIVE_BOOKING } })
    if (live > 0) {
      throw ApiError.unprocessable(`${station.name} still has ${live} live session(s) — close them before deactivating it.`)
    }
  }

  Object.assign(station, sanitise(patch))
  await station.save()
  return station
}

export async function createKiosk(scope: ManagerScope, input: KioskInput) {
  const station = await Station.findOne({ _id: input.stationId, tenantId: scope.tenantId }).lean()
  if (!station) throw ApiError.badRequest('That station does not exist in this tenant.')

  return Kiosk.create({
    _id: await nextId('kiosk'),
    tenantId: scope.tenantId,
    siteId: station.siteId,
    stationId: input.stationId,
    name: input.name.trim(),
    code: input.code ?? '',
    location: input.location ?? '',
    engineKinds: input.engineKinds ?? station.engineKinds,
    active: true,
  })
}

export async function updateKiosk(scope: ManagerScope, id: string, patch: Partial<KioskInput> & { active?: boolean }) {
  const kiosk = await Kiosk.findOne({ _id: id, tenantId: scope.tenantId })
  if (!kiosk) throw ApiError.notFound('Kiosk not found.')

  if (patch.active === false) {
    const busy = await AssetUnit.countDocuments({ tenantId: scope.tenantId, kioskId: id, status: { $in: IN_USE } })
    if (busy > 0) throw ApiError.unprocessable(`${kiosk.name} has ${busy} unit(s) in use — empty it first.`)
  }

  Object.assign(kiosk, sanitise(patch))
  await kiosk.save()
  return kiosk
}

function sanitise<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>
}
