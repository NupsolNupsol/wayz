import { AssetUnit, Booking, Gate, Kiosk, Site, Station, User } from '../models/index.js'
import { ENGINE_KINDS, type EngineKind } from '../domain/types.js'
import { ApiError } from '../utils/ApiError.js'
import { nextId } from './counter.service.js'

import type { GateInput, KioskInput, SiteInput, StationInput } from '../interfaces/index.js'
import type { ManagerScope } from '../interfaces/index.js'

/** What we ship with. A tenant is not limited to these: any venue type typed on a site joins the list. */
export const VENUE_TYPES = ['AIRPORT', 'MALL', 'STADIUM', 'FESTIVAL', 'HOTEL', 'TRAIN_STATION', 'BEACH', 'RESORT', 'PARK', 'OTHER'] as const

export function venueTypeList(sites: { venueType?: string | null }[]) {
  const seen = new Set<string>(VENUE_TYPES)
  for (const site of sites) {
    const value = (site.venueType ?? '').trim().toUpperCase()
    if (value) seen.add(value)
  }
  return [...seen].sort()
}

const IN_USE = ['OCCUPIED', 'RESERVED', 'RETRIEVAL_PENDING']
const LIVE_BOOKING = ['ACTIVE', 'OVERTIME', 'RETRIEVAL_IN_PROGRESS']

export async function orgTree(scope: ManagerScope) {
  const [sites, stations, kiosks, gates, unitAgg, bookingAgg] = await Promise.all([
    Site.find({ tenantId: scope.tenantId, active: { $ne: false } }).sort({ name: 1 }).lean(),
    Station.find({ tenantId: scope.tenantId, active: { $ne: false } }).sort({ name: 1 }).lean(),
    Kiosk.find({ tenantId: scope.tenantId, active: { $ne: false } }).sort({ name: 1 }).lean(),
    Gate.find({ tenantId: scope.tenantId, active: { $ne: false } }).sort({ name: 1 }).lean(),
    AssetUnit.aggregate([
      { $match: { tenantId: scope.tenantId } },
      {
        $group: {
          _id: { stationId: '$stationId', kioskId: '$kioskId', gateId: '$gateId' },
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

  const byGate = new Map<string, Counts>()

  type UnitRow = { _id: { stationId: string; kioskId: string | null; gateId: string | null } } & Counts
  for (const row of unitAgg as UnitRow[]) {
    const acc = byStation.get(row._id.stationId) ?? { total: 0, available: 0, inUse: 0 }
    acc.total += row.total
    acc.available += row.available
    acc.inUse += row.inUse
    byStation.set(row._id.stationId, acc)
    if (row._id.kioskId) byKiosk.set(row._id.kioskId, { total: row.total, available: row.available, inUse: row.inUse })
    if (row._id.gateId) byGate.set(row._id.gateId, { total: row.total, available: row.available, inUse: row.inUse })
  }

  const activeByStation = new Map(bookingAgg.map((b: { _id: string; active: number }) => [b._id, b.active]))
  const zero: Counts = { total: 0, available: 0, inUse: 0 }

  return {
    venueTypes: venueTypeList(sites),
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
          gates: gates
            .filter((g) => g.stationId === st._id)
            .map((g) => ({ ...g, ...(byGate.get(g._id) ?? zero) })),
        })),
    })),
  }
}

export interface MapPoint {
  _id: string
  kind: 'STATION' | 'KIOSK'
  name: string
  siteId: string
  siteName: string
  stationId: string | null
  stationName: string | null
  engineKinds: EngineKind[]
  active: boolean
  kioskCount: number
  mapX: number | null
  mapY: number | null
}

const coord = (value: unknown) => (typeof value === 'number' ? value : null)

export async function stationMap(tenantId: string, siteId?: string) {
  const [sites, stations, kiosks] = await Promise.all([
    Site.find({ tenantId, active: { $ne: false } }).sort({ name: 1 }).lean(),
    Station.find({ tenantId, active: { $ne: false }, ...(siteId ? { siteId } : {}) }).sort({ name: 1 }).lean(),
    Kiosk.find({ tenantId, active: { $ne: false }, ...(siteId ? { siteId } : {}) }).sort({ name: 1 }).lean(),
  ])

  const siteName = new Map(sites.map((s) => [s._id, s.name]))
  const stationName = new Map(stations.map((s) => [s._id, s.name]))

  const desks = new Map<string, number>()
  for (const kiosk of kiosks) desks.set(kiosk.stationId, (desks.get(kiosk.stationId) ?? 0) + 1)

  const points: MapPoint[] = [
    ...stations.map((s) => ({
      _id: s._id,
      kind: 'STATION' as const,
      name: s.name,
      siteId: s.siteId,
      siteName: siteName.get(s.siteId) ?? s.siteId,
      stationId: null,
      stationName: null,
      engineKinds: (s.engineKinds ?? []) as EngineKind[],
      active: s.active,
      kioskCount: desks.get(s._id) ?? 0,
      mapX: coord(s.mapX),
      mapY: coord(s.mapY),
    })),
    ...kiosks.map((k) => ({
      _id: k._id,
      kind: 'KIOSK' as const,
      name: k.name,
      siteId: k.siteId,
      siteName: siteName.get(k.siteId) ?? k.siteId,
      stationId: k.stationId,
      stationName: stationName.get(k.stationId) ?? k.stationId,
      engineKinds: [k.engineKind] as EngineKind[],
      active: k.active,
      kioskCount: 0,
      mapX: coord(k.mapX),
      mapY: coord(k.mapY),
    })),
  ]

  return {
    sites: sites.map((s) => ({ _id: s._id, name: s.name, city: s.city })),
    points,
    stations: points.filter((p) => p.kind === 'STATION'),
  }
}

export async function saveStationMap(
  tenantId: string,
  placements: { id: string; x: number | null; y: number | null }[],
) {
  const ids = placements.map((p) => p.id)
  const [stations, kiosks] = await Promise.all([
    Station.find({ tenantId, _id: { $in: ids } }, { _id: 1 }).lean(),
    Kiosk.find({ tenantId, _id: { $in: ids } }, { _id: 1 }).lean(),
  ])
  const isStation = new Set(stations.map((s) => s._id))
  const isKiosk = new Set(kiosks.map((k) => k._id))

  const missing = ids.filter((id) => !isStation.has(id) && !isKiosk.has(id))
  if (missing.length) throw ApiError.badRequest(`Nothing in this tenant to place: ${missing.join(', ')}.`)

  for (const placement of placements) {
    const placed = placement.x !== null && placement.y !== null
    const patch = {
      mapX: placed ? clampUnit(placement.x as number) : null,
      mapY: placed ? clampUnit(placement.y as number) : null,
    }
    if (isStation.has(placement.id)) {
      await Station.updateOne({ _id: placement.id, tenantId }, { $set: patch })
    } else {
      await Kiosk.updateOne({ _id: placement.id, tenantId }, { $set: patch })
    }
  }

  return stationMap(tenantId)
}

function clampUnit(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, Math.round(value * 10000) / 10000))
}

/** A venue type is free text with house style applied, so a tenant can name a venue we never thought of. */
function normaliseVenueType(raw?: string | null) {
  const value = (raw ?? '').trim().toUpperCase().replace(/\s+/g, '_').slice(0, 40)
  return value || 'MALL'
}

export async function createSite(scope: ManagerScope, input: SiteInput) {
  return Site.create({
    _id: await nextId('site'),
    tenantId: scope.tenantId,
    name: input.name.trim(),
    city: input.city.trim(),
    venueType: normaliseVenueType(input.venueType),
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

  const clean = sanitise(patch)
  if (clean.venueType !== undefined) clean.venueType = normaliseVenueType(clean.venueType as string)
  Object.assign(site, clean)
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
  assertStationRuns(station.engineKinds, station.name, input.engineKind)

  return Kiosk.create({
    _id: await nextId('kiosk'),
    tenantId: scope.tenantId,
    siteId: station.siteId,
    stationId: input.stationId,
    name: input.name.trim(),
    code: input.code ?? '',
    location: input.location ?? '',
    engineKind: input.engineKind,
    isExitGate: !!input.isExitGate,
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

  if (patch.engineKind && patch.engineKind !== kiosk.engineKind) {
    const held = await AssetUnit.countDocuments({ tenantId: scope.tenantId, kioskId: id })
    if (held > 0) {
      throw ApiError.unprocessable(
        `${kiosk.name} holds ${held} unit(s) of its current activity — move them out before changing what it runs.`,
      )
    }
    const staffed = await User.countDocuments({ tenantId: scope.tenantId, kioskId: id, active: true })
    if (staffed > 0) {
      throw ApiError.unprocessable(`${kiosk.name} still has ${staffed} staff member(s) assigned — reassign them first.`)
    }
    const station = await Station.findOne({ _id: kiosk.stationId, tenantId: scope.tenantId }).lean()
    assertStationRuns(station?.engineKinds ?? [], station?.name ?? 'That station', patch.engineKind)
  }

  Object.assign(kiosk, sanitise(patch))
  await kiosk.save()
  return kiosk
}

export async function removeKiosk(scope: ManagerScope, id: string) {
  const kiosk = await Kiosk.findOne({ _id: id, tenantId: scope.tenantId })
  if (!kiosk) throw ApiError.notFound('Kiosk not found.')

  const [units, staff, live] = await Promise.all([
    AssetUnit.countDocuments({ tenantId: scope.tenantId, kioskId: id }),
    User.countDocuments({ tenantId: scope.tenantId, kioskId: id }),
    Booking.countDocuments({ tenantId: scope.tenantId, kioskId: id, status: { $in: LIVE_BOOKING } }),
  ])
  if (live > 0) throw ApiError.unprocessable(`${kiosk.name} still has ${live} live session(s) — finish them first.`)
  if (units > 0) throw ApiError.unprocessable(`${kiosk.name} still holds ${units} unit(s) — move them to another desk first.`)
  if (staff > 0) throw ApiError.unprocessable(`${kiosk.name} still has ${staff} staff member(s) assigned — reassign them first.`)

  kiosk.active = false
  await kiosk.save()
  return { removed: id, name: kiosk.name }
}

export async function removeStation(scope: ManagerScope, id: string) {
  const station = await Station.findOne({ _id: id, tenantId: scope.tenantId })
  if (!station) throw ApiError.notFound('Station not found.')

  const [live, desks, units, staff] = await Promise.all([
    Booking.countDocuments({ tenantId: scope.tenantId, stationId: id, status: { $in: LIVE_BOOKING } }),
    Kiosk.countDocuments({ tenantId: scope.tenantId, stationId: id, active: { $ne: false } }),
    AssetUnit.countDocuments({ tenantId: scope.tenantId, stationId: id }),
    User.countDocuments({ tenantId: scope.tenantId, stationId: id, active: true }),
  ])

  if (live > 0) throw ApiError.unprocessable(`${station.name} still has ${live} live session(s) — finish them first.`)
  if (desks > 0) throw ApiError.unprocessable(`${station.name} still has ${desks} desk(s) — remove them first.`)
  if (units > 0) throw ApiError.unprocessable(`${station.name} still holds ${units} asset(s) — move them first.`)
  if (staff > 0) throw ApiError.unprocessable(`${station.name} still has ${staff} staff member(s) — reassign them first.`)

  station.active = false
  await station.save()
  return { removed: id, name: station.name }
}

export async function removeSite(scope: ManagerScope, id: string) {
  const site = await Site.findOne({ _id: id, tenantId: scope.tenantId })
  if (!site) throw ApiError.notFound('Site not found.')

  const stations = await Station.countDocuments({ tenantId: scope.tenantId, siteId: id, active: true })
  if (stations > 0) throw ApiError.unprocessable(`${site.name} still has ${stations} live station(s) — remove them first.`)

  site.active = false
  await site.save()
  return { removed: id, name: site.name }
}

function assertStationRuns(runs: EngineKind[], stationName: string, engineKind: EngineKind) {
  if (!ENGINE_KINDS.includes(engineKind)) throw ApiError.badRequest(`Unknown activity "${engineKind}".`)
  if (!runs.includes(engineKind)) {
    throw ApiError.badRequest(`${stationName} does not run ${engineKind.replaceAll('_', ' ').toLowerCase()}.`)
  }
}

function sanitise<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>
}

/**
 * The gates of a station, and what each one is holding.
 *
 * Read by the desk that has to allocate a locker as much as by the admin who builds the estate,
 * so it carries the counts rather than making every caller aggregate them again.
 */
export async function stationGates(tenantId: string, stationId?: string) {
  const q: Record<string, unknown> = { tenantId, active: { $ne: false } }
  if (stationId) q.stationId = stationId

  const gates = await Gate.find(q).sort({ name: 1 }).lean()
  if (gates.length === 0) return []

  type GateCounts = { _id: string; total: number; available: number; inUse: number }
  const counts = (await AssetUnit.aggregate([
    { $match: { tenantId, gateId: { $in: gates.map((g) => g._id) } } },
    {
      $group: {
        _id: '$gateId',
        total: { $sum: 1 },
        available: { $sum: { $cond: [{ $eq: ['$status', 'AVAILABLE'] }, 1, 0] } },
        inUse: { $sum: { $cond: [{ $in: ['$status', IN_USE] }, 1, 0] } },
      },
    },
  ])) as GateCounts[]
  const byGate = new Map(counts.map((c) => [c._id, c]))

  return gates.map((g) => ({
    ...g,
    total: byGate.get(g._id)?.total ?? 0,
    available: byGate.get(g._id)?.available ?? 0,
    inUse: byGate.get(g._id)?.inUse ?? 0,
  }))
}

export async function createGate(scope: ManagerScope, input: GateInput) {
  const station = await Station.findOne({ _id: input.stationId, tenantId: scope.tenantId }).lean()
  if (!station) throw ApiError.badRequest('That station does not exist in this tenant.')

  const name = input.name.trim()
  if (name.length < 2) throw ApiError.badRequest('Give the gate a name.')

  const clash = await Gate.findOne({ tenantId: scope.tenantId, stationId: input.stationId, name, active: { $ne: false } }).lean()
  if (clash) throw ApiError.badRequest(`${station.name} already has a gate called ${name}.`)

  return Gate.create({
    _id: await nextId('gate'),
    tenantId: scope.tenantId,
    siteId: station.siteId,
    stationId: input.stationId,
    name,
    code: input.code ?? '',
    location: input.location ?? '',
    active: true,
  })
}

export async function updateGate(scope: ManagerScope, id: string, patch: Partial<GateInput> & { active?: boolean }) {
  const gate = await Gate.findOne({ _id: id, tenantId: scope.tenantId })
  if (!gate) throw ApiError.notFound('Gate not found.')

  if (patch.active === false) {
    const busy = await AssetUnit.countDocuments({ tenantId: scope.tenantId, gateId: id, status: { $in: IN_USE } })
    if (busy > 0) throw ApiError.unprocessable(`${gate.name} has ${busy} locker(s) in use — empty it first.`)
  }

  Object.assign(gate, sanitise(patch))
  await gate.save()
  return gate
}

export async function removeGate(scope: ManagerScope, id: string) {
  const gate = await Gate.findOne({ _id: id, tenantId: scope.tenantId })
  if (!gate) throw ApiError.notFound('Gate not found.')

  // Closing a gate with lockers in it, or staff posted to it, would strand both.
  const [units, staff] = await Promise.all([
    AssetUnit.countDocuments({ tenantId: scope.tenantId, gateId: id }),
    User.countDocuments({ tenantId: scope.tenantId, gateId: id, active: true }),
  ])
  if (units > 0) throw ApiError.unprocessable(`${gate.name} still holds ${units} locker(s) — move them to another gate first.`)
  if (staff > 0) throw ApiError.unprocessable(`${gate.name} still has ${staff} staff member(s) posted to it — reassign them first.`)

  gate.active = false
  await gate.save()
  return { removed: id, name: gate.name }
}
