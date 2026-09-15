import type { AssetUnit, BoatSpace, EngineKind, Product } from '@/types'

/** The only status a unit can be sold from. Everything else is busy, damaged or out of service. */
export const FREE = 'AVAILABLE'

export const isFree = (unit: AssetUnit) => unit.status === FREE

/**
 * The units of one kind at this desk.
 *
 * The catalogue is already scoped to the agent's kiosk by the server, so this only narrows by
 * kind. Filtering by type here rather than asking the API keeps the picker instant when the agent
 * flips between products.
 */
export function unitsOfKind(units: AssetUnit[], assetTypeId?: string | null): AssetUnit[] {
  if (!assetTypeId) return []
  return units.filter((u) => u.assetTypeId === assetTypeId)
}

/** What to say about a unit under its name: what it holds, and what is wrong with it if anything. */
export function unitCaption(unit: AssetUnit): string {
  const bits: string[] = []
  if (unit.seats) bits.push(`${unit.seats} seats`)
  if (unit.maxBags) bits.push(`up to ${unit.maxBags} bags`)
  if (unit.assetTypeName && !bits.length) bits.push(unit.assetTypeName)
  if (!isFree(unit)) bits.push(unit.status.replaceAll('_', ' ').toLowerCase())
  return bits.join(' · ')
}

/**
 * Every unit at this desk that belongs to one activity.
 *
 * The catalogue labels a unit with its engine, but an older record may not carry one — so the
 * products are used as the fallback map from asset type to activity rather than showing the agent
 * a compartment on the scooter counter.
 */
export function unitsForEngine(units: AssetUnit[], engineKind: EngineKind, products: Product[]): AssetUnit[] {
  const kinds = new Set(products.filter((p) => p.engineKind === engineKind).map((p) => p.assetTypeId))
  return units.filter((u) => (u.engineKind ? u.engineKind === engineKind : kinds.has(u.assetTypeId)))
}

/**
 * A boat, dressed as a unit so one picker can show both.
 *
 * A hull with seats already taken is still AVAILABLE as an asset, so its own status says nothing
 * about whether this party fits. Room is what decides it, and that is what the picker is told.
 */
export function boatAsUnit(boat: BoatSpace): AssetUnit {
  return {
    _id: boat._id,
    identifier: boat.identifier,
    status: boat.free === 0 ? 'FULL' : FREE,
    assetTypeId: boat.assetTypeId,
    stationId: '',
    kioskId: null,
    currentBookingId: null,
    assetTypeName: boat.assetTypeName,
    seats: boat.seats,
  }
}

/** How much room is left, said the way an agent would say it out loud. */
export const seatsCaption = (boats: BoatSpace[]) => (unit: AssetUnit) => {
  const boat = boats.find((b) => b._id === unit._id)
  if (!boat) return ''
  return boat.free === 0 ? 'Full' : `${boat.free} of ${boat.seats} seats free`
}
