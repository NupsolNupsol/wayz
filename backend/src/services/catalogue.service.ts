import { AssetType, AssetUnit, CatalogueProduct, Tenant } from '../models/index.js'
import { engineFilter, kioskFilter } from '../domain/access.js'
import { ENGINE_KINDS, type EngineKind } from '../domain/types.js'
import type { Scope } from '../interfaces/index.js'

type Caller = Pick<Scope, 'role' | 'engineKinds'> & Partial<Pick<Scope, 'kioskId'>>

export function listProducts(tenantId: string, engineKind?: EngineKind, caller?: Caller) {
  const q: Record<string, unknown> = { tenantId, active: true }
  const engines = caller ? engineFilter(caller, engineKind) : engineKind
  if (engines !== undefined) q.engineKind = engines

  // A product kept to one desk is offered at that desk only; one with no desk named belongs to
  // every counter running its activity.
  const kiosk = caller ? kioskFilter(caller) : undefined
  if (kiosk !== undefined) q.$or = [{ kioskId: null }, { kioskId: { $exists: false } }, { kioskId: kiosk }]

  return CatalogueProduct.find(q).sort({ category: 1, name: 1 }).lean()
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
    const kiosk = kioskFilter(caller)
    if (kiosk !== undefined) q.kioskId = kiosk
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
    }
  })
}

export async function tenantEngines(tenantId: string): Promise<EngineKind[]> {
  const tenant = await Tenant.findById(tenantId, { enabledEngines: 1 }).lean()
  const engines = tenant?.enabledEngines ?? []
  return engines.length ? engines : [...ENGINE_KINDS]
}
