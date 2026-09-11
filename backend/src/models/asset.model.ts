import { Schema } from 'mongoose'
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
export const AssetTypeSchema = assetTypeSchema

export interface AssetUnitDoc {
  _id: string
  tenantId: string
  stationId: string
  /**
   * The desk that hands this unit over — a scooter bay, a jetty. Null for anything that lives at
   * a gate instead.
   */
  kioskId: string | null
  /**
   * The gate this unit physically stands in. Compartments live here, not at a desk: a Shop & Drop
   * counter is a point of sale and holds no lockers, so its bags are carried to a gate and stored
   * there. Exactly one of `kioskId` and `gateId` is set on any unit.
   */
  gateId: string | null
  assetAreaId: string
  assetTypeId: string
  identifier: string
  status: AssetUnitStatus
  currentBookingId: string | null
  note?: string
  priceOverride?: number | null
  penaltyPrice?: number | null
}

const assetUnitSchema = new Schema<AssetUnitDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    kioskId: { type: String, default: null, index: true },
    assetAreaId: { type: String, required: true },
    gateId: { type: String, default: null, index: true },
    assetTypeId: { type: String, required: true, index: true },
    identifier: { type: String, required: true },
    status: { type: String, default: 'AVAILABLE', index: true },
    currentBookingId: { type: String, default: null },
    note: { type: String },
    priceOverride: { type: Number, default: null },
    penaltyPrice: { type: Number, default: null },
  },
  { _id: false, timestamps: true },
)
assetUnitSchema.index({ tenantId: 1, stationId: 1, assetTypeId: 1, status: 1 })
// What a desk holds, asked on every price list a counter loads: the catalogue now answers "is this
// kind stocked here" before offering it, and that question must not walk the tenant's whole estate.
assetUnitSchema.index({ tenantId: 1, kioskId: 1, assetTypeId: 1 })
// The same question asked of a gate: what does this locker bank hold, and how much of it is free.
assetUnitSchema.index({ tenantId: 1, gateId: 1, assetTypeId: 1, status: 1 })

export const AssetUnitSchema = assetUnitSchema
