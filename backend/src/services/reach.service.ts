import { Gate, Station } from '../models/index.js'

/**
 * The places around a station that stock can be reached from.
 *
 * Paired with `reachableUnitsAt` (domain/access.ts), which decides *which* of these a given
 * person may take from. This only answers the geography: the station's own gates, and every
 * station on the same site — because stock held by a location, such as an animal in the
 * stable area, is sold from that location's reception area rather than from its own.
 *
 * Organisation scoping applies to both reads as it does everywhere else.
 */
export async function placesAround(stationId: string) {
  const station = await Station.findById(stationId, { siteId: 1 }).lean<{ siteId?: string } | null>()

  const [gates, siblings] = await Promise.all([
    Gate.find({ stationId, active: { $ne: false } }, { _id: 1 }).lean<{ _id: string }[]>(),
    station?.siteId
      ? Station.find({ siteId: station.siteId }, { _id: 1 }).lean<{ _id: string }[]>()
      : Promise.resolve([] as { _id: string }[]),
  ])

  return {
    stationId,
    gateIds: gates.map((g) => g._id),
    siteStationIds: siblings.length > 0 ? siblings.map((s) => s._id) : [stationId],
  }
}
