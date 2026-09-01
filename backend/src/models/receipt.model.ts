import mongoose, { Schema } from 'mongoose'
import { nanoid } from 'nanoid'

export interface ReceiptDoc {
  _id: string
  ref: string
  tenantId: string
  stationId: string
  orderId: string
  bookingId: string
  kind: 'SALE' | 'FINAL'
  qrPayload: string
  createdAt: Date
  updatedAt: Date
}

const receiptSchema = new Schema<ReceiptDoc>(
  {
    _id: { type: String, default: () => `rc_${nanoid(10)}` },
    ref: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    stationId: { type: String, required: true, index: true },
    orderId: { type: String, required: true },
    bookingId: { type: String, required: true },
    kind: { type: String, default: 'SALE' },
    qrPayload: { type: String, required: true },
  },
  { _id: false, timestamps: true },
)

export const Receipt = mongoose.model<ReceiptDoc>('Receipt', receiptSchema)
