import mongoose, { Schema } from 'mongoose'
import type { EngineKind } from '../domain/types.js'

export const REFUND_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type RefundRequestStatus = (typeof REFUND_REQUEST_STATUSES)[number]

export interface RefundRequestDoc {
  _id: string
  ref: string
  tenantId: string
  stationId: string
  kioskId: string | null
  bookingId: string
  bookingRef: string
  engineKind: EngineKind
  customerName: string
  amount: number
  reason: string
  status: RefundRequestStatus
  requestedBy: string
  requestedByName: string
  reviewedBy: string | null
  reviewedByName: string | null
  reviewedAt: Date | null
  reviewNote: string
  paymentIds: string[]
  createdAt: Date
  updatedAt: Date
}

const refundRequestSchema = new Schema<RefundRequestDoc>(
  {
    _id: { type: String, required: true },
    ref: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    kioskId: { type: String, default: null, index: true },
    bookingId: { type: String, required: true, index: true },
    bookingRef: { type: String, required: true },
    engineKind: { type: String, required: true, index: true },
    customerName: { type: String, default: '' },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    status: { type: String, default: 'PENDING', index: true },
    requestedBy: { type: String, required: true },
    requestedByName: { type: String, default: '' },
    reviewedBy: { type: String, default: null },
    reviewedByName: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '' },
    paymentIds: { type: [String], default: [] },
  },
  { _id: false, timestamps: true },
)

refundRequestSchema.index({ tenantId: 1, status: 1, createdAt: -1 })

export const RefundRequest = mongoose.model<RefundRequestDoc>('RefundRequest', refundRequestSchema)
