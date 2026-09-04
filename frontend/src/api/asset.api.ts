import { http, unwrap } from './client'
import type { EngineKind } from './types'

export const SALE_UNITS = ['HOUR', 'FULL_DAY', 'TOUR', 'BAG', 'CART', 'DELIVERY', 'ITEM'] as const
export type SaleUnit = (typeof SALE_UNITS)[number]

export const SALE_TYPES = ['RENTAL', 'SALE'] as const
export type SaleType = (typeof SALE_TYPES)[number]

export interface AssetStation {
  _id: string
  name: string
  engineKinds: EngineKind[]
}

export interface AssetTypeRow {
  _id: string
  name: string
  kind: string
  engineKind: EngineKind
  capacityScore: number
  seats: number | null
  productId: string | null
  productName: string | null
  basePrice: number | null
  saleUnit: SaleUnit | null
  saleType: SaleType | null
  depositRequired: number | null
  penaltyPrice: number | null
  overtimeHourlyRate: number | null
  billingModel: string | null
  stationNames: string[]
  total: number
  inUse: number
  available: number
  outOfService: number
  utilisationPct: number
  byStatus: Record<string, number>
}

export interface AssetEstate {
  stations: AssetStation[]
  assetTypes: AssetTypeRow[]
}

export interface AssetUnitRow {
  _id: string
  identifier: string
  status: string
  stationId: string
  stationName: string
  kioskId: string | null
  kioskName: string | null
  note: string
  priceOverride: number | null
  effectivePrice: number | null
  penaltyPrice: number | null
  effectivePenalty: number | null
  currentBookingId: string | null
  currentBookingRef: string | null
}

export interface AssetTypeDetail {
  assetType: {
    _id: string
    name: string
    kind: string
    engineKind: EngineKind
    capacity: Record<string, unknown>
    productId: string | null
    productName: string | null
    basePrice: number | null
    saleUnit: SaleUnit | null
    saleType: SaleType | null
    depositRequired: number | null
    penaltyPrice: number | null
    overtimeHourlyRate: number | null
    billingModel: string | null
    total: number
    inUse: number
    available: number
    outOfService: number
    utilisationPct: number
  }
  stations: AssetStation[]
  kiosks: { _id: string; name: string; stationId: string }[]
  units: AssetUnitRow[]
}

export interface AssetUnitDetail {
  _id: string
  identifier: string
  status: string
  note: string
  priceOverride: number | null
  effectivePrice: number | null
  penaltyPrice: number | null
  effectivePenalty: number | null
  assetTypeId: string
  assetTypeName: string
  assetTypeKind: string | null
  engineKind: EngineKind | null
  stationId: string
  stationName: string
  kioskId: string | null
  kioskName: string | null
  basePrice: number | null
  currentBookingId: string | null
  currentBookingRef: string | null
  currentBookingStatus: string | null
}

export const ASSET_KINDS = ['COMPARTMENT', 'VEHICLE', 'BOAT', 'TABLE', 'ANIMAL'] as const
export type AssetKind = (typeof ASSET_KINDS)[number]

export interface NewAssetKind {
  name: string
  engineKind: EngineKind
  kind: AssetKind
  basePrice: number
  saleUnit?: SaleUnit
  saleType?: SaleType
  depositRequired?: number
  penaltyPrice?: number
  overtimeHourlyRate?: number | null
  capacity?: {
    internalDimensions?: { w: number; h: number; d: number }
    maxWeight?: number
    maxRecommendedBagCount?: number
    capacityScore?: number
    seats?: number
  }
  initialCount?: number
  stationId?: string
  kioskId?: string | null
}

export interface AddUnitsInput {
  stationId: string
  kioskId?: string | null
  count: number
  identifierPrefix?: string
}

export interface UnitPatch {
  status?: string
  note?: string
  identifier?: string
  priceOverride?: number | null
  penaltyPrice?: number | null
}

export interface TypePricePatch {
  basePrice?: number
  depositRequired?: number
  penaltyPrice?: number
  saleUnit?: SaleUnit
  saleType?: SaleType
  overtimeHourlyRate?: number | null
  clearOverrides?: boolean
}

export interface UnitReturnPosition {
  unitId: string
  identifier: string
  assetTypeName: string
  engineKind: EngineKind | null
  status: string
  homeKioskId: string | null
  homeKioskName: string | null
  belongsHere: boolean
  booking: { id: string; ref: string; customerName: string; status: string } | null
  wrongDeskPenalty: number
}

export const assetApi = {
  estate: (engineKind?: EngineKind) =>
    unwrap<AssetEstate>(http.get('/assets/types', { params: engineKind ? { engineKind } : undefined })),
  createType: (body: NewAssetKind) =>
    unwrap<{ _id: string; name: string; provisioned: number }>(http.post('/assets/types', body)),
  updateType: (id: string, body: { name?: string; capacity?: NewAssetKind['capacity'] }) =>
    unwrap<{ _id: string; name: string }>(http.patch(`/assets/types/${id}`, body)),
  removeType: (id: string) => unwrap<{ removed: string; name: string }>(http.delete(`/assets/types/${id}`)),
  typeDetail: (id: string) => unwrap<AssetTypeDetail>(http.get(`/assets/types/${id}`)),
  addUnits: (id: string, body: AddUnitsInput) =>
    unwrap<{ created: number; identifiers: string[] }>(http.post(`/assets/types/${id}/units`, body)),
  priceType: (id: string, body: TypePricePatch) =>
    unwrap<{ basePrice: number; cleared: number }>(http.patch(`/assets/types/${id}/price`, body)),
  unit: (id: string) => unwrap<AssetUnitDetail>(http.get(`/assets/units/${id}`)),
  returnPosition: (id: string) => unwrap<UnitReturnPosition>(http.get(`/assets/units/${id}/return-position`)),
  updateUnit: (id: string, body: UnitPatch) => unwrap<AssetUnitDetail>(http.patch(`/assets/units/${id}`, body)),
  removeUnit: (id: string) => unwrap<{ removed: string; identifier: string }>(http.delete(`/assets/units/${id}`)),
}
