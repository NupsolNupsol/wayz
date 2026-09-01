import { AssetType, AssetUnit, CatalogueProduct, Tenant } from '../models/index.js'
import { engineFilter } from '../domain/access.js'
import { ENGINE_KINDS, type EngineKind } from '../domain/types.js'
import type { Scope } from '../interfaces/index.js'

type Caller = Pick<Scope, 'role' | 'engineKinds'>

export function listProducts(tenantId: string, engineKind?: EngineKind, caller?: Caller) {
  const q: Record<string, unknown> = { tenantId, active: true }
  const engines = caller ? engineFilter(caller, engineKind) : engineKind
  if (engines !== undefined) q.engineKind = engines
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

export async function listUnits(tenantId: string, stationId: string, caller?: Caller) {
  const q: Record<string, unknown> = { tenantId, stationId }

  if (caller) {
    const engines = engineFilter(caller)
    if (engines !== undefined) {
      const types = await AssetType.find({ tenantId, engineKind: engines }, { _id: 1 }).lean()
      q.assetTypeId = { $in: types.map((t) => t._id) }
    }
  }

  return AssetUnit.find(q).sort({ assetTypeId: 1, identifier: 1 }).lean()
}

/** The engines a tenant offers. Reports list these and nothing else. */
export async function tenantEngines(tenantId: string): Promise<EngineKind[]> {
  const tenant = await Tenant.findById(tenantId, { enabledEngines: 1 }).lean()
  const engines = tenant?.enabledEngines ?? []
  return engines.length ? engines : [...ENGINE_KINDS]
}
