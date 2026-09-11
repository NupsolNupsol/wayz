import { AssetType, AssetUnit, CatalogueProduct, Gate, Tenant } from '../models/index.js'
import { engineFilter, kioskFilter, reachableUnitFilter } from '../domain/access.js'
import { ENGINE_KINDS, type EngineKind } from '../domain/types.js'
import type { Scope } from '../interfaces/index.js'

type Caller = Pick<Scope, 'role' | 'engineKinds'> & Partial<Pick<Scope, 'kioskId' | 'stationId'>>

/**
 * What this desk can actually sell.
 *
 * Two filters, and the second is the one that matters. A kind is stocked one desk at a time —
 * the Mountain jetty keeps the submarine, France keeps the dragon boat — but the price list is
 * shared, so a desk-scoped agent was offered every kind in the activity and only found out which
 * ones it could not fulfil after choosing the customer and reaching the empty unit list. Three of
 * the eight lagoon trips were dead ends at every jetty in the seed alone.
 *
 * So a kind backed by physical units is offered only where those units are. Stock, not
 * availability: a desk whose scooters are all out still sells scooters, and says none are free at
 * the point where that is the answer. A product with no kind behind it — a delivery, a meal —
 * isn't stocked anywhere and stays governed by the desk named on it.
 */

/**
 * The gates of a station, as bare ids.
 *
 * A desk reaches stock in two places — its own counter, and the gates of the venue it stands in —
 * so almost every stock question needs this list first. Cached nowhere on purpose: gates are a
 * handful of rows per station and an admin adding one must take effect at the next counter load,
 * not at the next restart.
 */
async function gateIdsAt(tenantId: string, stationId?: string): Promise<string[]> {
  if (!stationId) return []
  const gates = await Gate.find({ tenantId, stationId, active: { $ne: false } }, { _id: 1 }).lean()
  return gates.map((g) => g._id)
}

export async function listProducts(tenantId: string, engineKind?: EngineKind, caller?: Caller) {
  const q: Record<string, unknown> = { tenantId, active: true }
  const engines = caller ? engineFilter(caller, engineKind) : engineKind
  if (engines !== undefined) q.engineKind = engines

  // A product kept to one desk is offered at that desk only; one with no desk named belongs to
  // every counter running its activity.
  const kiosk = caller ? kioskFilter(caller) : undefined
  if (kiosk !== undefined) q.$or = [{ kioskId: null }, { kioskId: { $exists: false } }, { kioskId: kiosk }]

  const products = await CatalogueProduct.find(q).sort({ category: 1, name: 1 }).lean()
  if (kiosk === undefined || products.length === 0) return products

  const backed = [...new Set(products.map((p) => p.assetTypeId).filter(Boolean) as string[])]
  if (backed.length === 0) return products

  // Both places a desk can reach: its own counter, and the gates of its station. A Shop & Drop
  // counter holds no lockers at all, so without the gates it would find itself stocking nothing
  // and offering nothing.
  const reach = reachableUnitFilter(caller!, await gateIdsAt(tenantId, caller?.stationId))
  const stocked = new Set(
    await AssetUnit.distinct('assetTypeId', {
      tenantId,
      assetTypeId: { $in: backed },
      ...(caller?.stationId ? { stationId: caller.stationId } : {}),
      ...(reach ?? {}),
    }),
  )

  return products.filter((p) => !p.assetTypeId || stocked.has(p.assetTypeId))
}

export function getProduct(tenantId: string, productId: string) {
  return CatalogueProduct.findOne({ _id: productId, tenantId }).lean()
}

export function listAssetTypes(tenantId: string, engineKind?: EngineKind, caller?: Caller) {
  const q: Record<string, unknown> = { tenantId }
  const engines = caller ? engineFilter(caller, engineKind) : engineKind
  if (engines !== undefined) q.engineKind = engines
  return AssetType.find(q).lean()
}

export function getAssetType(tenantId: string, assetTypeId: string) {
  return AssetType.findOne({ _id: assetTypeId, tenantId }).lean()
}

/**
 * The physical units this desk can actually hand over, with enough on each row for an agent to
 * choose between them: what size it is, how much it holds, what it costs, and whether it is free.
 *
 * Joined here rather than in the browser so the counter has one source for the list and cannot
 * disagree with itself about which desk a unit belongs to.
 */
export async function listUnits(tenantId: string, stationId: string, caller?: Caller) {
  const q: Record<string, unknown> = { tenantId, stationId }

  if (caller) {
    const engines = engineFilter(caller)
    if (engines !== undefined) {
      const types = await AssetType.find({ tenantId, engineKind: engines }, { _id: 1 }).lean()
      q.assetTypeId = { $in: types.map((t) => t._id) }
    }
    // The desk's own units and the lockers standing at its station's gates. The engine filter
    // above already keeps a scooter bay from being handed a list of compartments.
    const reach = reachableUnitFilter(caller, await gateIdsAt(tenantId, stationId))
    if (reach) Object.assign(q, reach)
  }

  const units = await AssetUnit.find(q).sort({ assetTypeId: 1, identifier: 1 }).lean()
  if (units.length === 0) return []

  const typeIds = [...new Set(units.map((u) => u.assetTypeId))]
  const [types, products] = await Promise.all([
    AssetType.find({ tenantId, _id: { $in: typeIds } }).lean(),
    CatalogueProduct.find({ tenantId, assetTypeId: { $in: typeIds }, active: true }).lean(),
  ])

  const typeById = new Map(types.map((t) => [t._id, t]))
  const productByType = new Map(products.map((p) => [p.assetTypeId as string, p]))

  // A locker's gate is part of what it is, from the counter's point of view: it decides where the
  // bags are carried, and it is the first thing the agent tells the customer.
  const gateIds = [...new Set(units.map((u) => u.gateId).filter(Boolean) as string[])]
  const gateNames = gateIds.length
    ? new Map((await Gate.find({ tenantId, _id: { $in: gateIds } }, { name: 1 }).lean()).map((g) => [g._id, g.name]))
    : new Map<string, string>()

  return units.map((u) => {
    const type = typeById.get(u.assetTypeId)
    const product = productByType.get(u.assetTypeId)
    return {
      ...u,
      assetTypeName: type?.name ?? u.assetTypeId,
      assetKind: type?.kind ?? null,
      engineKind: type?.engineKind ?? null,
      capacityScore: type?.capacity?.capacityScore ?? null,
      maxBags: type?.capacity?.maxRecommendedBagCount ?? null,
      seats: type?.capacity?.seats ?? null,
      productId: product?._id ?? null,
      productName: product?.name ?? null,
      // A unit priced on its own overrides the list price for its kind.
      price: u.priceOverride ?? product?.basePrice ?? null,
      saleUnit: product?.saleUnit ?? null,
      billingModel: product?.billingModel ?? null,
      gateId: u.gateId ?? null,
      gateName: u.gateId ? (gateNames.get(u.gateId) ?? u.gateId) : null,
    }
  })
}

export async function tenantEngines(tenantId: string): Promise<EngineKind[]> {
  const tenant = await Tenant.findById(tenantId, { enabledEngines: 1 }).lean()
  const engines = tenant?.enabledEngines ?? []
  return engines.length ? engines : [...ENGINE_KINDS]
}
