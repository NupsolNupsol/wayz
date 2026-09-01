import mongoose, { Schema } from 'mongoose'
import type { AssetUnitStatus, BagCategory, EngineKind } from '../domain/types.js'

export interface AssetTypeDoc {
  _id: string
  tenantId: string
  engineKind: EngineKind
  name: string
  kind: 'COMPARTMENT' | 'VEHICLE' | 'TABLE' | 'BOAT' | 'ANIMAL'
  capacity: {
    internalDimensions?: { w: number; h: number; d: number }
    maxWeight?: number
    maxRecommendedBagCount?: number
    compatibleBagCategories?: BagCategory[]
    capacityScore: number
    seats?: number
  }
}

const assetTypeSchema = new Schema<AssetTypeDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    engineKind: { type: String, required: true },
    name: { type: String, required: true },
    kind: { type: String, required: true },
    capacity: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false, timestamps: true },
)
export const AssetType = mongoose.model<AssetTypeDoc>('AssetType', assetTypeSchema)

export interface AssetUnitDoc {
  _id: string
  tenantId: string
  stationId: string
  kioskId: string | null
  assetAreaId: string
  assetTypeId: string
  identifier: string
  status: AssetUnitStatus
  currentBookingId: string | null
  note?: string
  /** Set when this one unit is priced apart from the rest of its type. */
  priceOverride?: number | null
}

const assetUnitSchema = new Schema<AssetUnitDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    kioskId: { type: String, default: null, index: true },
    assetAreaId: { type: String, required: true },
    assetTypeId: { type: String, required: true, index: true },
    identifier: { type: String, required: true },
    status: { type: String, default: 'AVAILABLE', index: true },
    currentBookingId: { type: String, default: null },
    note: { type: String },
    priceOverride: { type: Number, default: null },
  },
  { _id: false, timestamps: true },
)
assetUnitSchema.index({ tenantId: 1, stationId: 1, assetTypeId: 1, status: 1 })

export const AssetUnit = mongoose.model<AssetUnitDoc>('AssetUnit', assetUnitSchema)
