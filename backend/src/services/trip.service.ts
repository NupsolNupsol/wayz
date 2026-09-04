import { AssetType, AssetUnit, Booking, Kiosk, Station, Trip, User } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { formatId, nextSequence, pad } from './counter.service.js'
import { recordAudit } from './audit.service.js'
import { stationMap } from './org.service.js'
import { raise } from './notification.service.js'
import { outstandingFor, transitionBooking } from './booking.service.js'
import { canWorkEngine } from '../domain/access.js'
import type { Scope } from '../interfaces/index.js'

function peopleOn(booking: { metadata?: Record<string, unknown> | null }): number {
  const visitors = Number((booking.metadata ?? {}).visitors ?? 1)
  return Number.isFinite(visitors) && visitors > 0 ? Math.floor(visitors) : 1
}

export interface BoatSpace {
  _id: string
  identifier: string
  assetTypeId: string
  assetTypeName: string
  seats: number
  taken: number
  free: number
  tripId: string | null
  tripRef: string | null
  status: 'EMPTY' | 'FILLING' | 'FULL'
}

const FILLING_BOOKINGS = ['CONFIRMED', 'ACTIVE', 'OVERTIME']

export async function boatsWithRoom(scope: Scope, assetTypeId?: string): Promise<BoatSpace[]> {
  if (!canWorkEngine(scope, 'LAGOON')) throw ApiError.forbidden('You are not assigned to the lagoon.')

  const units = await AssetUnit.find({
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    ...(assetTypeId ? { assetTypeId } : {}),
    status: { $in: ['AVAILABLE', 'RESERVED'] },
  })
    .sort({ identifier: 1 })
    .lean()

  const boats = units.filter((u) => u.assetTypeId.includes('boat'))
  if (boats.length === 0) return []

  const types = await AssetType.find(
    { tenantId: scope.tenantId, _id: { $in: [...new Set(boats.map((u) => u.assetTypeId))] } },
    { name: 1, capacity: 1 },
  ).lean()
  const byType = new Map(types.map((t) => [t._id, t]))

  const [aboard, trips] = await Promise.all([
    Booking.find(
      {
        tenantId: scope.tenantId,
        engineKind: 'LAGOON',
        status: { $in: FILLING_BOOKINGS },
        assetUnitId: { $in: boats.map((u) => u._id) },
      },
      { assetUnitId: 1, metadata: 1 },
    ).lean(),
    Trip.find(
      {
        tenantId: scope.tenantId,
        status: { $in: ['FILLING', 'READY', 'CLAIMED'] },
        assetUnitId: { $in: boats.map((u) => u._id) },
      },
      { assetUnitId: 1, ref: 1 },
    ).lean(),
  ])

  const taken = new Map<string, number>()
  for (const booking of aboard) {
    const id = booking.assetUnitId as string
    taken.set(id, (taken.get(id) ?? 0) + peopleOn(booking))
  }
  const tripOf = new Map(trips.map((t) => [t.assetUnitId as string, t]))

  return boats
    .map((unit) => {
      const seats = Math.max(1, byType.get(unit.assetTypeId)?.capacity?.seats ?? 1)
      const used = taken.get(unit._id) ?? 0
      const free = Math.max(0, seats - used)
      const trip = tripOf.get(unit._id) ?? null
      return {
        _id: unit._id,
        identifier: unit.identifier,
        assetTypeId: unit.assetTypeId,
        assetTypeName: byType.get(unit.assetTypeId)?.name ?? unit.assetTypeId,
        seats,
        taken: used,
        free,
        tripId: trip?._id ?? null,
        tripRef: trip?.ref ?? null,
        status: (free === 0 ? 'FULL' : used === 0 ? 'EMPTY' : 'FILLING') as BoatSpace['status'],
      }
    })
    .sort((a, b) => b.free - a.free || a.identifier.localeCompare(b.identifier))
}

export async function seatsLeftOn(scope: Scope, unitId: string) {
  const boats = await boatsWithRoom(scope)
  const boat = boats.find((b) => b._id === unitId)
  if (!boat) throw ApiError.badRequest('That boat is not available at this desk.')
  return boat
}

export async function seatOnBoat(scope: Scope, booking: {
  _id: string
  ref: string
  customerName: string
  assetUnitId?: string | null
  metadata?: Record<string, unknown> | null
}) {
  const unitId = booking.assetUnitId
  if (!unitId) return null

  const unit = await AssetUnit.findOne({ _id: unitId, tenantId: scope.tenantId }).lean()
  if (!unit) return null

  const type = await AssetType.findOne({ _id: unit.assetTypeId, tenantId: scope.tenantId }, { name: 1, capacity: 1 }).lean()
  const seats = Math.max(1, type?.capacity?.seats ?? 1)
  const people = peopleOn(booking)

  let trip = await Trip.findOne({
    tenantId: scope.tenantId,
    assetUnitId: unitId,
    status: { $in: ['FILLING', 'READY'] },
  })

  if (!trip) {
    const seq = await nextSequence('trip')
    trip = await Trip.create({
      _id: formatId('trip', seq),
      ref: `TRP-${pad(seq)}`,
      tenantId: scope.tenantId,
      stationId: scope.stationId,
      kioskId: scope.kioskId ?? null,
      assetTypeId: unit.assetTypeId,
      assetTypeName: type?.name ?? unit.assetTypeId,
      seats,
      assetUnitId: unit._id,
      assetUnitIdentifier: unit.identifier,
      passengers: [],
      headcount: 0,
      status: 'FILLING',
      createdBy: scope.agentId,
    })
  }

  if (trip.passengers.some((p) => p.bookingId === booking._id)) return trip.toObject()

  trip.passengers.push({
    bookingId: booking._id,
    bookingRef: booking.ref,
    customerName: booking.customerName,
    people,
  })
  trip.headcount += people

  const full = trip.headcount >= trip.seats
  if (full && trip.status === 'FILLING') trip.status = 'READY'
  await trip.save()

  await Booking.updateOne({ _id: booking._id }, { $set: { 'metadata.tripId': trip._id } })

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: full ? 'TRIP_READY' : 'TRIP_SEATED',
    entity: 'Trip',
    entityId: trip._id,
    detail: `${booking.ref} · ${people} aboard ${trip.assetUnitIdentifier} (${trip.headcount}/${trip.seats})`,
  })

  if (full) {
    await raise({
      tenantId: scope.tenantId,
      stationId: scope.stationId,
      engineKind: 'LAGOON',
      title: 'A boat is full and waiting for a captain',
      body: `${trip.ref} · ${trip.assetUnitIdentifier ?? trip.assetTypeName} — ${trip.headcount} aboard, ready to sail.`,
      level: 'info',
      audience: ['CHIEF_CAPTAIN'],
      link: '/lagoon/trips',
    })
  }

  return trip.toObject()
}

export async function releaseTrip(scope: Scope, tripId: string) {
  const trip = await Trip.findOne({ _id: tripId, tenantId: scope.tenantId, stationId: scope.stationId })
  if (!trip) throw ApiError.notFound('Trip not found.')
  if (trip.status !== 'FILLING') throw ApiError.unprocessable(`${trip.ref} is already ${trip.status.toLowerCase()}.`)
  if (trip.headcount === 0) throw ApiError.unprocessable('Nobody is on that boat yet.')

  trip.status = 'READY'
  await trip.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'TRIP_RELEASED',
    entity: 'Trip',
    entityId: trip._id,
    detail: `${trip.ref} sent to the captains with ${trip.headcount} of ${trip.seats} seats filled`,
  })

  await raise({
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    engineKind: 'LAGOON',
    title: 'A boat is waiting for a captain',
    body: `${trip.ref} · ${trip.assetUnitIdentifier ?? trip.assetTypeName} — ${trip.headcount} aboard, sent early by the desk.`,
    level: 'info',
    audience: ['CHIEF_CAPTAIN'],
    link: '/lagoon/trips',
  })

  return trip.toObject()
}

export async function tripBoard(scope: Scope, mine = false) {
  const base = { tenantId: scope.tenantId, stationId: scope.stationId }
  const [ready, running, done, filling] = await Promise.all([
    Trip.find({ ...base, status: 'READY' }).sort({ createdAt: 1 }).lean(),
    Trip.find({
      ...base,
      status: { $in: ['CLAIMED', 'RUNNING'] },
      ...(mine ? { captainId: scope.agentId } : {}),
    })
      .sort({ createdAt: 1 })
      .lean(),
    Trip.find({ ...base, status: { $in: ['COMPLETED', 'CANCELLED'] } }).sort({ endedAt: -1 }).limit(25).lean(),
    Trip.find({ ...base, status: 'FILLING' }).sort({ createdAt: 1 }).lean(),
  ])
  return { ready, running, done, filling }
}

export async function tripDetail(scope: Scope, tripId: string) {
  const trip = await Trip.findOne({ _id: tripId, tenantId: scope.tenantId }).lean()
  if (!trip) throw ApiError.notFound('Trip not found.')
  const home = await Station.findOne({ _id: trip.stationId, tenantId: scope.tenantId }, { siteId: 1 }).lean()
  const map = await stationMap(scope.tenantId, home?.siteId)
  const stations = map.points.filter((p) => p.active && (p.kind === 'STATION' || p.engineKinds.includes('LAGOON')))

  return { trip, stations }
}

async function stopNames(tenantId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>()
  const [stations, kiosks] = await Promise.all([
    Station.find({ tenantId, _id: { $in: ids } }, { name: 1 }).lean(),
    Kiosk.find({ tenantId, _id: { $in: ids } }, { name: 1 }).lean(),
  ])
  return new Map<string, string>([
    ...stations.map((s) => [s._id, s.name] as [string, string]),
    ...kiosks.map((k) => [k._id, k.name] as [string, string]),
  ])
}

export async function setTripRoute(scope: Scope, tripId: string, stationIds: string[]) {
  const trip = await Trip.findOne({ _id: tripId, tenantId: scope.tenantId })
  if (!trip) throw ApiError.notFound('Trip not found.')
  if (trip.captainId !== scope.agentId) throw ApiError.forbidden('That trip belongs to another captain.')
  if (!['CLAIMED', 'RUNNING'].includes(trip.status)) {
    throw ApiError.unprocessable(`A route cannot be planned on a trip that is ${trip.status.toLowerCase()}.`)
  }

  const wanted = [...new Set(stationIds)]
  const byId = await stopNames(scope.tenantId, wanted)
  const missing = wanted.filter((id) => !byId.has(id))
  if (missing.length) throw ApiError.badRequest(`Not a stop in this tenant: ${missing.join(', ')}.`)

  const clocked = new Set(trip.stops.map((stop) => stop.stationId))
  const dropped = [...clocked].filter((id) => !wanted.includes(id))
  if (dropped.length) {
    throw ApiError.unprocessable('A stop already reached cannot be taken off the route.', [
      dropped.map((id) => trip.stops.find((s) => s.stationId === id)?.name ?? id).join(', '),
    ])
  }

  trip.route = stationIds
    .filter((id, i) => stationIds.indexOf(id) === i)
    .map((id) => ({ stationId: id, name: byId.get(id) ?? id }))
  await trip.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'TRIP_ROUTE_SET',
    entity: 'Trip',
    entityId: trip._id,
    detail: `${trip.ref}: ${trip.route.map((leg) => leg.name).join(' → ') || 'cleared'}`,
  })
  return trip.toObject()
}

export async function claimTrip(scope: Scope, tripId: string) {
  const trip = await Trip.findOne({ _id: tripId, tenantId: scope.tenantId })
  if (!trip) throw ApiError.notFound('Trip not found.')
  if (trip.status !== 'READY') throw ApiError.unprocessable(`${trip.ref} has already been taken.`)

  const captain = await User.findById(scope.agentId, { fullName: 1 }).lean()
  trip.status = 'CLAIMED'
  trip.captainId = scope.agentId
  trip.captainName = captain?.fullName ?? scope.agentId
  await trip.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'TRIP_CLAIMED',
    entity: 'Trip',
    entityId: trip._id,
    detail: trip.ref,
  })
  return trip.toObject()
}

function deskScopeOf(scope: Scope, trip: { stationId: string; kioskId: string | null }): Scope {
  return { ...scope, stationId: trip.stationId, kioskId: trip.kioskId }
}

export async function startTrip(scope: Scope, tripId: string, input: { unitId?: string } = {}) {
  const trip = await Trip.findOne({ _id: tripId, tenantId: scope.tenantId })
  if (!trip) throw ApiError.notFound('Trip not found.')
  if (trip.captainId !== scope.agentId) throw ApiError.forbidden('That trip belongs to another captain.')
  if (trip.status !== 'CLAIMED') throw ApiError.unprocessable(`${trip.ref} cannot be started from ${trip.status}.`)
  if ((trip.route ?? []).length === 0) {
    throw ApiError.unprocessable('Plan the road before casting off.', [
      'Open the chart and tap the jetties you will sail, in order.',
    ])
  }

  const wanted = trip.assetUnitId ?? input.unitId
  const boat = wanted
    ? await AssetUnit.findOne({ _id: wanted, tenantId: scope.tenantId, assetTypeId: trip.assetTypeId })
    : await AssetUnit.findOne({
        tenantId: scope.tenantId,
        stationId: trip.stationId,
        assetTypeId: trip.assetTypeId,
        status: 'AVAILABLE',
      })
  if (!boat) throw ApiError.unprocessable('The boat on this trip is no longer at this station.')
  if (!['AVAILABLE', 'RESERVED'].includes(boat.status)) {
    throw ApiError.unprocessable(`${boat.identifier} is ${boat.status.toLowerCase()}.`)
  }

  const desk = deskScopeOf(scope, trip)
  const boarded = new Set<string>()
  for (const passenger of trip.passengers) {
    if (boarded.has(passenger.bookingId)) continue
    boarded.add(passenger.bookingId)

    const booking = await Booking.findOne({ _id: passenger.bookingId, tenantId: scope.tenantId }, { status: 1 }).lean()
    if (!booking) continue
    if (['ACTIVE', 'OVERTIME', 'COMPLETED', 'CANCELLED'].includes(booking.status)) continue

    await transitionBooking(desk, passenger.bookingId, 'TO_STARTED', {
      safetyAck: true,
      boardingVerified: true,
      unitId: boat._id,
      durationMin: 60,
    })
  }

  boat.status = 'OCCUPIED'
  await boat.save()

  trip.status = 'RUNNING'
  trip.assetUnitId = boat._id
  trip.assetUnitIdentifier = boat.identifier
  trip.startedAt = new Date()
  await trip.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'TRIP_STARTED',
    entity: 'Trip',
    entityId: trip._id,
    detail: `${trip.ref} on ${boat.identifier} with ${trip.headcount} aboard`,
  })
  return trip.toObject()
}

export async function clockStation(scope: Scope, tripId: string, stationId: string) {
  const trip = await Trip.findOne({ _id: tripId, tenantId: scope.tenantId })
  if (!trip) throw ApiError.notFound('Trip not found.')
  if (trip.captainId !== scope.agentId) throw ApiError.forbidden('That trip belongs to another captain.')
  if (trip.status !== 'RUNNING') throw ApiError.unprocessable('Only a trip that is under way can reach a station.')

  const names = await stopNames(scope.tenantId, [stationId])
  const name = names.get(stationId)
  if (!name) throw ApiError.badRequest('That stop does not exist in this tenant.')

  const last = trip.stops[trip.stops.length - 1]
  if (last?.stationId === stationId) throw ApiError.unprocessable(`${name} is already the last stop clocked.`)

  trip.stops.push({ stationId, name, at: new Date() })
  await trip.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'TRIP_STOP_REACHED',
    entity: 'Trip',
    entityId: trip._id,
    detail: `${trip.ref} reached ${name}`,
  })
  return trip.toObject()
}

export async function completeTrip(scope: Scope, tripId: string) {
  const trip = await Trip.findOne({ _id: tripId, tenantId: scope.tenantId })
  if (!trip) throw ApiError.notFound('Trip not found.')
  if (trip.captainId !== scope.agentId) throw ApiError.forbidden('That trip belongs to another captain.')
  if (trip.status !== 'RUNNING') throw ApiError.unprocessable('Only a trip under way can be finished.')

  for (const passenger of trip.passengers) {
    const owed = await bookingOutstanding(scope.tenantId, passenger.bookingId)
    if (owed > 0) {
      throw ApiError.unprocessable(`${passenger.bookingRef} still owes ${owed.toFixed(2)}.`, [
        'The desk has to take it before the trip can be closed.',
      ])
    }
  }

  const desk = deskScopeOf(scope, trip)
  const finished = new Set<string>()
  for (const passenger of trip.passengers) {
    if (finished.has(passenger.bookingId)) continue
    finished.add(passenger.bookingId)

    const booking = await Booking.findOne({ _id: passenger.bookingId, tenantId: scope.tenantId }, { status: 1 }).lean()
    if (booking?.status === 'COMPLETED' || booking?.status === 'CANCELLED') continue

    const stillAboard = await Trip.countDocuments({
      tenantId: scope.tenantId,
      _id: { $ne: trip._id },
      status: { $in: ['CLAIMED', 'RUNNING'] },
      'passengers.bookingId': passenger.bookingId,
    })
    if (stillAboard > 0) continue

    await transitionBooking(desk, passenger.bookingId, 'TO_COMPLETED', {})
  }

  if (trip.assetUnitId) {
    await AssetUnit.updateOne({ _id: trip.assetUnitId, tenantId: scope.tenantId }, { $set: { status: 'AVAILABLE' } })
  }

  trip.status = 'COMPLETED'
  trip.endedAt = new Date()
  await trip.save()

  await recordAudit({
    tenantId: scope.tenantId,
    actorId: scope.agentId,
    action: 'TRIP_COMPLETED',
    entity: 'Trip',
    entityId: trip._id,
    detail: `${trip.ref} · ${trip.stops.length} stop(s)`,
  })
  return trip.toObject()
}

async function bookingOutstanding(tenantId: string, bookingId: string): Promise<number> {
  return outstandingFor(tenantId, bookingId)
}
