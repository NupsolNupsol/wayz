import mongoose, { Schema } from 'mongoose'
import type { BillingModel, DurationUnit, EngineKind, BagCategory } from '../domain/types.js'

export interface ProposedPolicy {
  minAge?: number | null
  licenseRequired?: boolean
  conditionInspection?: 'MANDATORY_PHOTO' | 'VISUAL' | 'SKIP' | 'MANDATORY'
  safetyAck?: boolean
  overtimeRule?: string
  returnLocation?: string
  damageRule?: string
  operatorRequirement?: string
}

export interface CatalogueProductDoc {
  _id: string
  tenantId: string
  engineKind: EngineKind
  name: string
  category: string
  basePrice: number
  depositRequired: number
  overtimeHourlyRate?: number | null
  assetTypeId: string | null
  billingModel: BillingModel
  durationUnit?: DurationUnit
  compatibleBagCategories?: BagCategory[]
  proposedPolicy?: ProposedPolicy
  emoji: string
  active: boolean
}

const catalogueSchema = new Schema<CatalogueProductDoc>(
  {
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    engineKind: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, default: 'General' },
    basePrice: { type: Number, required: true },
    depositRequired: { type: Number, default: 0 },
    overtimeHourlyRate: { type: Number, default: null },
    assetTypeId: { type: String, default: null },
    billingModel: { type: String, required: true },
    durationUnit: { type: String },
    compatibleBagCategories: { type: [String] },
    proposedPolicy: { type: Schema.Types.Mixed },
    emoji: { type: String, default: '📦' },
    active: { type: Boolean, default: true },
  },
  { _id: false, timestamps: true },
)

export const CatalogueProduct = mongoose.model<CatalogueProductDoc>('CatalogueProduct', catalogueSchema)
