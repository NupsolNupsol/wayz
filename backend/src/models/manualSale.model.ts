import mongoose, { Schema } from 'mongoose'
import type { EngineKind, PaymentMethod } from '../domain/types.js'

export const MANUAL_SALE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type ManualSaleStatus = (typeof MANUAL_SALE_STATUSES)[number]

export interface ManualSaleDoc {
  _id: string
  ref: string
  tenantId: string
  stationId: string
  engineKind: EngineKind
  description: string
  amount: number
  baseAmount: number
  vatAmount: number
  vatRate: number
  method: PaymentMethod
  occurredAt: Date
  status: ManualSaleStatus
  enteredBy: string
  reviewedBy: string | null
  reviewedAt: Date | null
  reviewNote: string
  createdAt: Date
  updatedAt: Date
}

const manualSaleSchema = new Schema<ManualSaleDoc>(
  {
    _id: { type: String, required: true },
    ref: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    engineKind: { type: String, required: true, index: true },
    description: { type: String, default: '' },
    amount: { type: Number, required: true },
    baseAmount: { type: Number, required: true },
    vatAmount: { type: Number, required: true },
    vatRate: { type: Number, required: true },
    method: { type: String, required: true },
    occurredAt: { type: Date, required: true, index: true },
    status: { type: String, default: 'PENDING', index: true },
    enteredBy: { type: String, required: true },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '' },
  },
  { _id: false, timestamps: true },
)

manualSaleSchema.index({ tenantId: 1, status: 1, occurredAt: -1 })

export const ManualSale = mongoose.model<ManualSaleDoc>('ManualSale', manualSaleSchema)
