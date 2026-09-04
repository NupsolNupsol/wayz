import mongoose from 'mongoose'
import { AssetType, AssetUnit, Booking, Kiosk, Station, Trip, User } from '../models/index.js'
import type { TripDoc } from '../models/index.js'

type TripHydrated = mongoose.HydratedDocument<TripDoc>
import { ApiError } from '../utils/ApiError.js'
import { formatId, nextSequence, pad } from './counter.service.js'
import { recordAudit } from './audit.service.js'
import { stationMap } from './org.service.js'
import { raise } from './notification.service.js'
import { outstandingFor, transitionBooking } from './booking.service.js'
import type { Scope } from '../interfaces/index.js'

function peopleOn(booking: { metadata?: Record<string, unknown> | null }): number {
  const visitors = Number((booking.metadata ?? {}).visitors ?? 1)
  return Number.isFinite(visitors) && visitors > 0 ? Math.floor(visitors) : 1
}

export async function waitingForABoat(scope: Scope) {
  const bookings = await Booking.find({
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    engineKind: 'LAGOON',
    status: 'CONFIRMED',
  })
    .sort({ createdAt: 1 })
    .lean()

  const untripped = bookings.filter((b) => !(b.metadata ?? {}).tripId)
  const typeIds = [...new Set(untripped.map((b) => (b.metadata ?? {}).assetTypeId as string).filter(Boolean))]
  const types = await AssetType.find({ tenantId: scope.tenantId, _id: { $in: typeIds } }).lean()
  const byType = new Map(types.map((t) => [t._id, t]))

  const groups = new Map<string, { assetTypeId: string; name: string; seats: number; people: number; bookings: typeof untripped }>()
  for (const booking of untripped) {
    const assetTypeId = (booking.metadata ?? {}).assetTypeId as string | undefined
    if (!assetTypeId) continue
    const type = byType.get(assetTypeId)
    const group = groups.get(assetTypeId) ?? {
      assetTypeId,
      name: type?.name ?? assetTypeId,
      seats: Math.max(1, type?.capacity?.seats ?? 1),
      people: 0,
      bookings: [],
    }
    group.people += peopleOn(booking)
    group.bookings.push(booking)
    groups.set(assetTypeId, group)
  }

  return [...groups.values()].map((g) => ({
    assetTypeId: g.assetTypeId,
    name: g.name,
    seats: g.seats,
    people: g.people,
    bookings: g.bookings.map((b) => ({ _id: b._id, ref: b.ref, customerName: b.customerName, people: peopleOn(b) })),
    boatsNeeded: Math.ceil(g.people / g.seats),
  }))
}

export async function planTrips(scope: Scope) {
  const groups = await waitingForABoat(scope)
  if (!groups.length) throw ApiError.unprocessable('Nobody is waiting for a boat right now.')

  const created: TripHydrated[] = []

  for (const group of groups) {
    let seatsLeft = 0
    let trip: TripHydrated | null = null

    const openBoat = async () => {
      const seq = await nextSequence('trip')
      trip = await Trip.create({
        _id: formatId('trip', seq),
        ref: `TRP-${pad(seq)}`,
        tenantId: scope.tenantId,
        stationId: scope.stationId,
        kioskId: scope.kioskId ?? null,
        assetTypeId: group.assetTypeId,
        assetTypeName: group.name,
        seats: group.seats,
        passengers: [],
        headcount: 0,
        status: 'READY',
        createdBy: scope.agentId,
      })
      created.push(trip)
      seatsLeft = group.seats
    }

    for (const passenger of group.bookings) {
      let left = passenger.people

      while (left > 0) {
        if (!trip || seatsLeft === 0) await openBoat()

        const seated = Math.min(left, seatsLeft)
        trip!.passengers.push({
          bookingId: passenger._id,
          bookingRef: passenger.ref,
          customerName: passenger.customerName,
          people: seated,
        })
        trip!.headcount += seated
        seatsLeft -= seated
        left -= seated
        await trip!.save()
      }

      await Booking.updateOne({ _id: passenger._id }, { $set: { 'metadata.tripId': trip!._id } })
    }
  }

  for (const trip of created) {
    await recordAudit({
      tenantId: scope.tenantId,
      actorId: scope.agentId,
      action: 'TRIP_PLANNED',
      entity: 'Trip',
      entityId: trip._id,
      detail: `${trip.assetTypeName} · ${trip.headcount} of ${trip.seats} seats`,
    })
  }

  await raise({
    tenantId: scope.tenantId,
    stationId: scope.stationId,
    engineKind: 'LAGOON',
    title: 'Boats ready to sail',
    body: `${created.length} trip(s) waiting for a captain.`,
    level: 'info',
    audience: ['CHIEF_CAPTAIN'],
    link: '/lagoon/trips',
  })

  return created.map((t) => t.toObject())
}

export async function tripBoard(scope: Scope, mine = false) {
  const base = { tenantId: scope.tenantId, stationId: scope.stationId }
  const [ready, running, done] = await Promise.all([
    Trip.find({ ...base, status: 'READY' }).sort({ createdAt: 1 }).lean(),
    Trip.find({
      ...base,
      status: { $in: ['CLAIMED', 'RUNNING'] },
      ...(mine ? { captainId: scope.agentId } : {}),
    })
      .sort({ createdAt: 1 })
      .lean(),
    Trip.find({ ...base, status: { $in: ['COMPLETED', 'CANCELLED'] } }).sort({ endedAt: -1 }).limit(25).lean(),
  ])
  return { ready, running, done }
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

  const boat = input.unitId
    ? await AssetUnit.findOne({ _id: input.unitId, tenantId: scope.tenantId, assetTypeId: trip.assetTypeId })
    : await AssetUnit.findOne({
        tenantId: scope.tenantId,
        stationId: trip.stationId,
        assetTypeId: trip.assetTypeId,
        status: 'AVAILABLE',
      })
  if (!boat) throw ApiError.unprocessable('No boat of that kind is free at this station.')
  if (boat.status !== 'AVAILABLE') throw ApiError.unprocessable(`${boat.identifier} is ${boat.status.toLowerCase()}.`)

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
