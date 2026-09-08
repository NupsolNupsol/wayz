import mongoose, { Schema } from 'mongoose'
import { nanoid } from 'nanoid'
import type { EngineKind } from '../domain/types.js'

export type VoucherStatus = 'ISSUED' | 'REDEEMED' | 'VOID'

export interface VoucherCampaignDoc {
  _id: string
  tenantId: string
  name: string
  percent: number
  quantity: number
  /** Empty means the code works on every activity the tenant runs. */
  engineKinds: EngineKind[]
  expiresAt?: Date | null
  note?: string
  createdBy: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface VoucherDoc {
  _id: string
  tenantId: string
  campaignId: string
  code: string
  percent: number
  engineKinds: EngineKind[]
  expiresAt?: Date | null
  status: VoucherStatus
  redeemedAt?: Date | null
  redeemedBy?: string | null
  bookingId?: string | null
  stationId?: string | null
  kioskId?: string | null
  amountOff?: number | null
  createdAt: Date
  updatedAt: Date
}

const campaignSchema = new Schema<VoucherCampaignDoc>(
  {
    _id: { type: String, default: () => `camp_${nanoid(10)}` },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    percent: { type: Number, required: true, min: 1, max: 100 },
    quantity: { type: Number, required: true, min: 1 },
    engineKinds: { type: [String], default: [] },
    expiresAt: { type: Date, default: null },
    note: { type: String, default: '' },
    createdBy: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { _id: false, timestamps: true },
)

const voucherSchema = new Schema<VoucherDoc>(
  {
    _id: { type: String, default: () => `vch_${nanoid(10)}` },
    tenantId: { type: String, required: true, index: true },
    campaignId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    percent: { type: Number, required: true },
    engineKinds: { type: [String], default: [] },
    expiresAt: { type: Date, default: null },
    status: { type: String, enum: ['ISSUED', 'REDEEMED', 'VOID'], default: 'ISSUED', index: true },
    redeemedAt: { type: Date, default: null },
    redeemedBy: { type: String, default: null },
    bookingId: { type: String, default: null },
    stationId: { type: String, default: null },
    kioskId: { type: String, default: null },
    amountOff: { type: Number, default: null },
  },
  { _id: false, timestamps: true },
)

/** One customer, one code: the pair is what makes a code redeemable exactly once. */
voucherSchema.index({ tenantId: 1, code: 1 }, { unique: true })

export const VoucherCampaign = mongoose.model<VoucherCampaignDoc>('VoucherCampaign', campaignSchema)
export const Voucher = mongoose.model<VoucherDoc>('Voucher', voucherSchema)
